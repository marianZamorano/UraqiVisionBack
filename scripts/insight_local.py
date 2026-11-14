#!/usr/bin/env python3
"""Ejecuta Insight en local: lee una solicitud JSON por stdin y escribe la respuesta JSON.

Uso: echo '{"station_id":"…","question":"…","lang":"es"}' | npm run insight:local -- <estacion.json>
La clave del proveedor y los límites se leen del entorno (INSIGHT_PROVIDER_API_KEY, INSIGHT_MAX_…).
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from insight.interfaz.api import responder
from insight.dominio.contenido import Contenido


def main(argv):
    if len(argv) != 2:
        print("Uso: insight_local.py <estacion.json> < solicitud.json", file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        contenido = Contenido.desde_dict(json.load(f))
    cuerpo = json.load(sys.stdin)
    status, respuesta = responder(cuerpo, sesion="local", env=os.environ, contenido=contenido)
    json.dump({"status": status, **respuesta}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
