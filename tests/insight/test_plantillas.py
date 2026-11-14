import pytest

from insight.plantillas import INTENCIONES, plantilla


@pytest.mark.parametrize("lang", ["es", "en"])
@pytest.mark.parametrize("intencion", INTENCIONES)
def test_hay_plantilla_por_idioma_e_intencion(lang, intencion):
    texto = plantilla(intencion, lang)
    assert texto.strip()


def test_causa_sin_fuente_se_declina_con_motivo():
    assert "no puedo" in plantilla("causa", "es").lower()
    assert "cannot" in plantilla("causa", "en").lower()


def test_idioma_no_soportado_falla():
    with pytest.raises(KeyError):
        plantilla("general", "fr")
