import pytest

from insight.contrato import SolicitudInvalida, validar_solicitud


def test_acepta_solicitud_valida():
    s = validar_solicitud({"station_id": "san-ignacio", "question": "¿Qué es SAR?", "lang": "es"})
    assert s.station_id == "san-ignacio"
    assert s.lang == "es"


@pytest.mark.parametrize("lang", ["fr", "", None, "ES"])
def test_rechaza_idioma_distinto_de_es_o_en(lang):
    with pytest.raises(SolicitudInvalida):
        validar_solicitud({"station_id": "x", "question": "hola", "lang": lang})


@pytest.mark.parametrize("pregunta", ["", "   ", None])
def test_rechaza_pregunta_vacia(pregunta):
    with pytest.raises(SolicitudInvalida):
        validar_solicitud({"station_id": "x", "question": pregunta, "lang": "en"})


def test_rechaza_station_id_ausente():
    with pytest.raises(SolicitudInvalida):
        validar_solicitud({"question": "hola", "lang": "en"})
