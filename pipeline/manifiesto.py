"""Validación del manifiesto de procedencia de una estación (CQ-06, RN-02, RN-07, RN-13)."""
from datetime import datetime

CAMPOS_ESTACION = ("estacion", "version_pipeline", "granulos")
CAMPOS_GRANULO = ("nombre", "fecha", "orbita", "crid", "madurez", "suma")
MADUREZ_PERMITIDA = ("PROVISIONAL", "VALIDATED")


class ManifiestoInvalido(ValueError):
    pass


def validar_manifiesto(manifiesto):
    for campo in CAMPOS_ESTACION:
        if campo not in manifiesto:
            raise ManifiestoInvalido(f"falta {campo}")
    granulos = manifiesto["granulos"]
    if not isinstance(granulos, list) or not granulos:
        raise ManifiestoInvalido("granulos debe tener al menos un gránulo")
    for g in granulos:
        for campo in CAMPOS_GRANULO:
            if campo not in g:
                raise ManifiestoInvalido(f"falta {campo} en un gránulo")
        if g["madurez"] == "BETA":
            raise ManifiestoInvalido("no se usan productos BETA (RN-02)")
        if g["madurez"] not in MADUREZ_PERMITIDA:
            raise ManifiestoInvalido(f"madurez no permitida: {g['madurez']}")
        if not isinstance(g["orbita"], int) or g["orbita"] <= 0:
            raise ManifiestoInvalido("órbita no reportada: debe ser un entero positivo (RN-13)")
        _validar_utc(g["fecha"])
    if len({g["crid"] for g in granulos}) != 1:
        raise ManifiestoInvalido("una serie debe tener un solo CRID (RN-02)")
    if len({g["orbita"] for g in granulos}) != 1:
        raise ManifiestoInvalido("una serie debe ser de una sola órbita (RN-01)")


def _validar_utc(fecha):
    if not isinstance(fecha, str) or not fecha.endswith("Z"):
        raise ManifiestoInvalido("la fecha debe estar en UTC, con sufijo Z (RN-07)")
    try:
        datetime.fromisoformat(fecha[:-1] + "+00:00")
    except ValueError as e:
        raise ManifiestoInvalido("la fecha debe estar en UTC, con sufijo Z (RN-07)") from e
