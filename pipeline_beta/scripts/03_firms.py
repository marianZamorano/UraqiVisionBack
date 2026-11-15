#!/usr/bin/env python
"""03 - Focos de calor FIRMS (VIIRS SNPP, VIIRS NOAA-20 y MODIS) de toda Bolivia.

Usa la API de área de FIRMS:
  https://firms.modaps.eosdis.nasa.gov/api/area/csv/<MAP_KEY>/<FUENTE>/<O,S,E,N>/<DIAS>/<FECHA>
La API limita los días por pedido, así que el periodo se parte en tramos
(config/aoi.yaml: firms.dias_por_pedido). Cada tramo se guarda en data/raw/firms/tramos/
y no se vuelve a pedir si ya está completo.

Para cada sensor se usa el producto estándar (_SP) donde existe y NRT para lo más
reciente, según lo que informa el endpoint data_availability.

Salida: data/raw/firms/bolivia_2026.csv y <nombre>_2026.csv (recorte a la caja).
"""
from __future__ import annotations

import argparse
import io
import os
import sys
from datetime import date, timedelta

import pandas as pd
import requests

from _comun import (RAW, a_fecha, actualizar_manifest, caja, cargar_config, con_reintentos,
                    hoy_utc, rel)

API = "https://firms.modaps.eosdis.nasa.gov/api"
AYUDA_KEY = """\
No hay FIRMS_MAP_KEY en el entorno, así que salto FIRMS (lo demás no depende de esto).
Cómo sacarla gratis (1 minuto):
  1. Entra a https://firms.modaps.eosdis.nasa.gov/api/map_key/
  2. Escribe tu correo y pide la MAP_KEY; llega al instante por correo.
  3. Ponla en .env como FIRMS_MAP_KEY=... y corre `make firms`.
"""


def pedir(url: str, key: str) -> str:
    r = requests.get(url, timeout=120)
    if r.status_code == 429 or "exceed" in r.text[:300].lower():
        raise RuntimeError("límite de transacciones de FIRMS alcanzado")
    r.raise_for_status()
    return r.text


