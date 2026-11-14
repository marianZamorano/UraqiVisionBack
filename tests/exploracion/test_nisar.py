"""Pruebas de las funciones puras de la exploración NISAR (#60; MC-01, RF-26, RN-02, RN-07, RN-13).

Los nombres y valores de ejemplo son de gránulos reales consultados en el catálogo CMR el 14 nov 2026;
no se usan datos de radar.
"""
import pytest

from exploracion.nisar import (
    COLECCIONES,
    analizar_nombre,
    fila_inventario,
    huella_wkt,
    indices_recorte,
    transformacion_geotiff,
)

VALIDADO = "NISAR_L2_PR_GCOV_034_060_A_170_2005_DHDH_A_20261028T095118_20261028T095152_P05036_N_F_J_001"
PROVISIONAL = "NISAR_L2_PR_GCOV_023_060_A_169_2005_DHDH_A_20260618T095047_20260618T095122_P05023_N_F_J_001"
SOLO_HH = "NISAR_L2_PR_GCOV_034_039_D_097_2005_SHSH_A_20261026T221205_20261026T221239_P05036_N_F_J_001"


def test_colecciones_sin_beta():
    # RN-02: solo PROVISIONAL y VALIDATED, nunca BETA.
    assert set(COLECCIONES) == {"PROVISIONAL", "VALIDATED"}
    assert COLECCIONES["PROVISIONAL"] == "C2854338529-ASF"
    assert COLECCIONES["VALIDATED"] == "C3622241360-ASF"


def test_analizar_nombre_coincide_con_la_identificacion_del_hdf5():
    # Valores leídos de science/LSAR/identification del propio gránulo: track 60, frame 170,
    # Ascending, P05036, inicio 2026-10-28T09:51:18.
    n = analizar_nombre(VALIDADO)
    assert n["track"] == 60
    assert n["direccion"] == "A"
    assert n["frame"] == 170
    assert n["crid"] == "P05036"
    assert n["inicio_utc"] == "2026-10-28T09:51:18Z"
    assert n["fin_utc"] == "2026-10-28T09:51:52Z"
    assert n["modo_polarizacion"] == "DHDH"
    assert n["polarizaciones"] == ["HH", "HV"]
    assert n["orbita"] == "060A"


def test_analizar_nombre_solo_hh():
    n = analizar_nombre(SOLO_HH)
    assert n["direccion"] == "D"
    assert n["modo_polarizacion"] == "SHSH"
    assert n["polarizaciones"] == ["HH"]  # CQ-04: sin HV no entra en la serie de HV.
    assert n["orbita"] == "039D"


def test_analizar_nombre_rechaza_otros_productos():
    with pytest.raises(ValueError):
        analizar_nombre("NISAR_L2_PR_GUNW_001_060_A_170_xxx")
    with pytest.raises(ValueError):
        analizar_nombre("cualquier cosa")


def test_huella_wkt_invierte_lat_lon_de_cmr():
    # CMR entrega «lat lon» por pares; WKT usa «lon lat».
    cmr = [["-17.91542 -58.68016 -15.77041 -59.13553 -16.23747 -61.59882 -18.3762 -61.17254 -17.91542 -58.68016"]]
    assert huella_wkt(cmr) == (
        "POLYGON((-58.68016 -17.91542, -59.13553 -15.77041, -61.59882 -16.23747, "
        "-61.17254 -18.3762, -58.68016 -17.91542))"
    )


def test_huella_wkt_sin_poligono_no_inventa():
    assert huella_wkt(None) is None
    assert huella_wkt([]) is None


def test_fila_inventario_hora_bolivia_y_tamano():
    entrada = {
        "producer_granule_id": PROVISIONAL,
        "granule_size": "1961.8337497711182",
        "polygons": None,
        "links": [
            {"href": "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/x/y.h5"},
            {"href": "s3://bucket/y.h5"},
            {"href": "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/x/y_LATLON_thumbnail.png"},
        ],
    }
    fila = fila_inventario(entrada, "PROVISIONAL")
    assert fila["madurez"] == "PROVISIONAL"
    assert fila["inicio_utc"] == "2026-06-18T09:50:47Z"
    assert fila["inicio_bolivia"] == "2026-06-18 05:50:47"  # RN-07: UTC−4, sin horario de verano.
    assert fila["tamano_mb"] == 1961.8
    assert fila["url_h5"].endswith(".h5") and fila["url_h5"].startswith("https://")
    assert fila["url_vista_previa"].endswith("_thumbnail.png")
    assert fila["huella_wkt"] is None


def test_fila_inventario_tamano_ausente_no_es_cero():
    # RN-13: un dato ausente no se convierte en cero.
    entrada = {"producer_granule_id": PROVISIONAL, "links": []}
    fila = fila_inventario(entrada, "PROVISIONAL")
    assert fila["tamano_mb"] is None
    assert fila["url_h5"] is None


def test_indices_recorte_con_eje_y_descendente():
    # Grilla real: x0=592570, dx=20, nx=16524; y0=8495270, dy=-20, ny=16056 (centros de píxel).
    # Regla: entra el píxel cuyo centro cae dentro del recuadro.
    # Columnas: 600000 ≤ 592570 + 20·i ≤ 610000 → i de 372 (371,5↑) a 871 (871,5↓).
    # Filas: 8400000 ≤ 8495270 − 20·j ≤ 8410000 → j de 4264 (4263,5↑) a 4763 (4763,5↓).
    filas, columnas = indices_recorte(
        x0=592570.0, dx=20.0, nx=16524, y0=8495270.0, dy=-20.0, ny=16056,
        xmin=600000.0, xmax=610000.0, ymin=8400000.0, ymax=8410000.0,
    )
    assert columnas == slice(372, 872)
    assert filas == slice(4264, 4764)


def test_indices_recorte_fuera_de_la_escena():
    with pytest.raises(ValueError):
        indices_recorte(
            x0=592570.0, dx=20.0, nx=100, y0=8495270.0, dy=-20.0, ny=100,
            xmin=0.0, xmax=10.0, ymin=0.0, ymax=10.0,
        )


def test_transformacion_geotiff_desde_centro_de_pixel():
    # El primer centro (592570, 8495270) está a medio píxel del borde superior izquierdo.
    t = transformacion_geotiff(x_primero=592570.0, dx=20.0, y_primero=8495270.0, dy=-20.0)
    assert t == (20.0, 0.0, 592560.0, 0.0, -20.0, 8495280.0)
