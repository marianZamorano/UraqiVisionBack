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


def a_web(carpeta: Path) -> dict:
    """station.json del backend → PublishedStation de la web (provisional, ver C1–C9)."""
    s = json.loads((carpeta / "station.json").read_text(encoding="utf-8"))
    m = json.loads((carpeta / "manifest.json").read_text(encoding="utf-8"))
    fechas = [f["fecha"] for f in s["fechas"] if f["estado"] == "ok"]
    base = [f["fecha"] for f in s["fechas"] if f.get("rol") == "linea_base"]
    filas = (carpeta / "hectares.csv").read_text(encoding="utf-8").strip().splitlines()
    ult = dict(zip(filas[0].split(","), filas[-1].split(",")))          # última fecha (RN-06: con su rango)
    total = f"{float(ult['hectareas']):,.0f} ha (rango {float(ult['rango_inferior']):,.0f}–{float(ult['rango_superior']):,.0f})"
    excl = [f"{f['fecha']} ({f['estado']})" for f in s["fechas"] if f["estado"] != "ok"]
    o = s["orbita"]
    return {
        "stationId": s["id"],
        "departmentId": DEPTOS.get(s.get("departamento", ""), s.get("departamento", "").lower()),
        "label": s["nombre"],
        # C1 sin acordar: datos NISAR reales pero con umbrales sin calibrar → se marcan DEMO (RN-04).
        "evidenceMode": "DEMO",
        "area": {"value": float(ult["hectareas"]), "unit": "ha", "source": "NISAR L2 GCOV PROVISIONAL",
                 "method": "Caída sostenida de HV, umbral −2 dB sin calibrar (exploratorio)",
                 "status": "limited", "reason": s["aviso"]["es"]},
        "orbit": f"{o['track']:03d}{o['direccion']} · frame {o['frame']} · {o['coleccion']} {','.join(o['crid'])}",
        "periods": [{"name": "serie útil", "before": base[0] if base else None, "after": fechas[-1] if fechas else None}],
        "provenance": {"source": "NISAR (NASA/ISRO, ASF) · FIRMS · Sentinel-2",
                       "publishedAt": json.loads((carpeta / "quality.json").read_text())["generado_utc"],
                       "version": m["version_pipeline"]},
        "summary": {
            "es": f"{s['aviso']['es']} Fechas útiles: {', '.join(fechas)}. Excluidas: {', '.join(excl) or 'ninguna'}. "
                  f"Caída sostenida de HV al {ult["fecha"]}: {total}, en parches clasificados en cuatro clases candidatas.",
            "en": f"{s['aviso']['en']} Usable dates: {', '.join(fechas)}. Excluded: {', '.join(excl) or 'none'}. "
                  f"Sustained HV drop by {ult["fecha"]}: {total}, in patches with four candidate classes.",
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
                return self._json([{"stationId": k, "label": json.loads((v / "station.json").read_text())["nombre"],
                                    "estado": json.loads((v / "station.json").read_text())["estado"]} for k, v in est.items()])
            if len(partes) == 3 and partes[:2] == ["api", "estaciones"]:
                if partes[2] not in est:
                    return self._json({"error": f"Estación {partes[2]} no encontrada"}, 404)
                return self._json(a_web(est[partes[2]]))
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
                                                                        "/estaciones/<id>/<archivo>"]}, 404)
        except (OSError, KeyError, json.JSONDecodeError) as e:
            return self._json({"error": f"{type(e).__name__}: {e}"}, 500)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--puerto", type=int, default=8787)
    a = ap.parse_args()
    print(f"Estaciones: {', '.join(estaciones()) or 'ninguna'} · http://127.0.0.1:{a.puerto}/api/estaciones", flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.puerto), Manejador).serve_forever()
