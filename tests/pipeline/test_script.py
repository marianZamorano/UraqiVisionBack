import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SINTETICO = {
    "estacion": "san-ignacio",
    "version_pipeline": "0.1.0",
    "granulos": [{"nombre": "NISAR_SINTETICO_0001", "fecha": "2026-08-01T12:00:00Z", "orbita": 42,
                  "crid": "CRID-SINTETICO", "madurez": "PROVISIONAL", "suma": "sha256:0000"}],
}


def ejecutar(tmp_path, datos):
    archivo = tmp_path / "manifest.json"
    archivo.write_text(json.dumps(datos), encoding="utf-8")
    return subprocess.run([sys.executable, str(RAIZ / "scripts" / "validar_manifiesto.py"), str(archivo)],
                          capture_output=True, text=True, timeout=60)


def test_el_comando_acepta_un_manifiesto_valido(tmp_path):
    r = ejecutar(tmp_path, SINTETICO)
    assert r.returncode == 0, r.stderr
    assert "válido" in r.stdout


def test_el_comando_rechaza_un_manifiesto_con_beta(tmp_path):
    malo = json.loads(json.dumps(SINTETICO))
    malo["granulos"][0]["madurez"] = "BETA"
    r = ejecutar(tmp_path, malo)
    assert r.returncode == 1
    assert "BETA" in r.stderr
