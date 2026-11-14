import pytest

from insight.contenido import Contenido, ContenidoInvalido


def test_preguntas_sugeridas_entre_3_y_5_en_ambos_idiomas(contenido):
    assert len(contenido.preguntas_sugeridas("es")) == 3
    assert len(contenido.preguntas_sugeridas("en")) == 3


def test_rechaza_contenido_con_menos_de_3_preguntas(contenido):
    datos = {"id": "x", "nombre": {"es": "x", "en": "x"}, "secciones": {"a": {"es": "a", "en": "a"}},
             "preguntas_sugeridas": {"es": ["uno"], "en": ["one", "two", "three"]}}
    with pytest.raises(ContenidoInvalido):
        Contenido.desde_dict(datos)


def test_secciones_citables_solo_las_que_existen(contenido):
    assert contenido.secciones_citables() == {"resumen", "metodo", "glosario-sar"}
    assert contenido.cita_valida("metodo")
    assert not contenido.cita_valida("seccion-inventada")


def test_texto_de_seccion_en_el_idioma_pedido(contenido):
    assert contenido.texto("resumen", "en") == "Test station with synthetic data."
