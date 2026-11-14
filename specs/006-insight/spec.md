# Feature Specification: Insight, lector de radar de la estación abierta

**Feature Branch**: `006-insight`

**Created**: 2026-11-14

**Status**: Draft — propuesta de Mimi (responsable de M-INSIGHT); revisión de Marian

**Input**: Prompt `[SDD P-INSIGHT-01]` de `sdd/m-insight.md` y el documento maestro (§8.2, §21, §23.3, §28; RF-16 a
RF-18; RN-09, RN-10, RN-14; RNF-06, RNF-07; PS-05).

**Módulo (§19)**: M-INSIGHT · función Insight, adaptador, límites y plantillas de respaldo.

> **Estado de la base.** P-PROY-01 se registró como ejecutada (constitución en `.specify/memory/constitution.md`), pero
> la constitución es **propuesta pendiente de ratificación** por el equipo. Esta spec no se apoya en ella: la fuente
> de los requisitos es solo el documento maestro.

## Contexto y límites

Insight es un **lector de radar**: ayuda a interpretar lo que el usuario tiene en pantalla. No calcula resultados,
no consulta internet y no reemplaza el método ni las fichas. La función vive en el servidor; el navegador solo
conoce el contrato de §21.1.

- **Fuera de alcance**: cálculos, pronósticos, estimaciones de daño a personas o bienes, recomendaciones de
  emergencia, cuentas de usuario y bases de datos (§8.2). Cualquier pregunta sobre otra estación queda fuera.
- **No se decide aquí**: los límites de uso (**DP-04**, Mimi, sábado) y el hospedaje (**DP-06**, Mimi, sábado).
  Quedan como pendientes; los valores de §21 («a fijar en las pruebas») no se toman por cuenta propia.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preguntar sobre la estación abierta (Priority: P1)

Quien mira una estación pregunta en lenguaje libre y recibe una respuesta en el idioma que eligió, basada solo en el
contenido publicado de esa estación, con la sección de la que sale.

**Why this priority**: es la función central de Insight (OE5, RF-16) y la que no debe inventar nada (RN-09).

**Independent Test**: con un `station.json` de prueba, una pregunta libre produce una respuesta en el idioma elegido
con al menos una cita a una sección existente (PS-05).

**Acceptance Scenarios**:

1. **Given** una estación abierta y el idioma `es`, **When** se pregunta algo que está en su contenido, **Then** la
   respuesta está en español y cita la sección de la que sale (RF-16, PS-05).
2. **Given** una pregunta que el contenido publicado no responde, **When** se contesta, **Then** la respuesta dice que
   no está en el contenido de la estación y no inventa cifras ni causas (RN-09, RN-10).
3. **Given** una pregunta sobre otra estación, **When** se contesta, **Then** Insight no responde sobre ella y lo
   explica (RN-10).

---

### User Story 2 - Preguntas sugeridas en ambos idiomas (Priority: P2)

Quien abre la estación ve de 3 a 5 preguntas sugeridas, en español e inglés, para empezar sin escribir.

**Why this priority**: baja la barrera de entrada y evita preguntas fuera del alcance (RF-17).

**Independent Test**: `station.json` de prueba tiene de 3 a 5 preguntas en `es` y en `en`.

**Acceptance Scenarios**:

1. **Given** una estación publicada, **When** se piden las sugerencias, **Then** hay entre 3 y 5 preguntas en cada
   idioma (RF-17, RNF-03).
2. **Given** una estación con menos de 3 preguntas en un idioma, **When** se publica, **Then** la carpeta no pasa el
   chequeo de contenido (PS-03).

---

### User Story 3 - Respaldo sin pantalla vacía (Priority: P1)

Si el proveedor de IA falla o se agota el saldo, Insight responde con textos de plantilla, sin error técnico ni pantalla
vacía.

**Why this priority**: la función debe seguir sirviendo en la demostración aunque el proveedor falle (RF-18, §21).

**Independent Test**: simular un fallo del adaptador produce una respuesta de plantilla con `source = "plantilla"`.

**Acceptance Scenarios**:

1. **Given** el proveedor responde con error, **When** se pregunta, **Then** se devuelve una plantilla en el idioma
   elegido con `source = "plantilla"` y sin detalle técnico (RF-18).
2. **Given** el saldo del proveedor está agotado, **When** se pregunta, **Then** el resultado es el mismo que en el caso
   anterior (RF-18).

---

### User Story 4 - Límites y seguridad (Priority: P2)

Insight limita preguntas y longitud de texto, y la clave del proveedor nunca sale del servidor.

**Why this priority**: controla el costo (RNF-10) y evita que la clave llegue al navegador o al repositorio (RNF-06).

**Independent Test**: una pregunta más larga que el límite se rechaza con un mensaje claro; ninguna respuesta ni archivo
contiene la clave.

**Acceptance Scenarios**:

1. **Given** una pregunta más larga que el límite de caracteres, **When** se envía, **Then** se rechaza con un mensaje
   claro y no llega al proveedor (RNF-07). El valor del límite está pendiente (DP-04).
2. **Given** la respuesta de la función o el bundle de la web, **When** se busca la clave del proveedor, **Then** no
   aparece (RNF-06, PS-06).

---

### Edge Cases

