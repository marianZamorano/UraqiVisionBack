"""Funciones puras para explorar NISAR L2 GCOV sobre San Ignacio de Velasco (#60).

Apoyo a Alex en M-INGESTA (MC-01, RF-26). Es exploratorio: el recorte de la estación sigue pendiente (DP-08) y
ninguna salida se presenta como resultado (RN-04). Solo biblioteca estándar, para poder probarlo sin red.

Referencias (§31):
- Alaska Satellite Facility. (2026). NISAR data user guide. https://nisar-docs.asf.alaska.edu/
- Alaska Satellite Facility. (2026). Using NISAR data with GDAL. https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal

Hechos comprobados el 14 nov 2026 abriendo en remoto el gránulo VALIDATED
NISAR_L2_PR_GCOV_034_060_A_170_2005_DHDH_A_20261028T095118_20261028T095152_P05036_N_F_J_001:
- El track, la dirección, el frame, el CRID y el inicio del nombre coinciden con science/LSAR/identification.
- HH y HV están en science/LSAR/GCOV/grids/frequencyA/HHHH y HVHV (float32, _FillValue NaN).
- La grilla es UTM (EPSG en projection/epsg_code), con xCoordinates/yCoordinates en el centro del píxel.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone

# RN-02: solo estas dos madureces; nunca BETA (§10.1).
COLECCIONES = {
    "PROVISIONAL": "C2854338529-ASF",  # NISAR_L2_GCOV_PROVISIONAL_V1, CRID P05023
    "VALIDATED": "C3622241360-ASF",  # NISAR_L2_GCOV_V1, CRID P05036
}

# Recuadro PROVISIONAL alrededor de San Ignacio de Velasco (oeste, sur, este, norte; grados WGS 84).
# No es el recorte de la estación: ese valor está pendiente (DP-08). Se cambia con --bbox, sin tocar el código.
BBOX_EXPLORATORIO = (-61.2, -16.6, -60.7, -16.1)

RUTA_GRILLA = "science/LSAR/GCOV/grids/frequencyA"

# RN-07: Bolivia está en UTC−4 todo el año (sin horario de verano).
_BOLIVIA = timezone(timedelta(hours=-4))

_PATRON = re.compile(
    r"^NISAR_L2_PR_GCOV_(?P<campo3>\d{3})_(?P<track>\d{3})_(?P<direccion>[AD])_(?P<frame>\d{3})_"
    r"(?P<modo>\w{4})_(?P<pol>[A-Z]{4})_\w_(?P<inicio>\d{8}T\d{6})_(?P<fin>\d{8}T\d{6})_(?P<crid>P\d{5})_"
)

# Modos de polarización de §10.1: doble (HH y HV) o solo HH.
_POLARIZACIONES = {"DHDH": ["HH", "HV"], "SHSH": ["HH"]}


def _iso(marca: str) -> str:
    return datetime.strptime(marca, "%Y%m%dT%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ")


def analizar_nombre(nombre: str) -> dict:
    """Extrae del nombre de un gránulo GCOV los campos verificados contra su identificación interna."""
    m = _PATRON.match(nombre)
    if not m:
        raise ValueError(f"No es un nombre de gránulo NISAR L2 GCOV reconocido: {nombre!r}")
    pol = m["pol"]
    track = int(m["track"])
    return {
        "granulo": nombre,
        "track": track,
        "direccion": m["direccion"],
        "orbita": f"{track:03d}{m['direccion']}",  # como en §10.2: 060A, 039D…
        "frame": int(m["frame"]),
        "modo_polarizacion": pol,
        # Un modo desconocido queda sin polarizaciones (no se supone HV).
        "polarizaciones": _POLARIZACIONES.get(pol, []),
        "inicio_utc": _iso(m["inicio"]),
        "fin_utc": _iso(m["fin"]),
        "crid": m["crid"],
    }


def huella_wkt(poligonos) -> str | None:
    """Convierte el polígono de CMR («lat lon» por pares) a WKT («lon lat»). Sin polígono, None (RN-13)."""
    if not poligonos or not poligonos[0]:
        return None
    valores = poligonos[0][0].split()
    pares = [(valores[i + 1], valores[i]) for i in range(0, len(valores), 2)]
    return "POLYGON((" + ", ".join(f"{lon} {lat}" for lon, lat in pares) + "))"


def _enlace(enlaces, condicion) -> str | None:
    for e in enlaces or []:
        href = e.get("href", "")
        if condicion(href):
            return href
    return None


def fila_inventario(entrada: dict, madurez: str) -> dict:
    """Una fila del inventario a partir de una entrada de granules.json de CMR."""
    fila = analizar_nombre(entrada["producer_granule_id"])
    inicio = datetime.strptime(fila["inicio_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    tamano = entrada.get("granule_size")
    fila.update({
        "madurez": madurez,
        "inicio_bolivia": inicio.astimezone(_BOLIVIA).strftime("%Y-%m-%d %H:%M:%S"),
        # RN-13: si CMR no da el tamaño, queda vacío, nunca 0.
        "tamano_mb": round(float(tamano), 1) if tamano not in (None, "") else None,
        "url_h5": _enlace(entrada.get("links"), lambda h: h.startswith("https://") and h.endswith(".h5")),
        "url_vista_previa": _enlace(entrada.get("links"), lambda h: h.startswith("https://") and h.endswith("_thumbnail.png")),
        "huella_wkt": huella_wkt(entrada.get("polygons")),
    })
    fila["polarizaciones"] = "+".join(fila["polarizaciones"])
    return fila


def indices_recorte(*, x0, dx, nx, y0, dy, ny, xmin, xmax, ymin, ymax) -> tuple[slice, slice]:
    """Filas y columnas de la grilla cuyos centros caen dentro del recuadro (en metros, misma proyección).

    x0/y0 son el primer centro de píxel; dy es negativo cuando la grilla va de norte a sur. No remuestrea:
    el recorte conserva la grilla del producto (RN-01, FR-008).
    """
    def rango(inicio, paso, n, bajo, alto):
        a, b = (bajo - inicio) / paso, (alto - inicio) / paso
        primero, ultimo = math.ceil(min(a, b)), math.floor(max(a, b))
        primero, ultimo = max(primero, 0), min(ultimo, n - 1)
        if primero > ultimo:
            raise ValueError("El recuadro no se superpone con la escena.")
        return slice(primero, ultimo + 1)

    return rango(y0, dy, ny, ymin, ymax), rango(x0, dx, nx, xmin, xmax)


def transformacion_geotiff(*, x_primero, dx, y_primero, dy) -> tuple[float, ...]:
    """Transformación afín (a, b, c, d, e, f) desde el centro del primer píxel a su esquina superior izquierda."""
    return (dx, 0.0, x_primero - dx / 2, 0.0, dy, y_primero - dy / 2)
