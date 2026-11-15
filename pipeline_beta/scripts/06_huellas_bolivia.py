#!/usr/bin/env python
"""06 - Huellas (solo metadatos, sin imágenes) de las escenas GCOV PROVISIONAL sobre Bolivia.

Escribe data/meta/nisar_huellas_bolivia.geojson con un polígono por escena y las propiedades
track, dirección, fecha, polarización, frame, modo y CRID. Sirve para dibujar la cobertura
en el globo. No necesita credenciales.
"""
from __future__ import annotations

from shapely.geometry import mapping

from _comun import (META, RAW, buscar_nisar, caja, cargar_config, escribir_json,
                    parsear_nombre_nisar, poligono_granule, rel)


def main() -> None:
    cfg = cargar_config()
    short = cfg["nisar"]["colecciones"]["provisional"]
    grans = buscar_nisar(short, caja(cfg, "bolivia"), cfg["periodo"]["inicio"], cfg["periodo"]["fin"])
    print(f"{short}: {len(grans)} granules tocan la caja de Bolivia")

    pais = None
    adm1 = RAW / "boundaries" / "bolivia_adm1.geojson"
    if adm1.exists():
        import geopandas as gpd
        pais = gpd.read_file(adm1).union_all()

    feats, raros = [], 0
    for g in grans:
        try:
            d = parsear_nombre_nisar(g["umm"]["GranuleUR"])
        except ValueError:
            raros += 1
            continue
        pol = poligono_granule(g)
        if pol is None:
            raros += 1
            continue
        props = {k: d[k] for k in ("escena", "track", "direccion", "fecha", "polarizacion",
                                   "frame", "modo", "crid", "ciclo")}
        if pais is not None:
            props["toca_bolivia"] = bool(pol.intersects(pais))
        feats.append({"type": "Feature", "geometry": mapping(pol), "properties": props})

    feats.sort(key=lambda f: (f["properties"]["fecha"], f["properties"]["track"], f["properties"]["frame"]))
    salida = META / "nisar_huellas_bolivia.geojson"
    escribir_json(salida, {"type": "FeatureCollection", "name": "nisar_gcov_provisional_bolivia",
                           "features": feats})
    tracks = sorted({(f["properties"]["track"], f["properties"]["direccion"]) for f in feats})
    fechas = sorted({f["properties"]["fecha"] for f in feats})
    print(f"{len(feats)} huellas, {len(tracks)} tracks, {len(fechas)} fechas "
          f"({fechas[0]} a {fechas[-1]})" if feats else "Sin huellas.")
    if pais is not None and feats:
        print(f"  {sum(f['properties']['toca_bolivia'] for f in feats)} tocan el polígono real de Bolivia "
              "(propiedad toca_bolivia)")
    else:
        print("  Sin bolivia_adm1.geojson: no se agregó la propiedad toca_bolivia (corre 05 antes).")
    if raros:
        print(f"  {raros} granules ignorados por nombre o geometría inesperados")
    print(f"Guardado: {rel(salida)} ({salida.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
