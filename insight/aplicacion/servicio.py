"""Servicio Insight: valida, aplica límites, consulta al proveedor y responde con citas o plantillas."""
import logging
import time

from insight.dominio.contenido import Contenido
from insight.aplicacion.contrato import SolicitudInvalida, validar_solicitud
from insight.dominio.limites import LimiteAlcanzado, LimitesNoConfigurados, PreguntaLarga
from insight.dominio.plantillas import plantilla

log = logging.getLogger("insight")

FUERA_DE_ALCANCE = ("daño", "daños", "murieron", "muertos", "heridos", "pronóstico", "pronostico", "pasará",
                    "damage", "injur", "died", "forecast", "will happen", "predict")
CAUSA = ("causa", "por qué", "por que", "culpable", "cause", "why", "caused")


class Insight:
    def __init__(self, contenido: Contenido, proveedor, limites):
        self.contenido = contenido
        self.proveedor = proveedor
        self.limites = limites

    def sugeridas(self, lang):
        return self.contenido.preguntas_sugeridas(lang)

    def responder(self, *, station_id, question, lang, sesion):
        inicio = time.monotonic()
        if not sesion:
            return self._error(400, "sesion_obligatoria", station_id, lang, inicio)
        try:
            solicitud = validar_solicitud({"station_id": station_id, "question": question, "lang": lang})
        except SolicitudInvalida as e:
            return self._error(400, "solicitud_invalida", station_id, lang, inicio, str(e))
        if self.limites is None:
            return self._error(503, "limites_no_configurados", station_id, lang, inicio)
        try:
            self.limites.registrar(sesion, solicitud.question)
        except PreguntaLarga:
            return self._error(413, "pregunta_demasiado_larga", station_id, lang, inicio)
        except LimiteAlcanzado:
            return self._error(429, "limite_de_sesion", station_id, lang, inicio)

        pregunta = solicitud.question.lower()
        if solicitud.station_id != self.contenido.id:
            return self._plantilla(200, "otra_estacion", station_id, lang, inicio)
        if any(p in pregunta for p in FUERA_DE_ALCANCE):
            return self._plantilla(200, "fuera_de_alcance", station_id, lang, inicio)
        if any(p in pregunta for p in CAUSA):
            return self._plantilla(200, "causa", station_id, lang, inicio)

        try:
            texto, citas = self.proveedor.generar(pregunta=solicitud.question, lang=lang,
                                                  secciones={s: self.contenido.texto(s, lang)
                                                             for s in self.contenido.secciones_citables()})
        except Exception:
            log.warning("proveedor no disponible")
            return self._plantilla(200, "general", station_id, lang, inicio)
        citas_validas = [c for c in citas if self.contenido.cita_valida(c)]
        if not texto or not texto.strip() or not citas_validas:
            return self._plantilla(200, "general", station_id, lang, inicio)
        cuerpo = {"answer": texto.strip(), "citations": citas_validas, "source": "ia"}
        self._log(200, station_id, lang, len(solicitud.question), "ia", inicio)
        return 200, cuerpo

    def _plantilla(self, status, intencion, station_id, lang, inicio):
        cuerpo = {"answer": plantilla(intencion, lang), "citations": [], "source": "plantilla"}
        self._log(status, station_id, lang, None, "plantilla", inicio)
        return status, cuerpo

    def _error(self, status, codigo, station_id, lang, inicio, detalle=None):
        cuerpo = {"error": codigo}
        if detalle:
            cuerpo["detalle"] = detalle
        self._log(status, station_id, lang, None, codigo, inicio)
        return status, cuerpo

    def _log(self, status, station_id, lang, longitud, fuente, inicio):
        ms = round((time.monotonic() - inicio) * 1000)
        log.info("insight estacion=%s idioma=%s longitud=%s fuente=%s estado=%s latencia_ms=%s",
                 station_id, lang, longitud, fuente, status, ms)
