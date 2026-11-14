# Contrato: POST /api/insight

**Fuente fijada:** documento maestro §21.1 (propuesta de diseño del equipo). **Implementación:** `insight/interfaz/api.py`.
**Estado:** pendiente de acordar con la web (`UraqiVision`) el encabezado de sesión y el manejo de 429 y 503.

## Solicitud

`POST /api/insight`, cuerpo JSON:

```json
{ "station_id": "san-ignacio", "question": "¿Qué muestra el mapa?", "lang": "es" }
```

| Campo | Tipo | Regla | Origen |
|---|---|---|---|
| `station_id` | texto | obligatorio; debe ser la estación abierta para responder con IA | §21.1 |
| `question` | texto | obligatorio; sin espacios solos; longitud máxima = DP-04 | §21.1, RNF-07 |
| `lang` | `"es"` o `"en"` | obligatorio | §21.1, RNF-03 |
| sesión | texto | identificador anónimo de sesión del navegador; se pasa a la función como argumento | propuesta, aclaración P-INSIGHT-02 |

## Respuestas

| Código | Cuerpo | Cuándo | Origen |
|---|---|---|---|
| 200 | `{"answer", "citations", "source": "ia"}` | respuesta del proveedor con al menos una cita válida | §21.1 |
| 200 | `{"answer", "citations": [], "source": "plantilla"}` | respaldo: proveedor no disponible, sin cita válida, otra estación, daños, pronósticos o causa | §21.1, RF-18 |
| 400 | `{"error": "solicitud_invalida", "detalle"}` o `{"error": "sesion_obligatoria"}` | faltan o son inválidos los campos o la sesión | propuesta de diseño |
| 413 | `{"error": "pregunta_demasiado_larga"}` | la pregunta excede el máximo de caracteres | propuesta de diseño, RNF-07 |
| 429 | `{"error": "limite_de_sesion"}` | la sesión llegó al máximo de preguntas | propuesta de diseño, RNF-07 |
| 503 | `{"error": "limites_no_configurados"}` | faltan los límites en la configuración (DP-04 pendiente) | propuesta de diseño |

En la respuesta 200, `citations` solo contiene secciones que existen en el contenido publicado (RN-09).

## Reglas que el contrato no puede romper

- La clave del proveedor nunca aparece en la respuesta ni en el bundle (RNF-06, PS-06).
- Ante un error técnico del proveedor no se devuelve detalle al navegador: se responde con plantilla (RF-18).
- No se estiman daños, no se pronostica y no se confirman causas sin fuente (RN-10, RN-14).

## Pendiente con la web

- Nombre del encabezado de sesión.
- Qué muestra la web ante 429 y 503: la plantilla de RF-18 o un mensaje.
- Si las preguntas sugeridas (RF-17) se leen de `station.json` o se piden por HTTP. Hoy no hay ruta HTTP para ellas.

## Comparación con la web (P-INSIGHT-03, #71)

Fuente: `specs/001-base-web/contracts/insight.ts` del repositorio `UraqiVision`, rama `dev`, leída en solo lectura el 14 nov
2026. Se compara también el código de `insight/aplicacion/servicio.py`, que es lo que hoy devuelve la función. Esta sección
solo registra diferencias: no cambia el contrato de la web ni decide DP-04 ni DP-06.

| Aspecto | Este contrato y el código | Web (`insight.ts`) | Conflicto |
|---|---|---|---|
| Solicitud | `station_id`, `question`, `lang` | Igual | — |
| Sesión | Obligatoria (`sesion_obligatoria`) | No aparece | C1 |
| Respuesta 200 | `{answer, citations, source}` en el cuerpo | `{ok: true, status: 200, data: {...}}` | C2 |
| Campos opcionales | No los devuelve | `limitations` y `causal_claim` (propuesta de la web) | C3 |
| Error | `{"error": "<código>"}` con código en español | `{ok: false, status, error: {code, message, retryable}}` | C2 |
| Códigos de error | `solicitud_invalida` y `sesion_obligatoria` (400), `pregunta_demasiado_larga` (413), `limite_de_sesion` (429), `limites_no_configurados` (503) | `invalid-request`, `station-not-found`, `rate-limited`, `upstream-error` | C4 |
| Estación distinta | 200 con plantilla (`source: "plantilla"`) | `station-not-found` como error | C5 |
| Fallo del proveedor | 200 con plantilla (RF-18) | `upstream-error` como error | C5 |
| Mensaje para la persona | No hay `message` ni `retryable` | Ambos obligatorios | C4 |

### Conflictos pendientes de acordar con la web

- **C1. Sesión.** La web no tiene encabezado ni campo de sesión. Ya pendiente en este contrato: el nombre del encabezado.
- **C2. Forma de la respuesta.** La web envuelve el resultado en `ok`, `status` y `data` o `error`. El código devuelve el cuerpo directamente. Hay que elegir una forma.
- **C3. `limitations` y `causal_claim`.** La web los propone; la función no los devuelve. RN-14 pide que una causa sin fuente se niegue: `causal_claim` podría expresarlo.
- **C4. Códigos y campos de error.** Los nombres son distintos y la web pide `message` y `retryable`. El 413 y el 503 no existen en la web. Hay que acordar el catálogo completo.
- **C5. Estación distinta y fallo del proveedor.** El código responde 200 con plantilla (RF-18: ninguna pantalla con error técnico). La web los modela como error. La decisión afecta a la interfaz (M-INTERFAZ, UraqiVision) y debe acordarse con ella.

Mientras no se acuerden C1 a C5, la ruta HTTP no se implementa. DP-04 (límites) y DP-06 (hospedaje) siguen pendientes.
