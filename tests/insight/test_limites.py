import pytest

from insight.limites import Limites, LimiteAlcanzado, LimitesNoConfigurados, PreguntaLarga


def test_sin_configurar_no_hay_limites_por_defecto():
    with pytest.raises(LimitesNoConfigurados):
        Limites.desde_entorno({})


def test_lee_limites_del_entorno():
    l = Limites.desde_entorno({"INSIGHT_MAX_PREGUNTAS_SESION": "3", "INSIGHT_MAX_CARACTERES": "120"})
    assert l.max_preguntas == 3 and l.max_caracteres == 120


def test_corta_al_llegar_al_maximo_por_sesion():
    l = Limites(max_preguntas=2, max_caracteres=100)
    l.registrar("s1", "uno")
    l.registrar("s1", "dos")
    with pytest.raises(LimiteAlcanzado):
        l.registrar("s1", "tres")


def test_cada_sesion_tiene_su_propio_conteo():
    l = Limites(max_preguntas=1, max_caracteres=100)
    l.registrar("s1", "uno")
    l.registrar("s2", "uno")
    with pytest.raises(LimiteAlcanzado):
        l.registrar("s1", "dos")


def test_rechaza_pregunta_mas_larga_que_el_maximo_sin_contarla():
    l = Limites(max_preguntas=5, max_caracteres=10)
    with pytest.raises(PreguntaLarga):
        l.registrar("s1", "x" * 11)
    l.registrar("s1", "x" * 10)
