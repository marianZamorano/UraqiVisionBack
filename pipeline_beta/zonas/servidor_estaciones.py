#!/usr/bin/env python3
"""Servidor LOCAL de desarrollo: expone las estaciones publicadas (§17.3) para que la web las lea.

Solo biblioteca estándar. Escanea nasa/zonas/*/publicado/<id>/ y ofrece:

  GET /api/estaciones                     lista de estaciones (resumen)
  GET /api/estaciones/<id>                station en la forma `PublishedStation` de la web
                                          (web/src/contracts/view-state.ts), adaptada aquí
  GET /estaciones/<id>/<archivo>          archivos publicados tal cual (station.json, scars.geojson,
                                          hectares.csv, views/…, etc.)

No es la arquitectura final: el documento (§17) prevé archivos estáticos en el hospedaje (DP-06 pendiente).
La adaptación de formato es PROVISIONAL mientras se acuerdan los conflictos C1–C9 con la web.
Uso: python3 servidor_estaciones.py [--puerto 8787]
"""
from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ZONAS = Path(__file__).resolve().parent
mimetypes.add_type("application/geo+json", ".geojson")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("text/csv", ".csv")
DEPTOS = {"Santa Cruz": "santa-cruz", "Beni": "beni", "La Paz": "la-paz", "Cochabamba": "cochabamba",
          "Pando": "pando", "Oruro": "oruro", "Potosí": "potosi", "Tarija": "tarija", "Chuquisaca": "chuquisaca"}


def estaciones() -> dict[str, Path]:
    rutas = sorted(ZONAS.parent.glob("publicado/*/station.json")) + sorted(ZONAS.glob("*/publicado/*/station.json"))
    return {p.parent.name: p.parent for p in rutas}          # nasa/publicado (San Ignacio) y cada zona


def capas_agua() -> dict[str, Path]:
    """Mapas de agua de época seca (10_mapa_agua.py): referencia exploratoria, fuera del MVP (§8.2)."""
    return {p.parent.name: p.parent for p in sorted(ZONAS.glob("*/publicado/*_agua/resumen.json"))}


def a_web(carpeta: Path) -> dict:
    """station.json del backend → PublishedStation de la web (provisional, ver C1–C9)."""
    s = json.loads((carpeta / "station.json").read_text(encoding="utf-8"))
    m = json.loads((carpeta / "manifest.json").read_text(encoding="utf-8"))
    fechas = [f["fecha"] for f in s["fechas"] if f["estado"] == "ok"]
    base = [f["fecha"] for f in s["fechas"] if f.get("rol") == "linea_base"]
    filas = (carpeta / "hectares.csv").read_text(encoding="utf-8").strip().splitlines()
    ult = dict(zip(filas[0].split(","), filas[-1].split(",")))          # última fecha (RN-06: con su rango)
    ha = lambda k, sep: f"{float(ult[k]):,.0f}".replace(",", sep)            # miles: «.» en es, «,» en en
    total = {lg: f"{ha('hectareas', sp)} ha ({ha('rango_inferior', sp)}–{ha('rango_superior', sp)})"
             for lg, sp in (("es", "."), ("en", ","))}
    o = s["orbita"]
    return {
        "stationId": s["id"],
        "departmentId": DEPTOS.get(s.get("departamento", ""), s.get("departamento", "").lower()),
        "label": s["nombre"],
        # REAL solo si el backend la publicó con zonas de control, umbrales calibrados, procedencia completa y validación
        # que encierra al radar; si no, DEMO (RN-04). Decisión provisional mientras se acuerda C1 con M-PUBLICACIÓN.
        "evidenceMode": "REAL" if s.get("estado") == "publicada_con_limites" else "DEMO",
        "area": {"value": float(ult["hectareas"]), "unit": "ha", "source": "NISAR L2 GCOV PROVISIONAL",
                 "method": "Caída sostenida de HV, umbral −2 dB sin calibrar (exploratorio)",
                 "status": "limited", "reason": s["aviso"]["es"]},
        "orbit": f"{o['track']:03d}{o['direccion']} · frame {o['frame']} · {o['coleccion']} {','.join(o['crid'])}",
        "periods": [{"name": "serie útil", "before": base[0] if base else None, "after": fechas[-1] if fechas else None}],
        "provenance": {"source": "NISAR (NASA/ISRO, ASF) · FIRMS · Sentinel-2",
                       "publishedAt": json.loads((carpeta / "quality.json").read_text())["generado_utc"],
                       "version": m["version_pipeline"]},
        # Resumen en lenguaje simple. El aviso de borrador y las fechas excluidas los muestra la web en su lugar.
        "summary": {
            "es": f"Radar NISAR sobre esta zona, {len(fechas)} fechas útiles entre el {fechas[0]} y el {fechas[-1]}. "
                  f"Al {ult['fecha']}, la señal de vegetación (HV) cayó de forma sostenida en {total['es']}.",
            "en": f"NISAR radar over this area, {len(fechas)} usable dates between {fechas[0]} and {fechas[-1]}. "
                  f"By {ult['fecha']}, the vegetation signal (HV) dropped in a sustained way over {total['en']}.",
        },
        "_archivos": {k: f"/estaciones/{s['id']}/{k}" for k in s["archivos"] + ["station.json"]},
    }


