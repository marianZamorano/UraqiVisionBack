#!/usr/bin/env bash
# Crea una zona aislada en nasa/zonas/<id>/ (copia de scripts y config) y descarga todo para su caja.
# Uso: descargar_zona.sh <id> <nombre> "<descripción>" <oeste> <sur> <este> <norte> [track dir]
#   Sin track/dir usa la recomendación del script 01 (más fechas DHDH y mejor cobertura).
set -u
ID=$1; NOMBRE=$2; DESC=$3; W=$4; S=$5; E=$6; N=$7; TRACK=${8:-}; DIR=${9:-}
BASE=$(cd "$(dirname "$0")/.." && pwd)          # nasa/
Z="$BASE/zonas/$ID"
export HOST_UID=$(id -u) HOST_GID=$(id -g)

if [ ! -d "$Z" ]; then
  mkdir -p "$Z/data/raw/boundaries" "$Z/data/raw/firms" "$Z/data/meta"
  cp -a "$BASE/scripts" "$BASE/config" "$BASE/Makefile" "$BASE/docker-compose.yml" "$BASE/Dockerfile" \
        "$BASE/environment.yml" "$BASE/.dockerignore" "$Z/"
  rm -rf "$Z/scripts/__pycache__"
  ln -s ../../.env "$Z/.env"
  cp "$BASE/data/raw/boundaries/bolivia_adm1.geojson" "$Z/data/raw/boundaries/"
  cp -a "$BASE/data/raw/firms/bolivia_2026.csv" "$BASE/data/raw/firms/tramos" "$Z/data/raw/firms/"
  cp "$BASE/data/meta/nisar_huellas_bolivia.geojson" "$Z/data/meta/"
  python3 - "$Z/config/aoi.yaml" "$NOMBRE" "$DESC" "$W" "$S" "$E" "$N" <<'PY'
import json, re, sys
p, nombre, desc, w, s, e, n = sys.argv[1:]
t = open(p, encoding="utf-8").read()
t = re.sub(r"^nombre: .*$", f"nombre: {nombre}", t, flags=re.M)
t = re.sub(r"^descripcion: .*$", "descripcion: " + json.dumps(desc, ensure_ascii=False), t, flags=re.M)
t = re.sub(r"caja:(.*?)\n  oeste: [-\d.]+\n  sur: [-\d.]+\n  este: [-\d.]+\n  norte: [-\d.]+",
           f"caja:\\1\n  oeste: {w}\n  sur: {s}\n  este: {e}\n  norte: {n}", t, count=1, flags=re.S)
open(p, "w", encoding="utf-8").write(t)
PY
fi

cd "$Z" || exit 1
R() { docker compose -p "uraqi-$ID" run --rm uraqi python "$@" 2>&1 | grep -v -E "Container |Network "; }
echo "##### [$ID] 01 listar"
R scripts/01_nisar_listar.py | tee data/meta/listar.log | sed -n '/RESUMEN/,$p'
if [ -z "$TRACK" ]; then
  REC=$(grep -oE "RECOMENDACIÓN \(no se elige sola\): track [0-9]+ [AD]" data/meta/listar.log | grep -oE "[0-9]+ [AD]$")
  TRACK=${REC% *}; DIR=${REC#* }
fi
echo "##### [$ID] track elegido: $TRACK $DIR"
[ -z "$TRACK" ] && { echo "##### [$ID] sin track recomendado: me detengo"; exit 1; }
echo "##### [$ID] 02 provisional";  R scripts/02_nisar_recortar.py --coleccion provisional --track "$TRACK" --dir "$DIR" | grep -E "Listo|FALL|DETENIDO|No hay|Remoto"
echo "##### [$ID] 02 validated";    R scripts/02_nisar_recortar.py --coleccion validated  --track "$TRACK" --dir "$DIR" | grep -E "Listo|FALL|DETENIDO|No hay|Remoto"
echo "##### [$ID] 03 firms";        R scripts/03_firms.py | tail -1
echo "##### [$ID] 04 sentinel2";    R scripts/04_sentinel2.py | grep -E "ELEGIDA|Ninguna|sin |ya existe"
echo "##### [$ID] 07 verificar";    R scripts/07_verificar.py > data/meta/verificar.log; sed -n '/=== Estado ===/,/Quicklooks/p' data/meta/verificar.log
echo "##### [$ID] FIN"
