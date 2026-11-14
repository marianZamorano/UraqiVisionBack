import pytest

from insight.contenido import Contenido


@pytest.fixture
def contenido():
    return Contenido.desde_dict({
        "id": "san-ignacio",
        "nombre": {"es": "San Ignacio de Velasco", "en": "San Ignacio de Velasco"},
        "secciones": {
            "resumen": {"es": "Estación de prueba con datos sintéticos.", "en": "Test station with synthetic data."},
            "metodo": {"es": "Método de cambio en potencia lineal.", "en": "Change method in linear power."},
            "glosario-sar": {"es": "SAR: radar de apertura sintética.", "en": "SAR: synthetic aperture radar."},
        },
        "preguntas_sugeridas": {
            "es": ["¿Qué muestra el mapa?", "¿Cómo se calculó el cambio?", "¿Qué es SAR?"],
            "en": ["What does the map show?", "How was the change calculated?", "What is SAR?"],
        },
    })


class ProveedorFalso:
    def __init__(self, texto="", citas=(), error=None):
        self.texto, self.citas, self.error = texto, list(citas), error
        self.llamadas = 0

    def generar(self, *, pregunta, lang, secciones):
        self.llamadas += 1
        if self.error:
            raise self.error
        return self.texto, list(self.citas)


@pytest.fixture
def proveedor_falso():
    return ProveedorFalso
