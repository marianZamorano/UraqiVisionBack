#!/usr/bin/env python3
"""Valida el manifiesto de una estación: python3 scripts/validar_manifiesto.py <manifest.json>."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from pipeline.manifiesto import ManifiestoInvalido, validar_manifiesto


def main(argv):
    if len(argv) != 2:
        print("Uso: validar_manifiesto.py <manifest.json>", file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as f:
        manifiesto = json.load(f)
    try:
        validar_manifiesto(manifiesto)
    except ManifiestoInvalido as e:
        print(f"manifiesto inválido: {e}", file=sys.stderr)
        return 1
    print("manifiesto válido")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
