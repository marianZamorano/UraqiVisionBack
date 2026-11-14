# Análisis de consistencia: Insight (006-insight)

**Estado:** P-INSIGHT-05 (issue #46). Análisis sin cambios de código. Cada discrepancia se registra con su origen
(spec, plan, contrato o código) y su estado. **Espera la aprobación de la persona («apruebo») antes de cerrar la
puerta a P-INSIGHT-06** (T019 de `tasks.md`).

**Comparado:** `spec.md`, `plan.md`, `contracts/post-api-insight.md`, `insight/` (dominio, aplicación, infraestructura,
interfaz) y las pruebas de `tests/insight/`.

## Coincidencias verificadas

| Requisito | Dónde se verifica | Estado |
|---|---|---|
| RN-09: solo contenido de la estación abierta | `aplicacion/servicio.py` (otra estación → plantilla) y `test_servicio.py` | Coincide |
| RN-10: no estima daños, no pronostica | `servicio.py` (`FUERA_DE_ALCANCE`) y pruebas parametrizadas | Coincide, con la heurística del punto D3 |
| RN-14: no confirma causas sin fuente | `servicio.py` (`CAUSA`) y `test_pedir_confirmar_una_causa…` | Coincide, con el punto D3 |
| RF-18: nunca pantalla vacía ni error técnico | `servicio.py` (except → plantilla) y `test_fallo_del_proveedor…` | Coincide |
| RF-16: cita solo secciones existentes | `servicio.py` (filtra `citas_validas`) y `test_descarta_citas…` | Coincide |
| RNF-06 / PS-06: la clave no sale del servidor | `test_seguridad.py` (escaneo del código y del `repr`) | Coincide |
| RNF-07: límites configurables; sin valor por defecto | `dominio/limites.py` y `test_limites.py`; sin configurar → 503 | Coincide (DP-04 pendiente) |
| Logs solo con metadatos | `servicio.py` (`_log`) y `test_logs_solo_metadatos…` | Coincide |

## Discrepancias y riesgos

| ID | Origen | Qué | Gravedad | Estado |
|---|---|---|---|---|
| D1 | Código vs plan | El código se implementó antes del plan (P-INSIGHT-03 a 05). | Alta (proceso) | Hecho. Declarado en #43 y en `sdd/historial/`. |
| D2 | Código vs §21.1 | Los códigos 400, 413, 429, 503, el cuerpo de error y el identificador de sesión no están en §21.1. | Media | Propuesta de diseño. Documentada en `contracts/`. Pendiente con la web (T014). |
| D3 | Código vs RN-14 | La heurística de causa declina **toda** pregunta con «por qué», no solo las que piden confirmar una causa. Es más restrictiva que RN-14 y puede bloquear preguntas válidas. | Media | **Abierta.** Decidir si se afina la heurística. No se cambia en este análisis. |
| D4 | Plan vs código | RF-17 (sugeridas) existe como método del dominio, pero no tiene ruta HTTP ni contrato. | Baja | **Abierta** (T016). |
| D5 | Spec vs código | El límite de sesión se cuenta en memoria del proceso. En serverless, cada instancia cuenta por separado; RNF-07 podría no cumplirse de forma fiable. | Alta (hipótesis) | **Abierta**: probar en el despliegue (T017). Persistir el contador sería un cambio de arquitectura (§8.2). |
| D6 | Spec vs contrato | La spec asume un identificador de sesión anónimo del navegador. No hay acuerdo con la web sobre el encabezado. | Alta (hipótesis) | **Abierta** (T014). |
| D7 | Código vs proveedor | El adaptador arma la petición de la API de mensajes, pero no se ha verificado contra la documentación vigente ni con una clave real. | Alta | **Abierta** (T010, T011). |
| D8 | Spec vs código (PS-05) | La respuesta de IA se pide en el idioma elegido, pero no hay verificación automática de que la respuesta esté en ese idioma. | Media | **Abierta**: prueba con el proveedor real (T010). |
| D9 | Spec vs código | Cuando el proveedor responde sin cita válida, la respuesta es la plantilla general, con `citations: []`. Coincide con SC-001 y con RF-16 («declara que no está en el contenido»). | Ninguna | Verificado. Sin discrepancia. |
| D10 | Código vs AGENTS.md §3.2 | La arquitectura en capas se aplicó antes de la revisión del equipo. | Media (proceso) | **Abierta** (T015). |
| D11 | Spec vs DP-04 / DP-06 | Los valores de los límites y el hospedaje no están decididos. El plan y el código no los fijan; §18 nombra Vercel, pero no es una decisión. | Coherente | Pendiente de Mimi (T012, T013). |
| D12 | Entorno | Pytest necesita `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` por un plugin roto del entorno (`platformdirs`). | Baja | Del entorno, no del código. |

## Conclusión

El código cumple las reglas de contenido (RN-09, RN-10, RN-14), la seguridad de la clave (RNF-06, PS-06) y el respaldo
con plantillas (RF-18), y lo comprueban las pruebas. Quedan **abiertas** cuatro discrepancias que afectan a la
conformidad real: D3 (heurística de causa), D5 (límite en memoria), D6 (sesión con la web) y D7 (proveedor sin verificar).
Ninguna está resuelta todavía, así que la función **no** debe darse por lista para desplegar.

## Lo que este análisis no cambia

- No se modifica código ni contrato.
- No se decide DP-04 ni DP-06.
- No se cierra P-INSIGHT-06 sin la aprobación de la persona.
