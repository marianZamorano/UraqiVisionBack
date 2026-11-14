"""Textos de respaldo por idioma e intención (RF-18, RN-10, RN-14). No se generan con IA."""

INTENCIONES = ("general", "fuera_de_alcance", "causa", "otra_estacion")

_TEXTOS = {
    "es": {
        "general": "Esa pregunta no está en el contenido publicado de esta estación. Prueba con una de las sugeridas.",
        "fuera_de_alcance": "Insight no estima daños a personas, no pronostica ni recomienda acciones de emergencia.",
        "causa": "No puedo confirmar una causa sin una fuente publicada. Puedo explicar qué muestra el mapa y el método.",
        "otra_estacion": "Insight solo responde sobre la estación que tienes abierta.",
    },
    "en": {
        "general": "That question is not in this station's published content. Try one of the suggested questions.",
        "fuera_de_alcance": "Insight does not estimate harm to people, does not forecast, and does not recommend emergency actions.",
        "causa": "I cannot confirm a cause without a published source. I can explain what the map shows and the method.",
        "otra_estacion": "Insight only answers about the station you have open.",
    },
}


def plantilla(intencion, lang):
    return _TEXTOS[lang][intencion]
