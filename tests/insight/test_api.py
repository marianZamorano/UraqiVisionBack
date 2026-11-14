import json
import subprocess
import sys
from pathlib import Path

from insight.interfaz.api import responder
from insight.dominio.limites import Limites
from insight.infraestructura.adaptadores import ProveedorNoConfigurado

RAIZ = Path(__file__).resolve().parents[2]
ENV_COMPLETO = {"INSIGHT_MAX_PREGUNTAS_SESION": "5", "INSIGHT_MAX_CARACTERES": "200"}


def test_sin_clave_del_proveedor_responde_plantilla_sin_error(contenido):
    status, cuerpo = responder({"station_id": "san-ignacio", "question": "¿Qué es SAR?", "lang": "es"},
                               sesion="s1", env=ENV_COMPLETO, contenido=contenido)
    assert status == 200
    assert cuerpo["source"] == "plantilla"


def test_sin_limites_en_el_entorno_responde_503(contenido, proveedor_falso):
    status, cuerpo = responder({"station_id": "san-ignacio", "question": "¿Qué es SAR?", "lang": "es"},
                               sesion="s1", env={}, contenido=contenido, proveedor=proveedor_falso("x", ["resumen"]))
    assert status == 503
    assert cuerpo["error"] == "limites_no_configurados"


def test_con_limites_y_proveedor_responde_con_cita(contenido, proveedor_falso):
    status, cuerpo = responder({"station_id": "san-ignacio", "question": "¿Qué es SAR?", "lang": "es"},
                               sesion="s1", env=ENV_COMPLETO, contenido=contenido,
                               proveedor=proveedor_falso("SAR es radar.", ["glosario-sar"]))
    assert status == 200
    assert cuerpo == {"answer": "SAR es radar.", "citations": ["glosario-sar"], "source": "ia"}


def test_el_punto_de_entrada_local_responde_por_stdin(tmp_path):
    contenido = tmp_path / "estacion.json"
    contenido.write_text(json.dumps({
        "id": "san-ignacio", "nombre": {"es": "San Ignacio", "en": "San Ignacio"},
        "secciones": {"resumen": {"es": "Resumen.", "en": "Summary."}},
        "preguntas_sugeridas": {"es": ["a", "b", "c"], "en": ["a", "b", "c"]},
    }), encoding="utf-8")
    env = {"PATH": "", "INSIGHT_MAX_PREGUNTAS_SESION": "5", "INSIGHT_MAX_CARACTERES": "200"}
    entrada = json.dumps({"station_id": "san-ignacio", "question": "¿Qué muestra?", "lang": "en"})
    r = subprocess.run([sys.executable, str(RAIZ / "scripts" / "insight_local.py"), str(contenido)],
                       input=entrada, capture_output=True, text=True, env=env, timeout=60)
    assert r.returncode == 0, r.stderr
    cuerpo = json.loads(r.stdout)
    assert cuerpo["source"] == "plantilla"
