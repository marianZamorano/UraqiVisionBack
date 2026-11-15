#!/usr/bin/env python
"""04 - Sentinel-2 L2A "antes" y "después" desde Earth Search (STAC de Element84, sin login).

Para cada ventana de fechas (config/aoi.yaml: sentinel2.ventanas) elige la fecha con MENOR
nubosidad SOBRE LA CAJA (calculada con la banda SCL recortada, no con el % del tile entero)
y baja SOLO el recorte de nir08 (B8A), swir22 (B12) y scl como COG. No baja tiles completos:
lee por HTTP las ventanas de los COG públicos.

Si la caja cae en varios tiles MGRS de la misma fecha, se unen en una sola grilla UTM de 20 m.
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict

import numpy as np

from _comun import (RAW, actualizar_manifest, caja, cargar_config, con_reintentos, escribir_cog,
                    leer_manifest, rel, tif_valido)

RES = 20.0
SCL_NUBE = (3, 8, 9, 10)      # sombra de nube, nube prob. media, nube prob. alta, cirros
SCL_NODATA = 0
MAX_CANDIDATAS = 8


def grilla(bbox, epsg: int):
    """Grilla destino: caja reproyectada al UTM de las escenas, alineada a múltiplos de 20 m."""
    from pyproj import Transformer
    from rasterio.transform import from_origin

    tr = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    xmin, ymin, xmax, ymax = tr.transform_bounds(*bbox, densify_pts=21)
    xmin, ymin = np.floor(xmin / RES) * RES, np.floor(ymin / RES) * RES
    xmax, ymax = np.ceil(xmax / RES) * RES, np.ceil(ymax / RES) * RES
    ancho, alto = int(round((xmax - xmin) / RES)), int(round((ymax - ymin) / RES))
    return from_origin(xmin, ymax, RES, RES), ancho, alto


def mosaico(items, asset: str, epsg: int, transform, ancho: int, alto: int) -> np.ndarray:
    """Lee solo la ventana de la caja de cada tile y la vuelca en la grilla destino."""
    import rasterio
    from rasterio.warp import Resampling, reproject

    salida = None
    with rasterio.Env(AWS_NO_SIGN_REQUEST="YES", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        for it in items:
            with rasterio.open(it.assets[asset].href) as src:
                if salida is None:
                    salida = np.zeros((alto, ancho), dtype=src.dtypes[0])
                tmp = np.zeros((alto, ancho), dtype=src.dtypes[0])
                reproject(rasterio.band(src, 1), tmp, dst_transform=transform,
                          dst_crs=f"EPSG:{epsg}", src_nodata=0, dst_nodata=0,
                          resampling=Resampling.nearest)
                salida = np.where(salida == 0, tmp, salida)   # 0 = sin dato en L2A
    return salida


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--forzar", action="store_true", help="vuelve a elegir y bajar aunque exista")
    args = ap.parse_args()

    from pystac_client import Client

    cfg = cargar_config()
    s2 = cfg["sentinel2"]
    bbox = caja(cfg)
    dest = RAW / "sentinel2"
    previo = leer_manifest().get("sentinel2", {})
    cli = con_reintentos(Client.open, s2["stac"], que="abrir STAC")
    fallos = []

    for momento, (ini, fin) in s2["ventanas"].items():
        p = previo.get(momento)
        if p and not args.forzar and all(tif_valido(RAW.parent.parent / r) for r in p["rutas"].values()):
            print(f"{momento}: ya existe ({p['fecha']}, nubes en la caja {p['nubes_caja_pct']}%), salto")
            continue

        def buscar():
            return list(cli.search(collections=[s2["coleccion"]], bbox=list(bbox),
                                   datetime=f"{ini}T00:00:00Z/{fin}T23:59:59Z", limit=100).items())
        items = con_reintentos(buscar, que=f"búsqueda STAC {momento}")
        if not items:
            print(f"{momento}: sin escenas entre {ini} y {fin}")
            fallos.append(momento)
            continue

        # agrupar por fecha (una pasada puede repartirse en varios tiles MGRS)
        por_fecha = defaultdict(list)
        for it in items:
            por_fecha[it.datetime.date().isoformat()].append(it)
        # si hay reprocesos del mismo tile y fecha, queda el más reciente
        for f, lst in por_fecha.items():
            uno = {}
            for it in sorted(lst, key=lambda i: i.properties.get("created", "")):
                uno[it.properties.get("grid:code", it.id.rsplit("_", 2)[0])] = it
            por_fecha[f] = list(uno.values())
        orden = sorted(por_fecha, key=lambda f: np.mean(
            [i.properties.get("eo:cloud_cover", 100) for i in por_fecha[f]]))
        print(f"{momento}: {len(items)} items en {len(por_fecha)} fechas; "
              f"evalúo SCL sobre la caja en las {min(MAX_CANDIDATAS, len(orden))} con menos nubes de tile")

        eval_ = []
        for f in orden[:MAX_CANDIDATAS]:
            its = por_fecha[f]
            epsg = int(its[0].properties["proj:epsg"]) if "proj:epsg" in its[0].properties \
                else int(str(its[0].properties["proj:code"]).split(":")[1])
            transform, ancho, alto = grilla(bbox, epsg)
            try:
                scl = con_reintentos(mosaico, its, "scl", epsg, transform, ancho, alto, que=f"SCL {f}")
            except Exception as e:  # noqa: BLE001
                print(f"  ! {f}: no pude leer SCL ({e})")
                continue
            valido = scl != SCL_NODATA
            cubre = 100 * valido.mean()
            nubes = 100 * np.isin(scl, SCL_NUBE).sum() / max(valido.sum(), 1)
            tile_cc = float(np.mean([i.properties.get("eo:cloud_cover", np.nan) for i in its]))
            print(f"  {f}: cubre {cubre:5.1f}% de la caja, nubes+sombras en la caja {nubes:5.1f}% "
                  f"(tile: {tile_cc:.1f}%), tiles {[i.id for i in its]}")
            eval_.append(dict(fecha=f, items=its, epsg=epsg, transform=transform, ancho=ancho,
                              alto=alto, scl=scl, cubre=cubre, nubes=nubes, tile_cc=tile_cc))
            if cubre >= 99.5 and nubes < 0.5:
                break       # ya no se puede mejorar de forma apreciable
        if not eval_:
            fallos.append(momento)
            continue
        completas = [e for e in eval_ if e["cubre"] >= 99.0]
        if not completas:
            print(f"  OJO: ninguna fecha cubre ≥99% de la caja; tomo la de mayor cobertura.")
        mejor = min(completas, key=lambda e: e["nubes"]) if completas \
            else max(eval_, key=lambda e: (e["cubre"], -e["nubes"]))

        f8 = mejor["fecha"].replace("-", "")
        rutas = {}
        try:
            for asset in s2["assets"]:
                ruta = dest / f"{cfg['nombre']}_S2_{momento}_{f8}_{asset}.tif"
                arr = mejor["scl"] if asset == "scl" else con_reintentos(
                    mosaico, mejor["items"], asset, mejor["epsg"], mejor["transform"],
                    mejor["ancho"], mejor["alto"], que=f"{asset} {mejor['fecha']}")
                escribir_cog(ruta, arr, f"EPSG:{mejor['epsg']}", mejor["transform"], nodata=0,
                             tags={"items": ",".join(i.id for i in mejor["items"]), "asset": asset,
                                   "fecha": mejor["fecha"]})
                rutas[asset] = rel(ruta)
        except Exception as e:  # noqa: BLE001
            print(f"  X {momento}: {type(e).__name__}: {e}")
            fallos.append(momento)
            continue
        # borrar recortes de una elección anterior distinta
        for viejo in dest.glob(f"{cfg['nombre']}_S2_{momento}_*.tif"):
            if rel(viejo) not in rutas.values():
                viejo.unlink()
        props = mejor["items"][0].properties
        actualizar_manifest("sentinel2", momento, {
            "fecha": mejor["fecha"], "ids": [i.id for i in mejor["items"]],
            "nubes_caja_pct": round(float(mejor["nubes"]), 2),
            "cubre_caja_pct": round(float(mejor["cubre"]), 2),
            "nubes_tile_pct": round(mejor["tile_cc"], 2),
            "epsg": mejor["epsg"], "resolucion_m": RES,
            "tamano_px": [mejor["ancho"], mejor["alto"]],
            "boa_offset_aplicado": props.get("earthsearch:boa_offset_applied"),
            "baseline": props.get("s2:processing_baseline"),
            "nota": "DN uint16 tal cual vienen (reflectancia = DN/10000 si el offset ya fue aplicado)",
            "ventana": [ini, fin], "rutas": rutas})
        print(f"  ELEGIDA {momento}: {mejor['fecha']} — nubes en la caja {mejor['nubes']:.1f}%, "
              f"{mejor['ancho']}x{mejor['alto']} px")

    if fallos:
        sys.exit(f"Sentinel-2 falló para: {', '.join(fallos)}")


if __name__ == "__main__":
    main()
