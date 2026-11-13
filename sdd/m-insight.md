---
id: M-INSIGHT
titulo: Función Insight, adaptador, límites y plantillas
tipo: modulo
prefijo: INSIGHT
spec: specs/006-insight
---

# SDD · M-INSIGHT — Función Insight, adaptador, límites y plantillas

Insight es un lector de radar (§21): ayuda a interpretar lo que el usuario tiene en pantalla, en su idioma y
citando la sección de la que sale cada respuesta. Es la única pieza que corre en un servidor (§17), detrás de un
adaptador de proveedor y con plantillas de respaldo.

## 1. Ficha

| Campo | Valor |
|---|---|
| Módulo (§19) | M-INSIGHT · «Función serverless, adaptador, límites y plantillas» |
| Responsable | Mimi |
| Revisora | Marian |
| Repositorio | `UraqiVisionBack` (backend); la interfaz que la llama vive en `UraqiVision` |
| Spec | `specs/006-insight` |
| Momento (§25) | Sáb 14:00–20:00 función Insight y plantillas · Dom 14:00–19:00 pruebas de Insight · Dom 19:00–23:00 despliegue final (DP-06) |

## 2. Alcance del documento maestro

| ID | Requisito (§13) | Prioridad |
|---|---|---|
| RF-16 | Pregunta libre sobre la estación abierta, en el idioma elegido; responde solo con el contenido de la estación y cita la sección | MVP |
| RF-17 | 3 a 5 preguntas sugeridas por estación, en ambos idiomas | MVP |
| RF-18 | Respaldo: si el proveedor falla, textos de plantilla; ninguna pantalla vacía o con error técnico | MVP |

§21: fuentes de respuesta (station.json de la estación abierta, la página de método y el glosario), idioma, citas,
respaldo, límites y lo que no hace. §21.1: contrato propuesto `POST /api/insight` con `station_id`, `question` y
`lang`; respuesta `answer`, `citations` y `source` («ia» o «plantilla»). §21.2: la web solo conoce
`explicar(estación, pregunta, idioma)`; un adaptador traduce la llamada al proveedor configurado. Historias: CU-02,
CU-05, HU-03.

## 3. Reglas y decisiones que aplican

- RN-09 (solo con el contenido publicado de la estación, el método y el glosario), RN-10 (no estima daños a
  personas, no pronostica, no recomienda acciones de emergencia), RN-14 (si se le pide confirmar una causa sin
  fuente, responde que no puede y por qué); no inventa cifras ni responde sobre otras estaciones (§21).
- RNF-06 (la clave del proveedor nunca llega al navegador ni al repositorio: solo en el servidor), RNF-07 (límite
  de preguntas por usuario y de longitud del texto), RNF-10 (planes gratuitos salvo el consumo del proveedor).
- §18: función serverless (Vercel) con adaptador de proveedor; proveedor y modelo por variables de entorno.
- **Pendientes** de Mimi: DP-04 (límites de uso: preguntas por sesión y caracteres) y DP-06 (hospedaje final). No
  se deciden en un prompt; los límites quedan configurables y no se despliega sin la decisión del equipo.

## 4. Contratos e integración

- **Expone**: `POST /api/insight` (§21.1, propuesta de diseño). Cualquier cambio se acuerda con la web.
- **Consume**: `station.json` publicado por M-PUBLICACIÓN (incluidas las preguntas sugeridas de RF-17), la página de
  método y el glosario de la web.
- **Se coordina con**: la web (`UraqiVision`, `sdd/90-integracion.md`, interfaz de Insight) y M-PUBLICACIÓN.
- **Variables de entorno**: la clave y la configuración del proveedor viven en `.env` local y en el servidor; si se
  agregan claves a `.env.example` (sin valores), hay que avisar al equipo (pausa del pre-commit).

## 5. Calidad: pruebas y aceptación

- PS-05 (responde en el idioma elegido, cita la sección y usa plantillas si falla: RF-16 a RF-18), PS-06 (la clave
  no aparece en el bundle ni en el repositorio), prueba de límites (RNF-07).
- Criterios de §13: responde solo con el contenido de la estación y cita la sección (RF-16); ninguna pantalla vacía
  o con error técnico (RF-18).

## 6. Herramientas del repositorio