class Manejador(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def _json(self, obj, code=200):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo))); self.end_headers(); self.wfile.write(cuerpo)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        partes = [p for p in unquote(urlparse(self.path).path).split("/") if p]
        est = estaciones()
        try:
            if partes == ["api", "estaciones"]:
                lista = []
                for k, v in est.items():
                    st = json.loads((v / "station.json").read_text(encoding="utf-8"))
                    lista.append({"stationId": k, "label": st["nombre"], "estado": st["estado"],
                                  "departamento": st.get("departamento"), "departmentId": DEPTOS.get(st.get("departamento", ""))})
                return self._json(sorted(lista, key=lambda e: (e["departamento"] or "", e["label"]["es"])))
            if len(partes) == 3 and partes[:2] == ["api", "estaciones"]:
                if partes[2] not in est:
                    return self._json({"error": f"Estación {partes[2]} no encontrada"}, 404)
                return self._json(a_web(est[partes[2]]))
            if partes == ["api", "agua"]:
                lista = []
                for k, v in capas_agua().items():
                    r = json.loads((v / "resumen.json").read_text(encoding="utf-8"))
                    lista.append({"id": k, "nombre": r.get("nombre", {"es": k, "en": k}), "estado": r.get("estado"),
                                  "esquinas_lonlat": r["esquinas_lonlat"], "imagen": f"/agua/{k}/{r.get('capa', 'agua_capa.webp')}",
                                  "ha_agua_permanente": r.get("ha_agua_permanente"), "ha_agua_ocasional": r.get("ha_agua_ocasional"),
                                  "fechas": r.get("fechas_sanas", [])})
                return self._json(lista)
            agua = capas_agua()
            if len(partes) >= 3 and partes[0] == "agua" and partes[1] in agua:
                est = {partes[1]: agua[partes[1]]}; partes = ["estaciones", *partes[1:]]
            if len(partes) >= 3 and partes[0] == "estaciones" and partes[1] in est:
                raiz = est[partes[1]].resolve()
                f = (raiz / "/".join(partes[2:])).resolve()
                if raiz not in f.parents or not f.is_file():
                    return self._json({"error": "Archivo no encontrado"}, 404)
                datos = f.read_bytes()
                self.send_response(200); self._cors()
                self.send_header("Content-Type", mimetypes.guess_type(f.name)[0] or "application/octet-stream")
                self.send_header("Content-Length", str(len(datos))); self.end_headers(); self.wfile.write(datos)
                return
            return self._json({"error": "Ruta no encontrada", "rutas": ["/api/estaciones", "/api/estaciones/<id>",
                                                                        "/estaciones/<id>/<archivo>", "/api/agua", "/agua/<id>/<archivo>"]}, 404)
        except (OSError, KeyError, json.JSONDecodeError) as e:
            return self._json({"error": f"{type(e).__name__}: {e}"}, 500)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--puerto", type=int, default=8787)
    a = ap.parse_args()
    print(f"Estaciones: {', '.join(estaciones()) or 'ninguna'} · http://127.0.0.1:{a.puerto}/api/estaciones", flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.puerto), Manejador).serve_forever()
