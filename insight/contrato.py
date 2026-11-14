"""Contrato POST /api/insight (§21.1): validación de la solicitud."""
from dataclasses import dataclass

IDIOMAS = ("es", "en")


class SolicitudInvalida(ValueError):
    pass


@dataclass(frozen=True)
class Solicitud:
    station_id: str
    question: str
    lang: str


def validar_solicitud(cuerpo):
    if not isinstance(cuerpo, dict):
        raise SolicitudInvalida("el cuerpo debe ser un objeto JSON")
    station_id = cuerpo.get("station_id")
    if not isinstance(station_id, str) or not station_id.strip():
        raise SolicitudInvalida("station_id es obligatorio")
    lang = cuerpo.get("lang")
    if lang not in IDIOMAS:
        raise SolicitudInvalida("lang debe ser es o en")
    pregunta = cuerpo.get("question")
    if not isinstance(pregunta, str) or not pregunta.strip():
        raise SolicitudInvalida("question es obligatoria")
    return Solicitud(station_id=station_id.strip(), question=pregunta.strip(), lang=lang)
