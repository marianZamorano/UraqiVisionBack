#!/usr/bin/env python3
"""Inventario de escenas NISAR L2 GCOV sobre un recuadro, desde el catálogo CMR de la NASA (#60; MC-01, RF-26).

No necesita cuenta: CMR es público. Consulta PROVISIONAL y VALIDATED (nunca BETA, RN-02) y escribe un CSV con una
fila por gránulo: órbita, frame, polarizaciones, madurez, CRID, fechas en UTC y hora de Bolivia (RN-07), tamaño,
enlaces y huella (RF-26). Exploratorio: el recuadro por defecto es provisional (DP-08).

Uso:
  python scripts/nisar_inventario.py
  python scripts/nisar_inventario.py --bbox -61.2,-16.6,-60.7,-16.1 --salida datos/exploracion/inventario_nisar.csv
"""
import argparse
import csv
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from exploracion.nisar import BBOX_EXPLORATORIO, COLECCIONES, fila_inventario

CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"
CAMPOS = [
    "madurez", "granulo", "orbita", "track", "direccion", "frame", "modo_polarizacion", "polarizaciones",
    "crid", "inicio_utc", "fin_utc", "inicio_bolivia", "tamano_mb", "url_h5", "url_vista_previa", "huella_wkt",
]


def consultar(concepto: str, bbox: str, desde: str | None):
    """Todas las entradas de CMR para una colección, paginando con CMR-Search-After."""
    parametros = {"collection_concept_id": concepto, "bounding_box": bbox, "page_size": 200, "sort_key": "start_date"}
    if desde:
        parametros["temporal"] = f"{desde}T00:00:00Z,"
    url = CMR + "?" + urllib.parse.urlencode(parametros)
    despues = None
    while True:
        pedido = urllib.request.Request(url, headers={"CMR-Search-After": despues} if despues else {})
        with urllib.request.urlopen(pedido, timeout=60) as r:
            entradas = json.load(r)["feed"]["entry"]
            despues = r.headers.get("CMR-Search-After")
        yield from entradas
        if not entradas or not despues:
            return


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # la consola de Windows (cp1252) no imprime «→» ni «·»
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--bbox", default=",".join(map(str, BBOX_EXPLORATORIO)), help="oeste,sur,este,norte (grados)")
    p.add_argument("--desde", default=None, help="fecha mínima de adquisición, AAAA-MM-DD")
    p.add_argument("--salida", default="datos/exploracion/inventario_nisar.csv")
    a = p.parse_args()

    filas = []
    for madurez, concepto in COLECCIONES.items():
        filas += [fila_inventario(e, madurez) for e in consultar(concepto, a.bbox, a.desde)]

    os.makedirs(os.path.dirname(a.salida) or ".", exist_ok=True)
    with open(a.salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS)
        w.writeheader()
        w.writerows({k: ("" if fila[k] is None else fila[k]) for k in CAMPOS} for fila in filas)

    print(f"Recuadro {a.bbox} (provisional, DP-08) · {len(filas)} gránulos → {a.salida}")
    for madurez in COLECCIONES:
        grupo = [f for f in filas if f["madurez"] == madurez]
        if not grupo:
            print(f"- {madurez}: sin gránulos")
            continue
        fechas = sorted(f["inicio_utc"][:10] for f in grupo)
        orbitas = Counter(f["orbita"] for f in grupo)
        pols = Counter(f["polarizaciones"] for f in grupo)
        print(f"- {madurez}: {len(grupo)} gránulos, {fechas[0]} a {fechas[-1]} (UTC)")
        print(f"  órbitas: {', '.join(f'{o} ({n})' for o, n in sorted(orbitas.items()))}")
        print(f"  polarizaciones: {', '.join(f'{k} ({n})' for k, n in sorted(pols.items()))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
