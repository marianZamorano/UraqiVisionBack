#!/usr/bin/env python
"""01 - Lista las escenas NISAR L2 GCOV (PROVISIONAL y VALIDATED) que tocan la caja.

Solo metadatos de CMR: no descarga imágenes ni necesita credenciales.
Guarda data/meta/nisar_escenas.csv y RECOMIENDA un track (no lo elige).
"""
from __future__ import annotations

import pandas as pd
from shapely.geometry import box
from shapely.ops import unary_union

from _comun import (META, a_fecha, buscar_nisar, caja, cargar_config, parsear_nombre_nisar,
                    poligono_granule, rel, tamano_bytes, url_https)


def main() -> None:
    cfg = cargar_config()
    bbox = caja(cfg)
    aoi = box(*bbox)
    ini, fin = cfg["periodo"]["inicio"], cfg["periodo"]["fin"]
    hueco_ini = a_fecha(cfg["periodo"]["hueco"]["inicio"])
    hueco_fin = a_fecha(cfg["periodo"]["hueco"]["fin"])

    filas, polis = [], {}
    for col, short in cfg["nisar"]["colecciones"].items():
        grans = buscar_nisar(short, bbox, ini, fin)
        print(f"{short}: {len(grans)} granules tocan la caja")
        for g in grans:
            try:
                d = parsear_nombre_nisar(g["umm"]["GranuleUR"])
            except ValueError as e:
                print(f"  ! {e}")
                continue
            pol = poligono_granule(g)
            cubre = 100 * pol.intersection(aoi).area / aoi.area if pol is not None else float("nan")
            polis[d["escena"]] = pol
            filas.append({"coleccion": col, **d, "cubre_caja_pct": round(cubre, 1),
                          "gb": round(tamano_bytes(g) / 1e9, 2), "url": url_https(g)})

    if not filas:
        raise SystemExit("No se encontró ninguna escena. Revisa config/aoi.yaml.")

    df = pd.DataFrame(filas).sort_values(["coleccion", "track", "direccion", "inicio", "frame"])
    # Reprocesos de la misma adquisición: se marca cuál es la versión más reciente.
    clave = ["coleccion", "track", "direccion", "frame", "inicio"]
    df["vigente"] = ~df.sort_values(["crid", "contador"]).duplicated(clave, keep="last")
    f = pd.to_datetime(df["fecha"]).dt.date
    df["tramo"] = ["antes_hueco" if x < hueco_ini else "despues_hueco" if x > hueco_fin else "EN_HUECO"
                   for x in f]
    META.mkdir(parents=True, exist_ok=True)
    salida = META / "nisar_escenas.csv"
    df.to_csv(salida, index=False)

    pd.set_option("display.width", 250, "display.max_rows", 500, "display.max_columns", 30)
    vig = df[df["vigente"]]
    resumen = []
    for (col, track, dire), g in vig.groupby(["coleccion", "track", "direccion"]):
        print(f"\n=== {col.upper()} | track {track:03d} {dire} ===")
        # una fila por fecha: frames, polarización y cobertura conjunta de la caja
        for fecha, gf in g.groupby("fecha"):
            union = unary_union([polis[e] for e in gf["escena"] if polis[e] is not None])
            cub = 100 * union.intersection(aoi).area / aoi.area
            print(f"  {fecha}  {'/'.join(sorted(set(gf['polarizacion']))):9s} "
                  f"frames {','.join(f'{x:03d}' for x in sorted(set(gf['frame'])))}  "
                  f"modo {'/'.join(sorted(set(gf['modo'])))}  CRID {'/'.join(sorted(set(gf['crid'])))}  "
                  f"cubre {cub:5.1f}% de la caja  [{gf['tramo'].iloc[0]}]")
        dh = g[g["polarizacion"] == cfg["nisar"]["polarizacion"]]
        fd = dh.drop_duplicates("fecha")
        cub_med = (dh.groupby("fecha")
                     .apply(lambda x: 100 * unary_union([polis[e] for e in x["escena"]])
                            .intersection(aoi).area / aoi.area, include_groups=False))
        resumen.append({
            "coleccion": col, "track": track, "dir": dire,
            "fechas": g["fecha"].nunique(),
            "fechas_DHDH": len(fd),
            "DHDH_antes_hueco": int((fd["tramo"] == "antes_hueco").sum()),
            "DHDH_despues_hueco": int((fd["tramo"] == "despues_hueco").sum()),
            "primera": g["fecha"].min(), "ultima": g["fecha"].max(),
            "frames": ",".join(f"{x:03d}" for x in sorted(set(g["frame"]))),
            "cubre_caja_pct_min": round(cub_med.min(), 1) if len(cub_med) else float("nan"),
            "gb_remoto_DHDH": round(dh["gb"].sum(), 1),
        })

    res = pd.DataFrame(resumen)
    print("\n=== RESUMEN por (colección, track, dirección) ===")
    print(res.to_string(index=False))

    prov = res[res["coleccion"] == "provisional"].sort_values(
        ["fechas_DHDH", "cubre_caja_pct_min"], ascending=False)
    if len(prov):
        r = prov.iloc[0]
        print(f"\nRECOMENDACIÓN (no se elige sola): track {r['track']} {r['dir']} — "
              f"{r['fechas_DHDH']} fechas DHDH en PROVISIONAL "
              f"({r['DHDH_antes_hueco']} antes y {r['DHDH_despues_hueco']} después del hueco), "
              f"cobertura mínima de la caja {r['cubre_caja_pct_min']}%.")
        emp = prov[prov["fechas_DHDH"] == r["fechas_DHDH"]]
        if len(emp) > 1:
            print("  OJO: hay empate en nº de fechas DHDH entre: "
                  + ", ".join(f"{t} {d}" for t, d in zip(emp["track"], emp["dir"]))
                  + " (desempatado por cobertura de la caja).")
    print(f"\nCobertura = % del área de la caja dentro de la huella declarada en CMR (aprox.).")
    print(f"Guardado: {rel(salida)} ({len(df)} filas; {int((~df['vigente']).sum())} reprocesos no vigentes)")


if __name__ == "__main__":
    main()