- Skills: `insight-lector-radar`, `devops-secrets-management`, `qa-security-testing`, `test-driven-development`,
  `devops-free-tier-audit`.
- Subagentes: `revisor-insight`, `security-qa-engineer`, `devsecops-engineer`, `free-tier-architect`.
- MCP: `context7` (SDK del proveedor y de la función serverless), `devops-readiness`.
- Hooks: guardas de secretos y `.env`, pausa al cambiar la estructura del `.env`, pre-commit, código vivo.

## 7. Riesgos y pendientes

- §24: costo o abuso de Insight → límites por sesión y plantillas de respaldo.
- DP-04 y DP-06 pendientes (Mimi). Mientras no haya despliegue, la web usa las plantillas, nunca respuestas
  inventadas.
- La interfaz de Insight en la web no tiene responsable en §19 dentro del frontend: acordarlo con el equipo.

## 8. Secuencia de prompts

### P-INSIGHT-01 · Especificar
- **Orden:** 12
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/006-insight/spec.md
- **Herramientas:** skills `documento-maestro`, `insight-lector-radar`
- **Verificación:** cada requisito conserva su identificador; DP-04 y DP-06 marcadas como pendientes

```text
[SDD P-INSIGHT-01] /speckit-specify Feature 006-insight (número 006, nombre corto insight) del backend de UraqiVision, módulo M-INSIGHT de §19 (responsable Mimi). Función Insight, lector de radar de §21: responde preguntas libres sobre la estación abierta en el idioma elegido, solo con station.json de esa estación, la página de método y el glosario, y cita la sección de cada respuesta (RF-16, RN-09); ofrece de 3 a 5 preguntas sugeridas por estación en ambos idiomas (RF-17); si el proveedor falla o se agota el saldo, responde con textos de plantilla y nunca deja una pantalla vacía o con error técnico (RF-18). No calcula resultados, no consulta internet, no estima daños, no pronostica, no recomienda acciones de emergencia, no inventa cifras ni responde sobre otras estaciones (RN-10, §21); si se le pide confirmar una causa sin fuente, dice que no puede y por qué (RN-14). Contrato propuesto POST /api/insight con station_id, question y lang, y respuesta answer, citations y source (§21.1); detrás, un adaptador de proveedor configurable por variables de entorno (§21.2). La clave nunca llega al navegador ni al repositorio (RNF-06); límites de preguntas y de longitud (RNF-07). Los valores de los límites (DP-04) y el hospedaje (DP-06) son decisiones pendientes: no las decidas.
```

### P-INSIGHT-02 · Aclarar
- **Orden:** 29
- **Fase:** 3 · Aclaraciones
- **Comando:** speckit-clarify
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-01
- **Momento:** Sáb 14:00
- **Produce:** sección Clarifications de specs/006-insight/spec.md
- **Herramientas:** skills `documento-maestro`, `insight-lector-radar`
- **Verificación:** máximo 5 preguntas; DP-04 y DP-06 siguen pendientes

```text
[SDD P-INSIGHT-02] /speckit-clarify Aclara la spec 006-insight con un máximo de 5 preguntas, una a la vez, con una opción recomendada basada en el documento maestro (§21). Prioriza: cómo se identifica a un usuario para los límites sin cuentas (§8.2), qué secciones se pueden citar, qué hace la función si la pregunta es sobre otra estación, cómo se eligen las plantillas de respaldo y qué se registra en los logs sin datos sensibles. Los valores de los límites (DP-04) y el hospedaje (DP-06) quedan como pendientes.
```

### P-INSIGHT-03 · Planificar
- **Orden:** 30
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-02
- **Momento:** Sáb 14:00–20:00
- **Produce:** specs/006-insight/plan.md, contracts/
- **Herramientas:** skills `insight-lector-radar`, `devops-secrets-management`, `devops-free-tier-audit`; MCP `context7`
- **Verificación:** contrato de §21.1 en contracts/ igual al de la web; clave solo en el servidor

