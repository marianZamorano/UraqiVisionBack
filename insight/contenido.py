"""Contenido publicado de la estación abierta: secciones citables y preguntas sugeridas (RN-09, RF-17).

Formato propuesto del contenido (dict o JSON); el esquema definitivo de station.json lo fija M-PUBLICACIÓN.
"""
from dataclasses import dataclass, field

from .contrato import IDIOMAS

MIN_SUGERIDAS, MAX_SUGERIDAS = 3, 5


class ContenidoInvalido(ValueError):
    pass


@dataclass(frozen=True)
class Contenido:
    id: str
    nombre: dict
    secciones: dict = field(default_factory=dict)
    _sugeridas: dict = field(default_factory=dict)

    @classmethod
    def desde_dict(cls, datos):
        for clave in ("id", "nombre", "secciones", "preguntas_sugeridas"):
            if clave not in datos:
                raise ContenidoInvalido(f"falta {clave}")
        for lang in IDIOMAS:
            n = len(datos["preguntas_sugeridas"].get(lang, []))
            if not MIN_SUGERIDAS <= n <= MAX_SUGERIDAS:
                raise ContenidoInvalido(f"se necesitan de {MIN_SUGERIDAS} a {MAX_SUGERIDAS} preguntas en {lang}")
        return cls(id=datos["id"], nombre=datos["nombre"], secciones=datos["secciones"],
                   _sugeridas=datos["preguntas_sugeridas"])

    def secciones_citables(self):
        return set(self.secciones)

    def cita_valida(self, seccion):
        return seccion in self.secciones

    def texto(self, seccion, lang):
        return self.secciones[seccion][lang]

    def preguntas_sugeridas(self, lang):
        return list(self._sugeridas[lang])
