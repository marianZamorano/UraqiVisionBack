"""Punto de entrada de POST /api/insight: arma el servicio con la configuración del entorno (§21.1, §21.2)."""
from insight.infraestructura.adaptadores import AdaptadorClaude, ProveedorNoConfigurado
from insight.dominio.limites import Limites, LimitesNoConfigurados
from insight.aplicacion.servicio import Insight


class SinProveedor:
    def generar(self, *, pregunta, lang, secciones):
        raise ProveedorNoConfigurado("no hay proveedor de IA configurado")


def responder(cuerpo, *, sesion, env, contenido, proveedor=None, limites=None):
    if limites is None:
        try:
            limites = Limites.desde_entorno(env)
        except LimitesNoConfigurados:
            limites = None
    if proveedor is None:
        try:
            proveedor = AdaptadorClaude.desde_entorno(env)
        except ProveedorNoConfigurado:
            proveedor = SinProveedor()
    datos = cuerpo if isinstance(cuerpo, dict) else {}
    return Insight(contenido, proveedor, limites).responder(
        station_id=datos.get("station_id"), question=datos.get("question"),
        lang=datos.get("lang"), sesion=sesion)
