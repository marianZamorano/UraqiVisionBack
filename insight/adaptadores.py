"""Adaptador de proveedor (§21.2). La clave vive solo en el servidor, por variable de entorno (RNF-06)."""
import json
import urllib.request
from dataclasses import dataclass

URL_MENSAJES = "https://api.anthropic.com/v1/messages"
VERSION_API = "2023-06-01"


class ProveedorNoConfigurado(RuntimeError):
    pass


@dataclass(frozen=True)
class AdaptadorClaude:
    _clave: str = None
    modelo: str = "claude-haiku-4-5"
    tiempo_maximo: float = 15.0

    def __repr__(self):
        return f"AdaptadorClaude(modelo={self.modelo!r}, clave=«oculta»)"

    @classmethod
    def desde_entorno(cls, env):
        clave = env.get("INSIGHT_PROVIDER_API_KEY", "")
        if not clave:
            raise ProveedorNoConfigurado("INSIGHT_PROVIDER_API_KEY no está definida")
        return cls(_clave=clave, modelo=env.get("INSIGHT_MODEL", cls.modelo))

    def construir_peticion(self, *, pregunta, lang, secciones):
        contexto = "\n".join(f"[{s}] {texto}" for s, texto in secciones.items())
        system = ("Responde solo con el contexto de la estación. Cita las secciones entre corchetes. "
                  "No estimes daños, no pronostiques y no confirmes causas sin fuente. Idioma: " + lang)
        cabeceras = {"x-api-key": self._clave, "anthropic-version": VERSION_API,
                     "content-type": "application/json"}
        cuerpo = {"model": self.modelo, "max_tokens": 400, "system": system,
                  "messages": [{"role": "user", "content": f"{contexto}\n\nPregunta: {pregunta}"}]}
        return cabeceras, cuerpo

    def generar(self, *, pregunta, lang, secciones):
        cabeceras, cuerpo = self.construir_peticion(pregunta=pregunta, lang=lang, secciones=secciones)
        req = urllib.request.Request(URL_MENSAJES, data=json.dumps(cuerpo).encode(), headers=cabeceras, method="POST")
        with urllib.request.urlopen(req, timeout=self.tiempo_maximo) as r:
            datos = json.loads(r.read().decode())
        texto = "".join(b.get("text", "") for b in datos.get("content", []) if b.get("type") == "text")
        citas = [s for s in secciones if f"[{s}]" in texto]
        return texto, citas