- Pregunta vacía o solo espacios: se rechaza sin llamar al proveedor.
- Pregunta en un idioma distinto al elegido: se responde en el idioma elegido.
- Se pide confirmar una causa sin fuente: Insight dice que no puede y explica por qué (RN-14).
- Se pide un pronóstico o una estimación de daños: Insight lo declina (RN-10).
- El adaptador de proveedor cambia: se cambia el adaptador y la configuración, sin tocar la web (§21.2).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Responder preguntas libres sobre la estación abierta, en el idioma elegido (es o en), solo con
  `station.json` de esa estación, la página de método y el glosario (RF-16, RN-09).
- **FR-002**: Citar en cada respuesta la sección de la que sale (RF-16, PS-05).
- **FR-003**: Ofrecer de 3 a 5 preguntas sugeridas por estación en español e inglés (RF-17, RNF-03).
- **FR-004**: Devolver textos de plantilla en el idioma elegido si el proveedor falla o se agota el saldo, con
  `source = "plantilla"`, sin error técnico (RF-18).
- **FR-005**: No estimar daños a personas, no pronosticar, no recomendar acciones de emergencia, no inventar cifras y no
  responder sobre otras estaciones (RN-10).
- **FR-006**: Si se pide confirmar una causa sin fuente, responder que no puede y explicar por qué (RN-14, RN-05).
- **FR-007**: Exponer el contrato `POST /api/insight` con `station_id`, `question` y `lang`, y devolver `answer`,
  `citations` y `source` (§21.1, **propuesta de diseño**).
- **FR-008**: Usar un adaptador de proveedor que traduzca la llamada `explicar(estación, pregunta, idioma)` al proveedor
  configurado; el proveedor y el modelo se configuran con variables de entorno (§21.2).
- **FR-009**: Limitar el número de preguntas por sesión y la longitud de cada pregunta; los valores son **DP-04** y no
  se fijan aquí (RNF-07).
- **FR-010**: Nunca enviar la clave del proveedor al navegador ni guardarla en el repositorio; vive solo en el servidor
  (RNF-06, PS-06).
- **FR-011**: Registrar en los logs solo lo necesario, sin datos sensibles ni la clave (RNF-06).

### Key Entities

- **Estación abierta**: la estación cuyo `station.json`, método y glosario Insight puede usar.
- **Pregunta**: texto libre del usuario, con idioma y estación.
- **Respuesta**: `answer` (texto), `citations` (secciones de las que sale) y `source` (`ia` o `plantilla`).
- **Plantilla de respaldo**: texto fijo por idioma para cuando el proveedor no responde.
- **Adaptador de proveedor**: traduce la llamada interna al proveedor configurado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las respuestas en el idioma elegido cita al menos una sección existente de la estación
  (RF-16, PS-05), o declara que no está en su contenido.
- **SC-002**: Ninguna respuesta contiene una cifra, un pronóstico ni una estimación de daño que no esté en el contenido
  publicado (RN-10, RN-09).
- **SC-003**: Cuando el proveedor falla, el 100 % de las respuestas es una plantilla sin error técnico (RF-18).
- **SC-004**: La clave del proveedor no aparece en el bundle, en el repositorio ni en las respuestas (RNF-06, PS-06).
- **SC-005**: Una pregunta que excede el límite se rechaza sin llamar al proveedor (RNF-07).

## Decisiones pendientes (no se resuelven en esta spec)

| ID | Pendiente | Responsable | Efecto en Insight |
|---|---|---|---|
| DP-04 | Límites de uso: preguntas por sesión y caracteres por pregunta | Mimi (sábado) | Valores de FR-009 y de SC-005 |
| DP-06 | Hospedaje final: GitHub Pages o Vercel | Mimi (sábado) | Dónde se despliega la función serverless |

**Nota sobre DP-06.** §18 nombra Vercel como alojamiento de la función serverless de Insight. Eso no es una decisión
tomada: DP-06 sigue abierta. Que GitHub Pages no pueda alojar una función serverless es una **hipótesis técnica a
verificar** antes de decidir, no un hecho. Esta spec no asume ninguna de las dos opciones.

## Aclaraciones pendientes (para P-INSIGHT-02)

- Cómo se aplican los límites por usuario sin cuentas. Restricción: el mecanismo **no** puede exigir cuentas, base de
  datos ni colas (§8.2). Si la respuesta exige estado persistente, se lleva al equipo como conflicto con §8.2.
- Qué secciones se pueden citar.
- Qué hace la función si la pregunta es sobre otra estación.
- Cómo se eligen las plantillas de respaldo.
- Qué se registra en los logs sin datos sensibles.

## Assumptions

- El contenido de cada estación (`station.json`, método y glosario) lo publica M-PUBLICACIÓN con textos en español e
  inglés (RNF-03).
- El proveedor de IA es Claude, configurable por variables de entorno (§21); su costo se trata como excepción de
  RNF-10.
- La web solo conoce el contrato de §21.1; el adaptador es la única parte que habla con el proveedor (§21.2).
- Esta spec no elige modelo ni versión del proveedor; eso se decide en el plan (P-INSIGHT-03) con documentación vigente.

## Referencias de §31 que aplican

- Claude (Anthropic) — proveedor propuesto en §21; la documentación vigente de la API se consulta al implementar el
  adaptador (MCP `context7`). Sin fuente bibliográfica fija en §31: no se cita como referencia de datos.
- NASA-ISRO SAR (NISAR) mission science users' handbook (2.ª ed.) — <https://doi.org/10.48577/jpl.UD4HV3> (RN-09,
  RF-19): fundamentos del radar para las explicaciones de Insight y el glosario.

Las fuentes se citan en APA 7 donde se implementen; esta spec no añade otras.
