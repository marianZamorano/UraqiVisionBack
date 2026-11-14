"""Límites de uso de Insight por sesión y por longitud (RNF-07). Los valores son DP-04: no se fijan aquí."""
from dataclasses import dataclass, field


class LimitesNoConfigurados(RuntimeError):
    pass


class LimiteAlcanzado(RuntimeError):
    pass


class PreguntaLarga(ValueError):
    pass


@dataclass
class Limites:
    max_preguntas: int
    max_caracteres: int
    _conteo: dict = field(default_factory=dict, repr=False)

    @classmethod
    def desde_entorno(cls, env):
        try:
            return cls(max_preguntas=int(env["INSIGHT_MAX_PREGUNTAS_SESION"]),
                       max_caracteres=int(env["INSIGHT_MAX_CARACTERES"]))
        except (KeyError, ValueError) as e:
            raise LimitesNoConfigurados("INSIGHT_MAX_PREGUNTAS_SESION e INSIGHT_MAX_CARACTERES (DP-04)") from e

    def registrar(self, sesion, pregunta):
        if len(pregunta) > self.max_caracteres:
            raise PreguntaLarga("pregunta demasiado larga")
        n = self._conteo.get(sesion, 0)
        if n >= self.max_preguntas:
            raise LimiteAlcanzado("límite de preguntas por sesión")
        self._conteo[sesion] = n + 1
