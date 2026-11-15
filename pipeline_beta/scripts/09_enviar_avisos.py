#!/usr/bin/env python
"""09 - Avisa al servidor de alertas de las detecciones NUEVAS de una estación publicada (RF-40, Futuro).

Lee publicado/<id>/ (lo escribe 08_publicar_borrador.py) y, por cada fecha con detección CONFIRMADA que todavía no se
avisó, manda un AVISO a POST /notificar del servidor de alertas (server/server.py). Es un AVISO, no una ALERTA: el
dato de NISAR llega días o semanas después de la observación, así que nunca da instrucciones de emergencia (RN-10) y
la causa va como «compatible con…», nunca como certeza (RN-05).

Solo avisa si la estación está «publicada_con_limites» (RN-04). Sin --enviar, muestra lo que mandaría y no envía.

Uso:
  09_enviar_avisos.py [--enviar] [--url URL] [--web URL_WEB] [--destino todos]
Variables de entorno: AVISOS_URL (por defecto http://127.0.0.1:8000/notificar), AVISOS_TOKEN (cabecera X-Token),
AVISOS_WEB (base de la web para el enlace, p. ej. http://127.0.0.1:5173).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from _comun import META, RAIZ, cargar_config, escribir_json

CLASES_ES = {"compatible_quema": "compatible con quema", "perdida_previa": "compatible con pérdida previa de estructura",
             "ambigua": "con evidencia ambigua"}
ESTADO = META / "avisos_enviados.json"


def hora_adquisicion(manifest: dict, fecha: str) -> datetime | None:
    """Hora real de adquisición (UTC) a partir del nombre de la escena (RN-07)."""
    for g in manifest.get("granulos", []):
        m = re.search(r"_(\d{8})T(\d{6})_", g["escena"])
        if g["fecha"] == fecha and m:
            return datetime.strptime(m[1] + m[2], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return None


def preparar(sal, web: str | None) -> tuple[str, list[dict]]:
    estacion = json.loads((sal / "station.json").read_text(encoding="utf-8"))
    est_id = estacion["id"]
    if estacion.get("estado") != "publicada_con_limites":
        return est_id, []          # RN-04: un borrador nunca se avisa
    manifest = json.loads((sal / "manifest.json").read_text(encoding="utf-8"))
    parches = json.loads((sal / "scars.geojson").read_text(encoding="utf-8"))["features"]
    filas = list(csv.DictReader(open(sal / "hectares.csv", encoding="utf-8")))
    avisadas = set(json.loads(ESTADO.read_text()).get(est_id, [])) if ESTADO.exists() else set()
    nombre = estacion["nombre"]["es"]
    bbox = estacion["area"]["bbox_lonlat"]
    avisos, previa = [], None
    for fila in filas:
        fecha = fila["fecha"]
        if fila.get("confirmada") != "si" or fecha in avisadas:
            previa = fila
            continue
        # Superficie NUEVA de esta fecha = acumulado de esta fecha − acumulado de la anterior (con su rango, RN-06).
        nueva = {k: max(0.0, float(fila[k]) - (float(previa[k]) if previa else 0.0))
                 for k in ("hectareas", "rango_inferior", "rango_superior")}
        nuevos = [p["properties"] for p in parches if p["properties"]["fecha_primera_deteccion"] == fecha
                  and p["properties"]["clase"] != "insuficiente"]
        previa = fila
        if not nuevos or nueva["hectareas"] <= 0:
            continue
        por_clase: dict[str, float] = {}
        for p in nuevos:
            por_clase[p["clase"]] = por_clase.get(p["clase"], 0.0) + p["ha"]
        subtipo = max(por_clase, key=por_clase.get)
        obs = hora_adquisicion(manifest, fecha)
        retraso = (datetime.now(timezone.utc) - obs).days if obs else None
        inicio = nuevos[0]["intervalo_inicio"]
        ha, rango = round(nueva["hectareas"]), [round(nueva["rango_inferior"]), round(nueva["rango_superior"])]
        mensaje = (f"El radar NISAR observó pérdida de vegetación en {nombre} entre el {inicio} y el {fecha}: "
                   f"unas {ha} ha nuevas ({rango[0]}–{rango[1]}), sobre todo {CLASES_ES[subtipo]}. "
                   f"Es una observación con {retraso if retraso is not None else '¿?'} días de retraso, no una alerta en tiempo real.")
        avisos.append({"fecha": fecha, "cuerpo": {
            "tipo": "AVISO", "categoria": "PERDIDA_VEGETACION", "mensaje": mensaje, "destino": "todos",
            "datos": {"estacion": est_id, "estacion_nombre": nombre, "subtipo": subtipo,
                      # Reparto de los parches nuevos por clase, en % (los parches se miden con el umbral sensible).
                      "por_clase_pct": {k: round(100 * v / sum(por_clase.values())) for k, v in por_clase.items()},
                      "superficie_ha": ha, "rango_ha": rango,
                      "fecha_observacion_utc": obs.isoformat().replace("+00:00", "Z") if obs else None,
                      "intervalo": [inicio, fecha], "retraso_dias": retraso,
                      "centro_lonlat": [round((bbox[0] + bbox[2]) / 2, 4), round((bbox[1] + bbox[3]) / 2, 4)],
                      "fuente": "NISAR L2 GCOV PROVISIONAL (NASA/ISRO, ASF); análisis UraqiVision",
                      "enlace": f"{web.rstrip('/')}/station/{est_id}" if web else None,
                      "nota": "No es una alerta de emergencia: el dato llega días o semanas después de la observación. "
                              "Ante una emergencia, sigue las instrucciones oficiales (Defensa Civil, SENAMHI)."}}})
    return est_id, avisos


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--enviar", action="store_true", help="envía de verdad; sin esto solo muestra el aviso")
    ap.add_argument("--url", default=os.environ.get("AVISOS_URL", "http://127.0.0.1:8000/notificar"))
    ap.add_argument("--web", default=os.environ.get("AVISOS_WEB"))
    ap.add_argument("--destino", default="todos")
    args = ap.parse_args()

    cfg = cargar_config()
    est_id = cfg.get("estacion", {}).get("id", cfg["nombre"].lower())
    sal = RAIZ / "publicado" / est_id
    if not (sal / "station.json").exists():
        sys.exit(f"No hay estación publicada en {sal}. Corre antes 08_publicar_borrador.py.")
    est_id, avisos = preparar(sal, args.web)
    if not avisos:
        print(f"{est_id}: nada nuevo que avisar (o la estación no está publicada con límites).")
        return

    estado = json.loads(ESTADO.read_text()) if ESTADO.exists() else {}
    if est_id not in estado and len(avisos) > 1:
        # Primera vez para esta estación: no se manda el historial, solo la fecha confirmada más reciente.
        historial = [a["fecha"] for a in avisos[:-1]]
        print(f"{est_id}: primera corrida; se da por avisado el historial ({', '.join(historial)}) y solo se avisa {avisos[-1]['fecha']}")
        if args.enviar:
            estado[est_id] = historial
            escribir_json(ESTADO, estado)
        avisos = avisos[-1:]
    token = os.environ.get("AVISOS_TOKEN", "")
    for a in avisos:
        a["cuerpo"]["destino"] = args.destino
        if not args.enviar:
            print(f"[simulación] {est_id} {a['fecha']} → {args.url}\n{json.dumps(a['cuerpo'], ensure_ascii=False, indent=2)}")
            continue
        req = urllib.request.Request(args.url, data=json.dumps(a["cuerpo"]).encode("utf-8"), method="POST",
                                     headers={"Content-Type": "application/json", **({"X-Token": token} if token else {})})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                print(f"{est_id} {a['fecha']}: enviado → {r.read().decode()}")
            estado.setdefault(est_id, []).append(a["fecha"])          # solo se marca si el servidor lo recibió
            escribir_json(ESTADO, estado)
        except (urllib.error.URLError, TimeoutError) as e:
            print(f"{est_id} {a['fecha']}: NO enviado ({e}); se reintentará en la próxima corrida")


if __name__ == "__main__":
    main()
