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
