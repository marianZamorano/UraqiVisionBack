#!/usr/bin/env python
"""05 - Límites departamentales de Bolivia (ADM1) desde geoBoundaries, a GeoJSON.

Usa la API pública https://www.geoboundaries.org/api/current/gbOpen/BOL/ADM1/ que devuelve
los metadatos y el enlace de descarga (gjDownloadURL). Áreas protegidas: ver README.
"""
from __future__ import annotations

import json
import os

import requests

from _comun import RAW, actualizar_manifest, con_reintentos, rel

API = "https://www.geoboundaries.org/api/current/gbOpen/BOL/ADM1/"


def valido(ruta) -> bool:
    try:
        with open(ruta, encoding="utf-8") as f:
            return len(json.load(f)["features"]) > 0
    except Exception:  # noqa: BLE001
        return False


def bajar_json(url: str) -> dict:
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.json()


def main() -> None:
    salida = RAW / "boundaries" / "bolivia_adm1.geojson"
    if valido(salida):
        print(f"{rel(salida)} ya existe y es válido, salto")
        return
    meta = con_reintentos(bajar_json, API, que="geoBoundaries API")
    gj = con_reintentos(bajar_json, meta["gjDownloadURL"], que="geoBoundaries GeoJSON")
    n = len(gj.get("features", []))
    if n == 0:
        raise SystemExit("El GeoJSON de geoBoundaries vino sin features.")
    salida.parent.mkdir(parents=True, exist_ok=True)
    tmp = salida.with_suffix(".parcial")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False)
    os.replace(tmp, salida)
    nombres = sorted(ft["properties"].get("shapeName", "?") for ft in gj["features"])
    actualizar_manifest("limites", "bolivia_adm1", {
        "ruta": rel(salida), "departamentos": n, "nombres": nombres,
        "fuente": meta.get("boundarySource"), "licencia": meta.get("boundaryLicense"),
        "anio": meta.get("boundaryYearRepresented"), "id": meta.get("boundaryID"),
        "url": meta["gjDownloadURL"]})
    print(f"{n} departamentos: {', '.join(nombres)}")
    print(f"Fuente: {meta.get('boundarySource')} | licencia: {meta.get('boundaryLicense')}")
    print(f"Guardado: {rel(salida)} ({salida.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
