# SDD de UraqiVision · backend

Guía para implementar el pipeline y la función Insight de UraqiVision **desde cero**, tal como los define el
documento maestro (`docs/UraqiVisionDocumentoMaestrov1.1.pdf`), con **Spec-Driven Development** (Spec Kit):
primero la especificación, después el código. Este repositorio es el backend; la web tiene su propio SDD en
[`UraqiVision`](https://github.com/marianZamorano/UraqiVision).

## Cómo está organizado

Un SDD por área de §19, todos con la misma estructura ([`00-estructura.md`](00-estructura.md)):

| SDD | Área | Responsable (§19) | Spec de Spec Kit |
|---|---|---|---|
| [`01-proyecto.md`](01-proyecto.md) | Constitución, entorno Python, repositorio y licencias | Equipo · Tabata y Mimi (§25) | `specs/001-base-pipeline` |
| [`m-ingesta.md`](m-ingesta.md) | M-INGESTA · Búsqueda, recorte y descarga de escenas | Alex | `specs/002-ingesta` |
| [`m-ciencia.md`](m-ciencia.md) | M-CIENCIA · Cambio de HV, parches, clases y hectáreas | Tabata | `specs/003-ciencia` |
| [`m-validacion.md`](m-validacion.md) | M-VALIDACIÓN · Sentinel-2, focos de calor y controles de calidad | Tabata, con apoyo de Alex | `specs/004-validacion` |
| [`m-publicacion.md`](m-publicacion.md) | M-PUBLICACIÓN · Vistas, GeoJSON, CSV y textos de cada estación | Mimi | `specs/005-publicacion` |
| [`m-insight.md`](m-insight.md) | M-INSIGHT · Función serverless, adaptador, límites y plantillas | Mimi | `specs/006-insight` |
| [`90-integracion.md`](90-integracion.md) | Estación publicada de punta a punta, revisión científica y entrega | Equipo | `specs/007-integracion` |

Los módulos M-GLOBO, M-MAPA, M-ATLAS y M-INTERFAZ son de la web. El backend le entrega dos contratos: los archivos
publicados de cada estación (§17.3) y `POST /api/insight` (§21.1).

## Cómo se usa (cada prompt)

1. **Quién eres**: el asistente pregunta con opción múltiple qué colaborador eres (§19) si aún no lo sabe.
2. **Qué sigue**: `npm run sdd:siguiente -- --yo` imprime tu siguiente prompt, listo para copiar.
3. **Pega el prompt** en tu asistente. Empieza con su etiqueta (`[SDD P-INGESTA-01]`). El hook del mensaje lo
   reconoce y el asistente **te pregunta antes de ejecutarlo** (opción múltiple): ejecutarlo tal cual,
   modificarlo antes o posponerlo. Si no eres quien lo ejecuta según el SDD, te avisa que es apoyo a otro rol.
4. **Se ejecuta** el comando de Spec Kit (o la skill) del prompt, con sus puntos de control.
5. **Al terminar**, el asistente registra el resultado en el historial y **te muestra el siguiente prompt** en un
   bloque listo para copiar y pegar. Si lo olvida, el hook de fin de turno se lo exige.
6. **Commitea** lo producido y la entrada del historial en la rama de tu issue (skill `flujo-issues-y-pr`).

| Comando | Para qué |
|---|---|
| `npm run sdd:estado` | Progreso de cada SDD, conflictos y tu siguiente prompt |
| `npm run sdd:siguiente -- --yo` | Tu siguiente prompt, listo para copiar (`--asistente codex\|gemini\|opencode` lo adapta) |
| `npm run sdd:ver -- P-CIENCIA-03` | Un prompt concreto |
| `npm run sdd:historial` | Qué pasó con cada prompt: decisiones, resultados, cambios y conflictos |
| `npm run sdd:validar` | Que todos los SDD conserven la estructura común |

Los comandos de registro los ejecuta el asistente:
`node ai/scripts/sdd.mjs confirmar <ID> --decision ejecutar|modificar|omitir` antes de ejecutar y
`node ai/scripts/sdd.mjs registrar <ID> --resultado hecho|parcial|conflicto|en-espera` al terminar.

### Comandos de Spec Kit en cada asistente

Los prompts usan la sintaxis de Claude Code. `npm run sdd:siguiente -- --asistente <nombre>` los convierte:

| Claude Code | Codex CLI | Gemini CLI | opencode |
|---|---|---|---|
| `/speckit-specify` | `$speckit-specify` | `/speckit.specify` | `/speckit.specify` |

## Historial de prompts

Cada confirmación y cada resultado es un archivo JSON en [`historial/`](historial/) (uno por entrada: varias
personas pueden registrar a la vez sin conflictos de merge). Guarda quién, cuándo, en qué rama, la decisión, el
resultado, una nota y la huella del texto del prompt. Con eso `npm run sdd:estado` detecta:

- **prompts modificados después de ejecutarse**: el texto cambió desde que se marcó «hecho»;
- **dependencias re-ejecutadas**: una dependencia se volvió a ejecutar después; el resultado puede no valer;
- **conflictos declarados**: un prompt registrado como «conflicto», con su nota.

Un prompt se puede **cambiar** cuando haga falta: se edita en su archivo (con issue, rama y PR) y su ejecución
queda registrada con la decisión «modificar» y el motivo.

## Herramientas que intervienen

| Momento | Herramienta | Qué hace |
|---|---|---|
| Antes de todo | Skill `documento-maestro` | Buscar requisitos por identificador y comprobar el alcance |
| Cada prompt | Skill `sdd-prompts` | Confirmar con la persona, ejecutar, registrar y entregar el siguiente |
| Cada prompt | Hook del mensaje (`prompt-guard`) | Reconoce `[SDD P-…]`, pide confirmar y avisa de dependencias, cambios y apoyo |
| Fin de cada prompt | Hook de fin de turno (`fin-turno`, Stop o AfterAgent) | Exige registrar el resultado y mostrar el siguiente prompt |
| Especificación y plan | Subagente `guardian-alcance` | Revisa el plan y las tareas contra §8, §16, §28 y §29 |
| Plan | MCP `context7` | Documentación vigente de asf_search, earthaccess, GDAL, rasterio, xarray y GeoPandas |
| Implementación | Skills `test-driven-development`, `python-geoespacial`, `ingesta-nisar-asf`, `ciencia-radar-nisar`, `validacion-optica-firms`, `publicacion-estacion`, `insight-lector-radar`, `notebook-reproducible` | Prueba primero y reglas de cada área |
| Verificación | Subagentes `revisor-cientifico`, `auditor-publicacion`, `revisor-insight`, `revisor-qa`, `security-qa-engineer`; MCP `qa-evidence` | Ciencia, archivos publicados, Insight y pruebas con evidencia |
| Commits | Hooks de git | Issue en cada commit, división por temas, secretos, coherencia y estructura de los SDD |
| Promoción a qa y main | Revisor de código vivo, `release-readiness-reviewer` | Sin código roto ni muerto; veredicto de despliegue |
| Coordinación | Skill `vibecodear` | Toma el siguiente prompt de tus módulos como objetivo del Sprint |

## Orden de los prompts

Orden global según el plan del hackathon (§25). Cada área avanza en paralelo con su responsable; respeta las
dependencias. Esta tabla se genera de los SDD (`npm run ai:sync`).

<!-- sdd:orden (generado por ai/sync.mjs desde sdd/*.md; no editar a mano) -->

| # | Prompt | Paso | SDD | Comando | Ejecuta | Depende de | Momento (§25) |
|---|---|---|---|---|---|---|---|
| 1 | `P-PROY-01` | Constitución | [PROYECTO](01-proyecto.md) | `speckit-constitution` | Equipo | — | Antes del sábado 14 |
| 2 | `P-PROY-02` | Especificar la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-specify` | Tabata, Mimi | P-PROY-01 | Antes del sábado 14 (entorno Python; repositorio y licencias) |
| 3 | `P-PROY-03` | Planificar la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-plan` | Tabata, Mimi | P-PROY-02 | Antes del sábado 14 |
| 4 | `P-PROY-04` | Tareas de la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-tasks` | Tabata, Mimi | P-PROY-03 | Antes del sábado 14 |
| 5 | `P-PROY-05` | Analizar la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-analyze` | Tabata, Mimi | P-PROY-04 | Antes del sábado 14 |
| 6 | `P-PROY-06` | Implementar la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-implement` | Tabata, Mimi | P-PROY-05 | Antes del sábado 14, o sábado 9:00 si DP-02 no lo permite |
| 7 | `P-PROY-07` | Verificar la base del pipeline | [PROYECTO](01-proyecto.md) | `speckit-converge` | Tabata, Mimi | P-PROY-06 | Antes del sábado 14 |
| 8 | `P-INGESTA-01` | Especificar | [M-INGESTA](m-ingesta.md) | `speckit-specify` | Alex | P-PROY-01 | Antes del sábado 14 |
| 9 | `P-CIENCIA-01` | Especificar | [M-CIENCIA](m-ciencia.md) | `speckit-specify` | Tabata | P-PROY-01 | Antes del sábado 14 |
| 10 | `P-VALIDACION-01` | Especificar | [M-VALIDACIÓN](m-validacion.md) | `speckit-specify` | Tabata | P-PROY-01 | Antes del sábado 14 |
| 11 | `P-PUBLICACION-01` | Especificar | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-specify` | Mimi | P-PROY-01 | Antes del sábado 14 |
| 12 | `P-INSIGHT-01` | Especificar | [M-INSIGHT](m-insight.md) | `speckit-specify` | Mimi | P-PROY-01 | Antes del sábado 14 |
| 13 | `P-INT-01` | Especificar la integración | [INTEGRACION](90-integracion.md) | `speckit-specify` | Equipo | P-INGESTA-01, P-CIENCIA-01, P-VALIDACION-01, P-PUBLICACION-01, P-INSIGHT-01 | Antes del sábado 14 |
| 14 | `P-INGESTA-02` | Aclarar | [M-INGESTA](m-ingesta.md) | `speckit-clarify` | Alex | P-INGESTA-01 | Antes del sábado 14 |
| 15 | `P-INGESTA-03` | Planificar | [M-INGESTA](m-ingesta.md) | `speckit-plan` | Alex | P-INGESTA-02 | Antes del sábado 14 |
| 16 | `P-INGESTA-04` | Tareas | [M-INGESTA](m-ingesta.md) | `speckit-tasks` | Alex | P-INGESTA-03 | Antes del sábado 14 |
| 17 | `P-INGESTA-05` | Analizar | [M-INGESTA](m-ingesta.md) | `speckit-analyze` | Alex | P-INGESTA-04 | Antes del sábado 14 |
| 18 | `P-CIENCIA-02` | Aclarar | [M-CIENCIA](m-ciencia.md) | `speckit-clarify` | Tabata | P-CIENCIA-01 | Antes del sábado 14 |
| 19 | `P-CIENCIA-03` | Planificar | [M-CIENCIA](m-ciencia.md) | `speckit-plan` | Tabata | P-CIENCIA-02 | Antes del sábado 14 |
| 20 | `P-CIENCIA-04` | Tareas | [M-CIENCIA](m-ciencia.md) | `speckit-tasks` | Tabata | P-CIENCIA-03 | Antes del sábado 14 |
| 21 | `P-CIENCIA-05` | Analizar | [M-CIENCIA](m-ciencia.md) | `speckit-analyze` | Tabata | P-CIENCIA-04 | Antes del sábado 14 |
| 22 | `P-PUBLICACION-02` | Aclarar | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-clarify` | Mimi | P-PUBLICACION-01 | Antes del sábado 14 |
| 23 | `P-PUBLICACION-03` | Planificar | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-plan` | Mimi | P-PUBLICACION-02 | Antes del sábado 14 |
| 24 | `P-PUBLICACION-04` | Tareas | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-tasks` | Mimi | P-PUBLICACION-03 | Antes del sábado 14 |
| 25 | `P-PUBLICACION-05` | Analizar | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-analyze` | Mimi | P-PUBLICACION-04 | Antes del sábado 14 |
| 26 | `P-INGESTA-06` | Implementar búsqueda, descarga y recorte | [M-INGESTA](m-ingesta.md) | `speckit-implement` | Alex | P-INGESTA-05, P-PROY-07 | Sáb 9:00–13:00 |
| 27 | `P-CIENCIA-06` | Implementar línea base, cociente, parches y fenología | [M-CIENCIA](m-ciencia.md) | `speckit-implement` | Tabata | P-CIENCIA-05, P-PROY-07, P-INGESTA-06 | Sáb 9:00–13:00 MC-02 · Sáb 14:00–20:00 MC-03 a MC-05 |
| 28 | `P-PUBLICACION-06` | Implementar la estructura de publicación | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-implement` | Mimi | P-PUBLICACION-05, P-PROY-07 | Sáb 9:00–13:00 |
| 29 | `P-INSIGHT-02` | Aclarar | [M-INSIGHT](m-insight.md) | `speckit-clarify` | Mimi | P-INSIGHT-01 | Sáb 14:00 |
| 30 | `P-INSIGHT-03` | Planificar | [M-INSIGHT](m-insight.md) | `speckit-plan` | Mimi | P-INSIGHT-02 | Sáb 14:00–20:00 |
| 31 | `P-INSIGHT-04` | Tareas | [M-INSIGHT](m-insight.md) | `speckit-tasks` | Mimi | P-INSIGHT-03 | Sáb 14:00–20:00 |
| 32 | `P-INSIGHT-05` | Analizar | [M-INSIGHT](m-insight.md) | `speckit-analyze` | Mimi | P-INSIGHT-04 | Sáb 14:00–20:00 |
| 33 | `P-INSIGHT-06` | Implementar la función y las plantillas | [M-INSIGHT](m-insight.md) | `speckit-implement` | Mimi | P-INSIGHT-05, P-PROY-07 | Sáb 14:00–20:00 |
| 34 | `P-INGESTA-07` | Implementar huellas, focos FIRMS y escenas VALIDATED | [M-INGESTA](m-ingesta.md) | `speckit-implement` | Alex | P-INGESTA-06 | Sáb 14:00–20:00 huellas y focos · Sáb 20:00–24:00 escenas VALIDATED |
| 35 | `P-VALIDACION-02` | Aclarar | [M-VALIDACIÓN](m-validacion.md) | `speckit-clarify` | Tabata | P-VALIDACION-01 | Sáb 14:00–20:00 |
| 36 | `P-VALIDACION-03` | Planificar | [M-VALIDACIÓN](m-validacion.md) | `speckit-plan` | Tabata | P-VALIDACION-02 | Sáb 14:00–20:00 |
| 37 | `P-VALIDACION-04` | Tareas | [M-VALIDACIÓN](m-validacion.md) | `speckit-tasks` | Tabata | P-VALIDACION-03 | Sáb 14:00–20:00 |
| 38 | `P-VALIDACION-05` | Analizar | [M-VALIDACIÓN](m-validacion.md) | `speckit-analyze` | Tabata | P-VALIDACION-04 | Sáb 14:00–20:00 |
| 39 | `P-CIENCIA-07` | Implementar clases y hectáreas | [M-CIENCIA](m-ciencia.md) | `speckit-implement` | Tabata | P-CIENCIA-06 | Sáb 20:00–24:00 hectáreas · Dom 9:00–14:00 MC-06 |
| 40 | `P-VALIDACION-06` | Implementar controles y validación | [M-VALIDACIÓN](m-validacion.md) | `speckit-implement` | Tabata | P-VALIDACION-05, P-CIENCIA-06, P-INGESTA-07 | Sáb 20:00–24:00 CQ · Dom 9:00–14:00 VC |
| 41 | `P-PUBLICACION-07` | Publicar las preguntas 1 y 2 | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-implement` | Mimi | P-PUBLICACION-06, P-CIENCIA-07, P-VALIDACION-06 | Sáb 20:00–24:00 pregunta 1 · Dom 9:00–14:00 pregunta 2 |
| 42 | `P-INT-02` | Planificar la integración | [INTEGRACION](90-integracion.md) | `speckit-plan` | Equipo | P-INT-01 | Sáb 20:00–24:00 |
| 43 | `P-INT-03` | Tareas de la integración | [INTEGRACION](90-integracion.md) | `speckit-tasks` | Equipo | P-INT-02 | Sáb 20:00–24:00 |
| 44 | `P-INT-04` | Implementar la integración | [INTEGRACION](90-integracion.md) | `speckit-implement` | Equipo | P-INT-03, P-PUBLICACION-07, P-INSIGHT-06 | Dom 9:00–14:00 |
| 45 | `P-INGESTA-08` | Verificar | [M-INGESTA](m-ingesta.md) | `speckit-converge` | Alex | P-INGESTA-07 | Dom 14:00–19:00 |
| 46 | `P-CIENCIA-08` | Verificar | [M-CIENCIA](m-ciencia.md) | `speckit-converge` | Tabata | P-CIENCIA-07 | Dom 14:00–19:00 (revisión de umbrales y sensibilidad) |
| 47 | `P-VALIDACION-07` | Verificar | [M-VALIDACIÓN](m-validacion.md) | `speckit-converge` | Tabata | P-VALIDACION-06 | Dom 14:00–19:00 |
| 48 | `P-PUBLICACION-08` | Verificar | [M-PUBLICACIÓN](m-publicacion.md) | `speckit-converge` | Mimi | P-PUBLICACION-07 | Dom 14:00–19:00 |
| 49 | `P-INSIGHT-07` | Verificar | [M-INSIGHT](m-insight.md) | `speckit-converge` | Mimi | P-INSIGHT-06 | Dom 14:00–19:00 (pruebas de Insight) |
| 50 | `P-INT-05` | Revisión científica y de referencias | [INTEGRACION](90-integracion.md) | `speckit-converge` | Tabata, Alex | P-INT-04, P-INGESTA-08, P-CIENCIA-08, P-VALIDACION-07, P-PUBLICACION-08, P-INSIGHT-07 | Dom 19:00–23:00 |
| 51 | `P-INT-06` | Preparar la entrega y el despliegue | [INTEGRACION](90-integracion.md) | `entrega-hackathon` | Mimi | P-INT-05 | Dom 19:00–23:00 (despliegue final, sujeto a DP-06) |
| 52 | `P-INT-07` | Pedir la promoción a qa y main | [INTEGRACION](90-integracion.md) | `flujo-issues-y-pr` | Equipo | P-INT-06 | Dom 19:00–23:00, solo cuando la persona lo pida |

<!-- /sdd:orden -->

## Reglas

- El documento maestro manda. Las decisiones pendientes de §29 (DP-01 a DP-08) no se deciden en un prompt: se
  marcan como pendientes.
- Hasta la fase de implementación solo se escriben artefactos de Spec Kit (`.specify/`, `specs/`).
- Ninguna implementación sin la aprobación de la persona en el análisis (⛔).
- Cada spec, tarea, prueba y commit cita sus identificadores (RF, RNF, RN, MC, CQ, VC, PS).
- Ninguna credencial de Earthdata ni clave del proveedor de IA en el repositorio (RNF-06): `.netrc` y `.env` solo locales.
- Las promociones a `qa` y `main` solo se abren cuando la persona las pide.
