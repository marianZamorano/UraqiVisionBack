import copy

import pytest

from pipeline.manifiesto import ManifiestoInvalido, validar_manifiesto

VALIDO = {
    "estacion": "san-ignacio",
    "version_pipeline": "0.1.0",
    "granulos": [
        {
            "nombre": "NISAR_SINTETICO_0001",
            "fecha": "2026-08-01T12:00:00Z",
            "orbita": 42,
            "crid": "CRID-SINTETICO",
            "madurez": "PROVISIONAL",
            "suma": "sha256:0000",
        }
    ],
}


def test_acepta_un_manifiesto_completo_sintetico():
    validar_manifiesto(VALIDO)


@pytest.mark.parametrize("campo", ["estacion", "version_pipeline", "granulos"])
def test_falla_si_falta_un_campo_de_procedencia(campo):
    m = copy.deepcopy(VALIDO)
    del m[campo]
    with pytest.raises(ManifiestoInvalido):
        validar_manifiesto(m)


@pytest.mark.parametrize("campo", ["nombre", "fecha", "orbita", "crid", "madurez", "suma"])
def test_falla_si_falta_un_campo_de_gránulo(campo):
    m = copy.deepcopy(VALIDO)
    del m["granulos"][0][campo]
    with pytest.raises(ManifiestoInvalido):
        validar_manifiesto(m)


def test_rechaza_madurez_beta(): 
    m = copy.deepcopy(VALIDO)
    m["granulos"][0]["madurez"] = "BETA"
    with pytest.raises(ManifiestoInvalido, match="BETA"):
        validar_manifiesto(m)


def test_rechaza_una_serie_con_dos_crid(): 
    m = copy.deepcopy(VALIDO)
    segundo = copy.deepcopy(m["granulos"][0])
    segundo["crid"] = "OTRO-CRID"
    m["granulos"].append(segundo)
    with pytest.raises(ManifiestoInvalido, match="CRID"):
        validar_manifiesto(m)


def test_rechaza_una_serie_con_dos_órbitas():
    m = copy.deepcopy(VALIDO)
    segundo = copy.deepcopy(m["granulos"][0])
    segundo["orbita"] = 99
    m["granulos"].append(segundo)
    with pytest.raises(ManifiestoInvalido, match="órbita"):
        validar_manifiesto(m)


@pytest.mark.parametrize("fecha", ["2026-08-01T12:00:00", "2026-08-01T12:00:00+04:00", "01/08/2026"])
def test_rechaza_fechas_que_no_son_utc(fecha):
    m = copy.deepcopy(VALIDO)
    m["granulos"][0]["fecha"] = fecha
    with pytest.raises(ManifiestoInvalido, match="UTC"):
        validar_manifiesto(m)


def test_un_dato_ausente_no_se_convierte_en_cero():
    m = copy.deepcopy(VALIDO)
    m["granulos"][0]["orbita"] = 0
    with pytest.raises(ManifiestoInvalido, match="no reportada"):
        validar_manifiesto(m)