def disponibilidad(key: str) -> dict[str, tuple[date, date]]:
    txt = con_reintentos(pedir, f"{API}/data_availability/csv/{key}/ALL", key, que="FIRMS disponibilidad")
    df = pd.read_csv(io.StringIO(txt))
    if not {"data_id", "min_date", "max_date"} <= set(df.columns):
        raise SystemExit(f"Respuesta inesperada de FIRMS (¿MAP_KEY inválida?): {txt[:200]!r}")
    return {r.data_id: (a_fecha(r.min_date), a_fecha(r.max_date)) for r in df.itertuples()}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--forzar", action="store_true", help="vuelve a pedir todos los tramos")
    args = ap.parse_args()

    key = os.environ.get("FIRMS_MAP_KEY", "").strip()
    if not key:
        print(AYUDA_KEY)
        return  # código 0 a propósito: el resto del flujo debe poder seguir

    cfg = cargar_config()
    o, s, e, n = caja(cfg, "bolivia")
    area = f"{o},{s},{e},{n}"
    inicio, hoy = a_fecha(cfg["firms"]["inicio"]), hoy_utc()
    paso = int(cfg["firms"]["dias_por_pedido"])
    dest = RAW / "firms"
    tramos_dir = dest / "tramos"
    tramos_dir.mkdir(parents=True, exist_ok=True)

    disp = disponibilidad(key)
    partes, fallos, pedidos = [], [], 0
    for sensor in cfg["firms"]["sensores"]:
        sp, nrt = disp.get(f"{sensor}_SP"), disp.get(f"{sensor}_NRT")
        txt = lambda r: f"{r[0]}..{r[1]}" if r else "no disponible"  # noqa: E731
        print(f"{sensor}: SP {txt(sp)} | NRT {txt(nrt)}")
        d = inicio
        while d <= hoy:
            fin = min(d + timedelta(days=paso - 1), hoy)
            # SP si cubre el tramo entero; si no, NRT
            fuente = f"{sensor}_SP" if sp and sp[0] <= d and fin <= sp[1] else f"{sensor}_NRT"
            ndias = (fin - d).days + 1
            f = tramos_dir / f"{fuente}_{d:%Y%m%d}_{ndias}d.csv"
            cerrado = fin < hoy - timedelta(days=2)     # los tramos recientes aún reciben focos
            if args.forzar or not (f.exists() and cerrado):
                url = f"{API}/area/csv/{key}/{fuente}/{area}/{ndias}/{d:%Y-%m-%d}"
                try:
                    txt = con_reintentos(pedir, url, key, intentos=5, espera=15, que=f"FIRMS {fuente} {d}")
                    if not txt.lstrip().lower().startswith("latitude"):
                        raise RuntimeError(f"respuesta inesperada: {txt[:150]!r}")
                    tmp = f.with_suffix(".parcial")
                    tmp.write_text(txt, encoding="utf-8")
                    os.replace(tmp, f)
                    pedidos += 1
                except Exception as ex:  # noqa: BLE001
                    msg = str(ex).replace(key, "<MAP_KEY>")
                    print(f"  X {fuente} {d}: {msg}")
                    fallos.append(f"{fuente} {d}: {msg}")
                    d = fin + timedelta(days=1)
                    continue
            df = pd.read_csv(f)
            if len(df):
                df["sensor"], df["fuente"] = sensor, fuente
                partes.append(df)
            d = fin + timedelta(days=1)

    if not partes:
        print("FIRMS no devolvió ningún foco." + (" Hubo fallos." if fallos else ""))
        sys.exit(1 if fallos else 0)

    todo = pd.concat(partes, ignore_index=True)
    todo = todo[pd.to_datetime(todo["acq_date"]).dt.date >= inicio]
    todo = todo.drop_duplicates(["sensor", "latitude", "longitude", "acq_date", "acq_time"])
    nota = "caja aproximada de Bolivia (incluye franjas de países vecinos)"
    adm1 = RAW / "boundaries" / "bolivia_adm1.geojson"
    if adm1.exists():
        import geopandas as gpd
        pais = gpd.read_file(adm1).union_all()
        pts = gpd.GeoSeries(gpd.points_from_xy(todo["longitude"], todo["latitude"]), crs=4326)
        todo = todo[pts.within(pais).values]
        nota = "filtrado al polígono de Bolivia (geoBoundaries ADM1)"
    else:
        print("  Nota: aún no existe bolivia_adm1.geojson; el CSV queda con la caja del país. "
              "Corre 05 y luego 03 otra vez para filtrarlo al polígono.")
    todo = todo.sort_values(["acq_date", "acq_time", "sensor"])
    f_bol = dest / "bolivia_2026.csv"
    todo.to_csv(f_bol, index=False)

    co, cs, ce, cn = caja(cfg)
    rec = todo[todo["longitude"].between(co, ce) & todo["latitude"].between(cs, cn)]
    f_rec = dest / f"{cfg['nombre']}_2026.csv"
    rec.to_csv(f_rec, index=False)

    actualizar_manifest("firms", "bolivia_2026", {
        "ruta": rel(f_bol), "ruta_recorte": rel(f_rec), "focos": len(todo), "focos_caja": len(rec),
        "desde": str(inicio), "hasta": str(todo["acq_date"].max()), "ambito": nota,
        "por_fuente": todo.groupby("fuente").size().to_dict(), "fallos": fallos})
    print(f"\n{len(todo)} focos en Bolivia ({nota}); {len(rec)} dentro de la caja. "
          f"{pedidos} pedidos nuevos a la API.")
    print(todo.groupby(["sensor", "fuente"]).size().to_string())
    print(f"Guardado: {rel(f_bol)} y {rel(f_rec)}")
    if fallos:
        print(f"{len(fallos)} tramos fallaron; vuelve a correr para completarlos.")
        sys.exit(1)


if __name__ == "__main__":
    main()
