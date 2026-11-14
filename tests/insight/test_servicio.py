import logging

import pytest

from insight.dominio.limites import Limites
from insight.aplicacion.servicio import Insight


def servicio(contenido, proveedor, max_preguntas=5, max_caracteres=200):
    return Insight(contenido, proveedor, Limites(max_preguntas=max_preguntas, max_caracteres=max_caracteres))


def pedir(s, pregunta="¿Qué muestra el mapa?", lang="es", station="san-ignacio", sesion="s1"):
    return s.responder(station_id=station, question=pregunta, lang=lang, sesion=sesion)


def test_respuesta_con_cita_valida_viene_del_proveedor(contenido, proveedor_falso):
    p = proveedor_falso(texto="El mapa muestra el cambio.", citas=["metodo"])
    status, cuerpo = pedir(servicio(contenido, p))
    assert status == 200
    assert cuerpo == {"answer": "El mapa muestra el cambio.", "citations": ["metodo"], "source": "ia"}


def test_descarta_citas_que_no_existen_en_el_contenido(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta.", citas=["metodo", "inventada"])
    _, cuerpo = pedir(servicio(contenido, p))
    assert cuerpo["citations"] == ["metodo"]


def test_sin_cita_valida_responde_con_plantilla(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta sin fuente.", citas=["inventada"])
    _, cuerpo = pedir(servicio(contenido, p))
    assert cuerpo["source"] == "plantilla"
    assert cuerpo["citations"] == []


def test_fallo_del_proveedor_responde_plantilla_sin_detalle_tecnico(contenido, proveedor_falso):
    p = proveedor_falso(error=RuntimeError("saldo agotado: sk-test-123"))
    status, cuerpo = pedir(servicio(contenido, p))
    assert status == 200
    assert cuerpo["source"] == "plantilla"
    assert "saldo" not in cuerpo["answer"].lower()
    assert "sk-test" not in str(cuerpo)


def test_otra_estacion_se_declina_sin_llamar_al_proveedor(contenido, proveedor_falso):
    p = proveedor_falso(texto="no debería llegar", citas=["resumen"])
    _, cuerpo = pedir(servicio(contenido, p), station="otra-estacion")
    assert p.llamadas == 0
    assert cuerpo["source"] == "plantilla"


@pytest.mark.parametrize("pregunta", ["¿Cuántas personas murieron?", "¿Qué pasará el próximo mes?"])
def test_daños_y_pronosticos_se_declinan_sin_llamar_al_proveedor(contenido, proveedor_falso, pregunta):
    p = proveedor_falso(texto="no", citas=["resumen"])
    _, cuerpo = pedir(servicio(contenido, p), pregunta=pregunta)
    assert p.llamadas == 0
    assert cuerpo["source"] == "plantilla"


def test_pedir_confirmar_una_causa_se_declina_sin_fuente(contenido, proveedor_falso):
    p = proveedor_falso(texto="Fue un incendio.", citas=["resumen"])
    _, cuerpo = pedir(servicio(contenido, p), pregunta="¿Cuál fue la causa? Confírmalo.")
    assert p.llamadas == 0
    assert "no puedo" in cuerpo["answer"].lower()


def test_limite_de_sesion_responde_429_sin_llamar(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta.", citas=["resumen"])
    s = servicio(contenido, p, max_preguntas=1)
    pedir(s)
    status, cuerpo = pedir(s)
    assert status == 429
    assert cuerpo["error"] == "limite_de_sesion"
    assert p.llamadas == 1


def test_pregunta_larga_responde_413(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta.", citas=["resumen"])
    status, cuerpo = pedir(servicio(contenido, p, max_caracteres=5), pregunta="123456")
    assert status == 413
    assert p.llamadas == 0


def test_sin_limites_configurados_responde_503_y_no_llama(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta.", citas=["resumen"])
    s = Insight(contenido, p, None)
    status, cuerpo = pedir(s)
    assert status == 503
    assert cuerpo["error"] == "limites_no_configurados"
    assert p.llamadas == 0


def test_sesion_obligatoria(contenido, proveedor_falso):
    p = proveedor_falso(texto="Respuesta.", citas=["resumen"])
    status, _ = servicio(contenido, p).responder(station_id="san-ignacio", question="hola", lang="es", sesion="")
    assert status == 400


def test_sugeridas_por_idioma(contenido, proveedor_falso):
    s = servicio(contenido, proveedor_falso())
    assert s.sugeridas("en")[0] == "What does the map show?"


def test_logs_solo_metadatos_sin_pregunta_ni_clave(contenido, proveedor_falso, caplog):
    caplog.set_level(logging.INFO, logger="insight")
    p = proveedor_falso(texto="Respuesta.", citas=["metodo"])
    pedir(servicio(contenido, p), pregunta="PREGUNTA-SECRETA-XYZ")
    texto_logs = " ".join(r.getMessage() for r in caplog.records)
    assert "PREGUNTA-SECRETA-XYZ" not in texto_logs
    assert "san-ignacio" in texto_logs and "ia" in texto_logs
