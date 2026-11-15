#!/usr/bin/env python
"""07 - Verifica cada GeoTIFF descargado y hace quicklooks de HVHV antes/después.

Valida CRS, tamaño, tipo, % de píxeles válidos y rango de valores (potencia lineal típica
~0.001 a ~1). Por cada (colección, track, frame) guarda en data/meta/quicklooks/ un PNG con
la primera y la última fecha de HVHV en dB, con el mismo estiramiento 2–98 %.
Imprime un resumen y los GB usados. Sale con código 1 si algo está MAL.
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict

import numpy as np
import pandas as pd
import rasterio

from _comun import DATA, META, RAW, cargar_config, gb_usados, rel

PATRON = re.compile(r"^(?P<zona>.+)_(?P<fecha>\d{8})_T(?P<track>\d{3})(?P<dir>[AD])_F(?P<frame>\d{3})_(?P<capa>\w+)\.tif$")
TIPO_ESPERADO = {"HHHH": "float32", "HVHV": "float32", "numberOfLooks": "float32"}


def revisar_nisar(ruta, col: str) -> dict:
    m = PATRON.match(ruta.name)
    fila = {"coleccion": col, "archivo": ruta.name, "estado": "ok", "notas": []}
    if not m:
        fila.update(estado="MAL", notas=["nombre no cumple el patrón"])
        return fila
    fila.update(fecha=m["fecha"], track=m["track"] + m["dir"], frame=m["frame"], capa=m["capa"])
    try:
        with rasterio.open(ruta) as ds:
            a = ds.read(1)
            fila.update(crs=str(ds.crs), px=f"{ds.width}x{ds.height}", res=round(abs(ds.transform.a), 2),
                        dtype=ds.dtypes[0], mb=round(ruta.stat().st_size / 1e6, 1))
            nodata = ds.nodata
    except Exception as e:  # noqa: BLE001
        fila.update(estado="MAL", notas=[f"no abre: {e}"])
        return fila
    if fila["crs"] in ("None", ""):
        fila["estado"] = "MAL"; fila["notas"].append("sin CRS")
    capa = m["capa"]
    if capa in TIPO_ESPERADO and fila["dtype"] != TIPO_ESPERADO[capa]:
        fila["estado"] = "MAL"; fila["notas"].append(f"tipo {fila['dtype']} != {TIPO_ESPERADO[capa]}")
    if capa == "mask":
        ok = a != nodata if nodata is not None else np.ones(a.shape, bool)
        vals, cuenta = np.unique(a, return_counts=True)
        fila["valido_pct"] = round(100 * ok.mean(), 1)
        fila["notas"].append("valores " + ",".join(f"{v}:{100 * c / a.size:.0f}%" for v, c in zip(vals[:6], cuenta[:6])))
        return fila
    ok = np.isfinite(a)
    fila["valido_pct"] = round(100 * ok.mean(), 1)
    if not ok.any():
        fila["estado"] = "MAL"; fila["notas"].append("todo NaN")
        return fila
    v = a[ok]
    p2, p50, p98 = np.percentile(v, [2, 50, 98])
    fila.update(p02=float(f"{p2:.3g}"), p50=float(f"{p50:.3g}"), p98=float(f"{p98:.3g}"),
                min=float(f"{v.min():.3g}"), max=float(f"{v.max():.3g}"))
    if capa in ("HHHH", "HVHV"):
        if v.min() < 0:
            fila["estado"] = "MAL"; fila["notas"].append("valores negativos: no es potencia")
        if not 1e-3 <= p50 <= 1.0:
            # mediana fuera de ~0.001–1: sospecha de dB/amplitud o de escena anómala
            fila["estado"] = "REVISAR" if fila["estado"] == "ok" else fila["estado"]
            fila["notas"].append(f"mediana {p50:.3g} fuera de 0.001–1 lineal")
        elif p98 > 10:
            fila["estado"] = "REVISAR" if fila["estado"] == "ok" else fila["estado"]
            fila["notas"].append(f"mediana en rango pero p98 {p98:.3g} muy alto (escena anómala)")
        if fila["valido_pct"] < 50:
            fila["estado"] = "REVISAR" if fila["estado"] == "ok" else fila["estado"]
            fila["notas"].append("menos de 50% de píxeles válidos (¿frame parcial?)")
    return fila


def revisar_generico(ruta, grupo: str) -> dict:
    fila = {"coleccion": grupo, "archivo": ruta.name, "estado": "ok", "notas": []}
    try:
        with rasterio.open(ruta) as ds:
            a = ds.read(1)
            ok = a != (ds.nodata if ds.nodata is not None else 0)
            fila.update(crs=str(ds.crs), px=f"{ds.width}x{ds.height}", res=round(abs(ds.transform.a), 2),
                        dtype=ds.dtypes[0], mb=round(ruta.stat().st_size / 1e6, 1),
                        valido_pct=round(100 * ok.mean(), 1))
            if ok.any():
                p2, p50, p98 = np.percentile(a[ok], [2, 50, 98])
                fila.update(p02=float(p2), p50=float(p50), p98=float(p98),
                            min=float(a[ok].min()), max=float(a[ok].max()))
            if ds.crs is None:
                fila["estado"] = "MAL"; fila["notas"].append("sin CRS")
            if fila["valido_pct"] < 90:
                fila["estado"] = "REVISAR"; fila["notas"].append("cobertura < 90%")
    except Exception as e:  # noqa: BLE001
        fila.update(estado="MAL", notas=[f"no abre: {e}"])
    return fila


def quicklooks(filas: list[dict], zona: str) -> list[str]:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    grupos = defaultdict(list)
    for f in filas:
        if f.get("capa") == "HVHV" and f["estado"] != "MAL":
            grupos[(f["coleccion"], f["track"], f["frame"])].append(f)
    salida_dir = META / "quicklooks"
    salida_dir.mkdir(parents=True, exist_ok=True)
    hechos = []
    for (col, track, frame), lst in sorted(grupos.items()):
        lst.sort(key=lambda f: f["fecha"])
        # para el antes/después se prefieren fechas con valores en rango (las anómalas se listan arriba)
        sanas = [f for f in lst if not any(n.startswith("mediana") for n in f["notas"])]
        lst = sanas or lst
        par = [lst[0], lst[-1]] if len(lst) > 1 else [lst[0]]
        dbs = []
        for f in par:
            with rasterio.open(RAW / col / f["archivo"]) as ds:
                # se lee decimado (overview) para que el PNG sea liviano
                esc = max(1, int(np.ceil(max(ds.width, ds.height) / 1400)))
                a = ds.read(1, out_shape=(ds.height // esc, ds.width // esc))
            with np.errstate(divide="ignore", invalid="ignore"):
                dbs.append(np.where(a > 0, 10 * np.log10(a), np.nan))
        todos = np.concatenate([d[np.isfinite(d)] for d in dbs]) if dbs else np.array([])
        if todos.size == 0:
            continue
        vmin, vmax = np.percentile(todos, [2, 98])
        fig, ejes = plt.subplots(1, len(par), figsize=(7 * len(par), 7.4), squeeze=False)
        for ax, f, d, rot in zip(ejes[0], par, dbs, ["antes", "después"]):
            im = ax.imshow(d, cmap="gray", vmin=vmin, vmax=vmax, interpolation="nearest")
            ax.set_title(f"{rot if len(par) > 1 else ''} {f['fecha'][:4]}-{f['fecha'][4:6]}-{f['fecha'][6:]}"
                         f"  ({f['valido_pct']}% válido)")
            ax.set_xticks([]); ax.set_yticks([])
        fig.colorbar(im, ax=ejes[0].tolist(), shrink=0.75, label="HVHV (dB), estirado 2–98 %")
        fig.suptitle(f"{zona} · NISAR GCOV {col.replace('nisar_', '').upper()} · T{track} F{frame} · HVHV")
        png = salida_dir / f"{zona}_{col}_T{track}_F{frame}_HVHV_antes_despues.png"
        fig.savefig(png, dpi=110, bbox_inches="tight")
        plt.close(fig)
        hechos.append(rel(png))
    return hechos


def main() -> None:
    cfg = cargar_config()
    filas = []
    for col in ("nisar_provisional", "nisar_validated"):
        for ruta in sorted((RAW / col).glob("*.tif")):
            filas.append(revisar_nisar(ruta, col))
    for ruta in sorted((RAW / "sentinel2").glob("*.tif")):
        filas.append(revisar_generico(ruta, "sentinel2"))

    pd.set_option("display.width", 250, "display.max_rows", 2000, "display.max_columns", 30,
                  "display.max_colwidth", 70)
    if filas:
        df = pd.DataFrame(filas)
        df["notas"] = df["notas"].apply("; ".join)
        cols = [c for c in ["coleccion", "archivo", "crs", "px", "res", "dtype", "valido_pct",
                            "p02", "p50", "p98", "mb", "estado", "notas"] if c in df.columns]
        print(df[cols].to_string(index=False))
        df.to_csv(META / "verificacion.csv", index=False)

        nis = df[df["coleccion"].str.startswith("nisar")]
        if len(nis):
            print("\n=== NISAR: coherencia de la pila ===")
            for (col, track, frame), g in nis.groupby(["coleccion", "track", "frame"]):
                print(f"  {col} T{track} F{frame}: {g['fecha'].nunique()} fechas "
                      f"({g['fecha'].min()}–{g['fecha'].max()}), CRS {sorted(set(g['crs']))}, "
                      f"tamaños {sorted(set(g['px']))}, res {sorted(set(g['res']))} m")
                if g["px"].nunique() > 1 or g["crs"].nunique() > 1:
                    print("    OJO: tamaños o CRS distintos entre fechas; habrá que alinear al procesar.")
        print("\n=== Estado ===")
        print(df.groupby(["coleccion", "estado"]).size().to_string())
        qs = quicklooks(filas, cfg["nombre"])
        print("\nQuicklooks:" + ("".join(f"\n  {q}" for q in qs) if qs else " ninguno (no hay HVHV)"))
    else:
        df = None
        print("No hay GeoTIFF todavía en data/raw/.")

    print("\n=== Otros archivos ===")
    for p in [RAW / "firms" / "bolivia_2026.csv", RAW / "firms" / f"{cfg['nombre']}_2026.csv",
              RAW / "boundaries" / "bolivia_adm1.geojson", META / "nisar_escenas.csv",
              META / "nisar_huellas_bolivia.geojson", META / "manifest.json"]:
        print(f"  {'ok     ' if p.exists() and p.stat().st_size else 'FALTA  '} {rel(p)}"
              + (f"  ({p.stat().st_size / 1e6:.2f} MB)" if p.exists() else ""))

    print("\n=== Espacio usado ===")
    for sub in sorted(p for p in RAW.iterdir() if p.is_dir()):
        print(f"  {rel(sub):32s} {gb_usados(sub):7.3f} GB")
    print(f"  {rel(META):32s} {gb_usados(META):7.3f} GB")
    total = gb_usados(DATA)
    print(f"  TOTAL data/                      {total:7.3f} GB (límite {cfg.get('limite_gb', 5)} GB)")

    if df is not None and (df["estado"] == "MAL").any():
        sys.exit(1)


if __name__ == "__main__":
    main()
