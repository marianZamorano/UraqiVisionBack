"""Utilidades compartidas por los scripts de descarga de UraqiVision."""
from __future__ import annotations

import functools
import json
import os
import sys
import tempfile
import time
from datetime import date, datetime, timezone
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parent.parent
DATA = RAIZ / "data"
RAW = DATA / "raw"
META = DATA / "meta"
MANIFEST = META / "manifest.json"


# ---------------------------------------------------------------- config
@functools.lru_cache(maxsize=1)
def cargar_config() -> dict:
    with open(RAIZ / "config" / "aoi.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def caja(cfg: dict | None = None, clave: str = "caja") -> tuple[float, float, float, float]:
    """Devuelve (oeste, sur, este, norte) en lon/lat."""
    c = (cfg or cargar_config())[clave]
    return float(c["oeste"]), float(c["sur"]), float(c["este"]), float(c["norte"])


def a_fecha(x) -> date:
    return x if isinstance(x, date) else date.fromisoformat(str(x))


def hoy_utc() -> date:
    return datetime.now(timezone.utc).date()


# ---------------------------------------------------------------- manifest
def leer_manifest() -> dict:
    if MANIFEST.exists():
        with open(MANIFEST, encoding="utf-8") as f:
            return json.load(f)
    return {}


def escribir_json(ruta: Path, obj) -> None:
    """Escritura atómica: nunca deja un JSON a medias si el proceso se corta."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=ruta.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False, default=str)
    os.replace(tmp, ruta)


def actualizar_manifest(seccion: str, clave: str, valor: dict) -> None:
    m = leer_manifest()
    m.setdefault(seccion, {})[clave] = valor
    m["actualizado"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    escribir_json(MANIFEST, m)


def rel(ruta: Path) -> str:
    try:
        return str(Path(ruta).resolve().relative_to(RAIZ))
    except ValueError:
        return str(ruta)


# ---------------------------------------------------------------- red
def con_reintentos(fn, *args, intentos: int = 5, espera: float = 5.0, que: str = "", **kwargs):
    """Ejecuta fn con reintentos y espera exponencial (5 s, 10 s, 20 s, ...)."""
    for i in range(1, intentos + 1):
        try:
            return fn(*args, **kwargs)
        except (KeyboardInterrupt, TypeError, AttributeError, KeyError, NameError):
            raise   # errores de programa o de formato: reintentar no los arregla
        except Exception as e:  # noqa: BLE001 - errores de red vienen de muchas capas
            if i == intentos:
                raise
            t = espera * 2 ** (i - 1)
            print(f"  ! {que or fn.__name__}: {type(e).__name__}: {e} "
                  f"(intento {i}/{intentos}, espero {t:.0f}s)", flush=True)
            time.sleep(t)


# ---------------------------------------------------------------- disco
def gb_usados(ruta: Path = DATA) -> float:
    total = 0
    for p in ruta.rglob("*"):
        if p.is_file():
            total += p.stat().st_size
    return total / 1e9


def comprobar_limite(extra_gb: float = 0.0) -> None:
    """Se detiene si data/ (más lo que se estima agregar) pasa del límite."""
    lim = float(cargar_config().get("limite_gb", 5))
    usado = gb_usados()
    if usado + extra_gb > lim:
        sys.exit(f"DETENIDO: data/ usa {usado:.2f} GB y se estiman {extra_gb:.2f} GB más; "
                 f"supera el límite de {lim:g} GB (config/aoi.yaml: limite_gb). "
                 f"Confirma antes de seguir.")


# ---------------------------------------------------------------- GeoTIFF
def tif_valido(ruta: Path) -> bool:
    """True si el GeoTIFF existe, abre, tiene CRS y se puede leer entero."""
    import rasterio

    if not ruta.exists() or ruta.stat().st_size == 0:
        return False
    try:
        with rasterio.open(ruta) as ds:
            if ds.crs is None or ds.width == 0 or ds.height == 0:
                return False
            ds.read(1)  # fuerza a descomprimir todo: detecta archivos truncados
        return True
    except Exception:  # noqa: BLE001
        return False


def escribir_cog(ruta: Path, arr, crs, transform, nodata=None, tags: dict | None = None) -> None:
    """Escribe un array 2D como Cloud Optimized GeoTIFF, de forma atómica."""
    import numpy as np
    import rasterio
    from rasterio.io import MemoryFile
    from rasterio.shutil import copy as rio_copy

    ruta.parent.mkdir(parents=True, exist_ok=True)
    es_float = np.issubdtype(arr.dtype, np.floating)
    perfil = dict(driver="GTiff", height=arr.shape[0], width=arr.shape[1], count=1,
                  dtype=arr.dtype.name, crs=crs, transform=transform, nodata=nodata)
    tmp = ruta.with_name(ruta.name + ".parcial")
    with MemoryFile() as mem:
        with mem.open(**perfil) as ds:
            ds.write(arr, 1)
            if tags:
                ds.update_tags(**{k: str(v) for k, v in tags.items()})
        with mem.open() as src:
            rio_copy(src, tmp, driver="COG", compress="DEFLATE",
                     predictor=3 if es_float else 2, blocksize=512,
                     overview_resampling="average" if es_float else "nearest")
    os.replace(tmp, ruta)


# ---------------------------------------------------------------- NISAR
def parsear_nombre_nisar(nombre: str) -> dict:
    """Descompone un nombre de granule NISAR L2 GCOV.

    Ejemplo verificado en CMR:
    NISAR_L2_PR_GCOV_023_060_A_169_2005_DHDH_A_20260618T095047_20260618T095122_P05023_N_F_J_001
    """
    base = Path(nombre).name.removesuffix(".h5")
    p = base.split("_")
    if len(p) < 18 or p[0] != "NISAR" or p[3] != "GCOV":
        raise ValueError(f"Nombre NISAR GCOV inesperado: {nombre}")
    return {
        "escena": base,
        "ciclo": int(p[4]),
        "track": int(p[5]),
        "direccion": p[6],
        "frame": int(p[7]),
        "modo": p[8],
        "polarizacion": p[9],
        "inicio": p[11],
        "fin": p[12],
        "fecha": f"{p[11][:4]}-{p[11][4:6]}-{p[11][6:8]}",
        "crid": p[13],
        "cobertura": p[15],      # F = frame completo, P = parcial
        "contador": p[17],
    }


def buscar_nisar(short_name: str, bbox, inicio, fin) -> list:
    """Busca granules en CMR (no requiere login). Devuelve DataGranule de earthaccess."""
    import earthaccess

    return con_reintentos(
        earthaccess.search_data,
        short_name=short_name,
        bounding_box=tuple(bbox),
        temporal=(str(inicio), str(fin)),
        count=-1,
        que=f"búsqueda CMR {short_name}",
    )


def poligono_granule(g):
    """Polígono (shapely, lon/lat) de la huella de un granule según UMM-G."""
    from shapely.geometry import MultiPolygon, Polygon

    geom = g["umm"]["SpatialExtent"]["HorizontalSpatialDomain"]["Geometry"]
    polis = [Polygon([(pt["Longitude"], pt["Latitude"]) for pt in gp["Boundary"]["Points"]])
             for gp in geom.get("GPolygons", [])]
    if not polis:
        return None
    return polis[0] if len(polis) == 1 else MultiPolygon(polis)


def url_https(g) -> str | None:
    for u in g["umm"].get("RelatedUrls", []):
        if u.get("Type") == "GET DATA" and u["URL"].endswith(".h5"):
            return u["URL"]
    return None


def tamano_bytes(g) -> int:
    for a in g["umm"].get("DataGranule", {}).get("ArchiveAndDistributionInformation", []):
        if a.get("Name", "").endswith(".h5"):
            return int(a.get("SizeInBytes", 0))
    return 0
