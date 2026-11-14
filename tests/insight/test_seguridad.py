import re
from pathlib import Path

import pytest

from insight.adaptadores import AdaptadorClaude, ProveedorNoConfigurado

RAIZ = Path(__file__).resolve().parents[2]
PATRON_CLAVE = re.compile(r"sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}")


def test_sin_clave_en_el_entorno_el_proveedor_no_esta_configurado():
    with pytest.raises(ProveedorNoConfigurado):
        AdaptadorClaude.desde_entorno({})


def test_la_clave_va_solo_en_la_cabecera_y_no_en_el_cuerpo():
    a = AdaptadorClaude.desde_entorno({"INSIGHT_PROVIDER_API_KEY": "clave-de-prueba-123", "INSIGHT_MODEL": "modelo-x"})
    cabeceras, cuerpo = a.construir_peticion(pregunta="¿Qué es SAR?", lang="es", secciones={"glosario-sar": "SAR"})
    assert cabeceras["x-api-key"] == "clave-de-prueba-123"
    assert "clave-de-prueba-123" not in str(cuerpo)
    assert "clave-de-prueba-123" not in repr(a)


def test_el_codigo_no_contiene_claves_del_proveedor():
    for ruta in list((RAIZ / "insight").rglob("*.py")) + list((RAIZ / "tests").rglob("*.py")):
        assert not PATRON_CLAVE.search(ruta.read_text(encoding="utf-8")), ruta
