#!/usr/bin/env bash
# Actualiza cada estación publicada y avisa de las detecciones nuevas (RF-40, Futuro; AVISO, nunca ALERTA).
# Para cada zona con publicado/<id>/station.json: baja las escenas NISAR nuevas de su órbita (02 salta lo que ya
# existe), verifica (07), vuelve a publicar (08) y manda los avisos nuevos al servidor de alertas (09).
#
# Variables: AVISOS_URL (POST /notificar del servidor), AVISOS_TOKEN (su X-Token), AVISOS_WEB (base de la web).
# Sin AVISOS_URL corre en simulación: publica, pero no envía nada.
# Programarlo (ejemplo, todos los días a las 06:00, con las variables en un archivo que no va a git):
#   0 6 * * *  set -a; . "$HOME/.config/uraqi-avisos.env"; set +a; /ruta/a/zonas/actualizar_y_avisar.sh >> "$HOME/uraqi-avisos.log" 2>&1
set -u
ZONAS=$(cd "$(dirname "$0")" && pwd)
export HOST_UID=$(id -u) HOST_GID=$(id -g)
MODO=$([ -n "${AVISOS_URL:-}" ] && echo "--enviar" || echo "")
echo "===== $(date -u +%FT%TZ) · modo: ${MODO:-simulación}"

for est in "$ZONAS"/*/publicado/*/station.json "$ZONAS"/../publicado/*/station.json; do
  [ -f "$est" ] || continue
  Z=$(cd "$(dirname "$est")/../.." && pwd)            # carpeta de la zona (contiene config/ y scripts/)
  read -r TRACK DIR < <(python3 -c "import json,sys; o=json.load(open(sys.argv[1]))['orbita']; print(o['track'], o['direccion'])" "$est")
  echo "== $(basename "$(dirname "$est")") · zona $(basename "$Z") · órbita $TRACK$DIR"
  cd "$Z" || continue
  R() { docker compose -p "uraqi-$(basename "$Z")" run --rm uraqi python "$@" 2>&1 | grep -vE "Container |Network "; }
  R scripts/02_nisar_recortar.py --coleccion provisional --track "$TRACK" --dir "$DIR" | grep -E "Listo|FALL|DETENIDO"
  R scripts/07_verificar.py > data/meta/verificar.log
  R scripts/08_publicar_borrador.py | grep -E "Publicado|Error|Traceback"
  # 09 corre con la red del host para llegar al servidor de alertas aunque esté en 127.0.0.1.
  docker run --rm --network host -u "$HOST_UID:$HOST_GID" -v "$Z":/work -w /work \
    -e AVISOS_URL -e AVISOS_TOKEN -e AVISOS_WEB uraqivision:latest python scripts/09_enviar_avisos.py $MODO
done