```text
[SDD P-INSIGHT-03] /speckit-plan Función serverless con adaptador de proveedor (§18, §21.2): la lógica (fuentes, citas, límites, plantillas) no depende del proveedor; el proveedor y el modelo se configuran con variables de entorno, con su nombre en .env.example sin valores (RNF-06). Escribe el contrato de POST /api/insight en contracts/ y compáralo con el de la web (UraqiVision, specs/001-base-web/contracts): si difieren, regístralo como conflicto para acordarlo. Límites configurables hasta que se resuelva DP-04. La función se prueba en local con un proveedor simulado solo en las pruebas (nunca como respuesta real, RN-04). No despliegues (DP-06). Consulta la documentación vigente con el MCP context7.
```

### P-INSIGHT-04 · Tareas
- **Orden:** 31
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-03
- **Momento:** Sáb 14:00–20:00
- **Produce:** specs/006-insight/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** cada tarea con responsable, identificador y prueba

```text
[SDD P-INSIGHT-04] /speckit-tasks Ordena por historia: plantillas de respaldo y preguntas sugeridas primero (lo que funciona aunque no haya proveedor, RF-17 y RF-18), después la respuesta con citas (RF-16) y los límites (RNF-07). Cada tarea lleva su responsable según §19 (Mimi), su identificador y su prueba (PS-05, PS-06). Prueba antes que implementación; [P] en las paralelizables.
```

### P-INSIGHT-05 · Analizar
- **Orden:** 32
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-04
- **Momento:** Sáb 14:00–20:00
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagentes `guardian-alcance`, `revisor-insight`, `security-qa-engineer`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-INSIGHT-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/006-insight y pásalos por los subagentes guardian-alcance (alcance de §8, reglas de §16 y §21, pendientes DP-04 y DP-06), revisor-insight y security-qa-engineer (RNF-06, RNF-07). Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-INSIGHT-06 · Implementar la función y las plantillas
- **Orden:** 33
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-05, P-PROY-07
- **Momento:** Sáb 14:00–20:00
- **Produce:** función Insight con adaptador, citas, límites y plantillas (RF-16 a RF-18)
- **Herramientas:** skills `test-driven-development`, `insight-lector-radar`, `devops-secrets-management`, `flujo-issues-y-pr`
- **Verificación:** PS-05 y PS-06 en verde; prueba de límites

```text
[SDD P-INSIGHT-06] /speckit-implement Implementa specs/006-insight una tarea a la vez y prueba primero: plantillas de respaldo y preguntas sugeridas (RF-17, RF-18), respuesta con citas solo desde el contenido publicado (RF-16, RN-09), las negativas de RN-10 y RN-14 y los límites configurables (RNF-07). La clave solo en el servidor y en .env local (RNF-06): si agregas una variable, ponla sin valor en .env.example y avisa al equipo. Crea el issue y la rama tipo/N desde dev (skill flujo-issues-y-pr). No despliegues (DP-06). Detente al terminar cada historia y muéstrame la evidencia.
```

### P-INSIGHT-07 · Verificar
- **Orden:** 49
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Mimi
- **Revisa:** Marian
- **Depende de:** P-INSIGHT-06
- **Momento:** Dom 14:00–19:00 (pruebas de Insight)
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `revisor-insight`, `security-qa-engineer`, `revisor-qa`; MCP `qa-evidence`; `npm run codigo:revisar`
- **Verificación:** PS-05, PS-06 y límites con evidencia; revisión de Marian

```text
[SDD P-INSIGHT-07] /speckit-converge Compara el código con specs/006-insight y agrega como tareas lo que falte. Verifica con evidencia ejecutada RF-16 a RF-18: idioma, citas y plantillas (PS-05), la clave fuera del repositorio y de cualquier respuesta (PS-06), los límites (RNF-07), las negativas de RN-10 y RN-14 y el revisor de código vivo (npm run codigo:revisar). Pide revisión a revisor-insight y security-qa-engineer, y la revisión humana de Marian (revisora de M-INSIGHT según §19). Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] Responde en el idioma elegido, solo con el contenido de la estación, y cita la sección (RF-16, RN-09).
- [ ] Preguntas sugeridas en ambos idiomas (RF-17); plantillas si el proveedor falla (RF-18).
- [ ] Negativas de RN-10 y RN-14; límites configurables (RNF-07) a la espera de DP-04.
- [ ] Clave solo en el servidor (RNF-06, PS-06); revisado por Marian; sin código muerto.
- [ ] PR a dev fusionada y el historial del SDD registrado; despliegue solo tras DP-06.
