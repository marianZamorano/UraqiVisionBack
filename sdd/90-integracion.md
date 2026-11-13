---
id: INTEGRACION
titulo: Estación publicada de punta a punta, revisión científica y entrega
tipo: integracion
prefijo: INT
spec: specs/007-integracion
---

# SDD · INTEGRACION — Estación publicada de punta a punta, revisión científica y entrega

Une las áreas del backend: la estación San Ignacio procesada y publicada de punta a punta desde el manifiesto, el
notebook reproducible, los contratos verificados con la web, la revisión científica y de referencias, la
preparación del despliegue y la promoción a `qa` y `main`.

## 1. Ficha

| Campo | Valor |
|---|---|
| Responsables | Equipo. Según §25 (Dom 19:00–23:00): revisión científica (Tabata), revisión de referencias (Alex) y despliegue final (Mimi, sujeto a DP-06) |
| Revisión | Equipo; promoción a qa y main: todos los colaboradores excepto quien la abre |
| Repositorio | `UraqiVisionBack` (backend) |
| Spec | `specs/007-integracion` |
| Momento (§25) | Especificación antes del sábado · implementación Dom 9:00–14:00 · revisión y entrega Dom 19:00–23:00 |

## 2. Alcance del documento maestro

| ID | Requisito | Prioridad |
|---|---|---|
| RNF-08 | Reproducibilidad: cada resultado se regenera desde el manifiesto y el notebook | MVP |
| RNF-02 | Peso: los archivos de vista de la estación suman menos de 40 MB | MVP |
| RNF-09 | Integridad: los rásteres de análisis conservan exactamente sus valores | MVP |
| RF-09 | Las cifras que muestra la web coinciden con el archivo publicado | MVP |
| RF-16 a RF-18 | Insight disponible para la web por su contrato | MVP |

Flujo completo de §17.2 y caso de uso CU-06 (descarga y recorte → pipeline → validación → publicación). Estación
del MVP: San Ignacio de Velasco (§11); Tunari es solo una ficha (§11.3, §8.2).

## 3. Reglas y decisiones que aplican

- Todas las de los SDD de área; en particular RN-01, RN-02, RN-13, CQ-06, §22 y RNF-06.
- **Pendientes**: DP-06 (hospedaje, Mimi) y DP-04 (límites de Insight, Mimi); DP-02 (guías 2026, Marian). No se
  deciden en un prompt. El despliegue no se hace sin la decisión y la aprobación del equipo.
- Promociones a qa y main solo cuando la persona las pide; aprobación de todos excepto quien abre la PR.

## 4. Contratos e integración

- **Entrega a la web** (`UraqiVision`): la carpeta publicada de San Ignacio (§17.3) y `POST /api/insight` (§21.1).
  Los esquemas de M-PUBLICACIÓN y M-INSIGHT se comparan con los tipos de la web; cualquier diferencia se acuerda
  entre ambos repositorios.
- **Integra**: M-INGESTA → M-CIENCIA → M-VALIDACIÓN → M-PUBLICACIÓN, y M-INSIGHT sobre lo publicado.

## 5. Calidad: pruebas y aceptación

- PS-01, PS-02, PS-03, PS-05 y PS-06 en verde; la estación se regenera desde el manifiesto y el notebook con los
  mismos valores (RNF-08, RNF-09).
- Revisión científica (VC-01 a VC-05 revisados) y de referencias (§31, citas de datos RN-11).
- Revisor de código vivo y CI/CD por rama en la promoción (`npm run codigo:revisar`).

## 6. Herramientas del repositorio

- Skills: `notebook-reproducible`, `publicacion-estacion`, `rigor-y-fuentes`, `qa-regression-analysis`,
  `entrega-hackathon`, `flujo-issues-y-pr`, `codigo-vivo`, `verification-before-completion`,
  `devops-release-readiness`.
- Subagentes: `revisor-cientifico`, `auditor-publicacion`, `revisor-insight`, `revisor-qa`,
  `release-readiness-reviewer`, `revisor-codigo-vivo`.
- MCP: `qa-evidence`, `devops-readiness`.
- Hooks: guarda de código vivo en las promociones, aprobaciones y estado de issues.

## 7. Riesgos y pendientes

- §24: una sola persona procesa los datos; descargas lentas; humo sin Sentinel-2 limpia. El riesgo de integración es
  que un contrato difiera entre repositorios: se detecta en los planes de M-PUBLICACIÓN y M-INSIGHT.
- DP-06 sin decidir: la entrega prepara el despliegue pero no lo ejecuta.

## 8. Secuencia de prompts

### P-INT-01 · Especificar la integración
- **Orden:** 13
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** P-INGESTA-01, P-CIENCIA-01, P-VALIDACION-01, P-PUBLICACION-01, P-INSIGHT-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/007-integracion/spec.md
- **Herramientas:** skills `documento-maestro`, `notebook-reproducible`
- **Verificación:** cada requisito conserva su identificador; DP-06 marcada como pendiente

```text
[SDD P-INT-01] /speckit-specify Feature 007-integracion (número 007, nombre corto integracion) del backend de UraqiVision. La estación San Ignacio de Velasco se procesa y publica de punta a punta siguiendo el flujo de §17.2 y el caso CU-06 (descarga y recorte → pipeline → validación → publicación) y se regenera con los mismos valores desde el manifiesto y el notebook reproducible (RNF-08, RNF-09); las vistas suman menos de 40 MB (RNF-02); las cifras publicadas son las que mostrará la web (RF-09); los contratos con la web (archivos de §17.3 y POST /api/insight de §21.1) se verifican contra los tipos de UraqiVision; Insight queda disponible por su contrato (RF-16 a RF-18). El despliegue depende del hospedaje (DP-06), que es una decisión pendiente: no la decidas.
```

### P-INT-02 · Planificar la integración
- **Orden:** 42
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** P-INT-01
- **Momento:** Sáb 20:00–24:00
- **Produce:** specs/007-integracion/plan.md
- **Herramientas:** skills `notebook-reproducible`, `publicacion-estacion`
- **Verificación:** el notebook ejecuta el pipeline completo desde el manifiesto

```text
[SDD P-INT-02] /speckit-plan El notebook reproducible ejecuta el pipeline completo de San Ignacio desde el manifiesto (RNF-08) y compara los valores regenerados con los publicados (RNF-09). Una prueba de contrato compara los esquemas de specs/005-publicacion/contracts y specs/006-insight/contracts con los tipos de la web (UraqiVision, specs/001-base-web/contracts); una diferencia se registra como conflicto, no se resuelve sola. Prepara la configuración del despliegue sin ejecutarlo (DP-06).
```

### P-INT-03 · Tareas de la integración
- **Orden:** 43
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** P-INT-02
- **Momento:** Sáb 20:00–24:00
- **Produce:** specs/007-integracion/tasks.md
- **Herramientas:** skills `sdd-uraqivision`, `qa-regression-analysis`
- **Verificación:** cada tarea con responsable, identificador y prueba

```text
[SDD P-INT-03] /speckit-tasks Ordena por historia: pipeline de punta a punta desde el manifiesto, prueba de contratos con la web y preparación del despliegue. Cada tarea lleva su responsable según §19 y §25 (revisión científica: Tabata; referencias: Alex; despliegue: Mimi), su identificador y su prueba (PS-01, PS-02, PS-03, PS-05, PS-06). Prueba antes que implementación.
```

### P-INT-04 · Implementar la integración
- **Orden:** 44
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** P-INT-03, P-PUBLICACION-07, P-INSIGHT-06
- **Momento:** Dom 9:00–14:00
- **Produce:** pipeline reproducible de punta a punta y pruebas de contrato
- **Herramientas:** skills `test-driven-development`, `notebook-reproducible`, `flujo-issues-y-pr`
- **Verificación:** regeneración con los mismos valores; contratos iguales a los de la web

```text
[SDD P-INT-04] /speckit-implement Implementa specs/007-integracion una tarea a la vez y prueba primero: el notebook que regenera la estación desde el manifiesto con los mismos valores (RNF-08, RNF-09) y las pruebas de contrato con la web. Si un contrato difiere del de UraqiVision, no cambies ninguno: registra el conflicto en el historial del SDD y avísalo para acordarlo. No despliegues (DP-06). Crea el issue y la rama tipo/N desde dev; un commit por tarea. Detente al terminar cada historia y muéstrame la evidencia.
```

### P-INT-05 · Revisión científica y de referencias
- **Orden:** 50
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Tabata, Alex
- **Revisa:** Equipo
- **Depende de:** P-INT-04, P-INGESTA-08, P-CIENCIA-08, P-VALIDACION-07, P-PUBLICACION-08, P-INSIGHT-07
- **Momento:** Dom 19:00–23:00
- **Produce:** revisión científica y de referencias con evidencia y PR a dev
- **Herramientas:** subagentes `revisor-cientifico`, `auditor-publicacion`, `revisor-qa`; skill `rigor-y-fuentes`; MCP `qa-evidence`; `npm run codigo:revisar`
- **Verificación:** PS-01 a PS-03, PS-05 y PS-06 con evidencia; referencias y citas revisadas

```text
[SDD P-INT-05] /speckit-converge Compara el código con specs/007-integracion y agrega como tareas lo que falte. Tabata hace la revisión científica (§12, VC-01 a VC-05, RN-05, RN-06) con el subagente revisor-cientifico y Alex la revisión de referencias y citas de datos (§31, RN-11) con la skill rigor-y-fuentes. Verifica con evidencia ejecutada PS-01, PS-02, PS-03, PS-05 y PS-06, la regeneración desde el manifiesto (RNF-08) y el revisor de código vivo (npm run codigo:revisar); analiza los resultados con el MCP qa-evidence. Con todo en verde, abre la PR a dev con «Closes #N».
```

### P-INT-06 · Preparar la entrega y el despliegue
- **Orden:** 51
- **Fase:** Entrega
- **Comando:** entrega-hackathon
- **Ejecuta:** Mimi
- **Revisa:** Equipo
- **Depende de:** P-INT-05
- **Momento:** Dom 19:00–23:00 (despliegue final, sujeto a DP-06)
- **Produce:** checklist de entrega del backend y veredicto de despliegue
- **Herramientas:** skills `entrega-hackathon`, `devops-release-readiness`; subagentes `release-readiness-reviewer`, `free-tier-architect`; MCP `devops-readiness`
- **Verificación:** checklist completo; DP-06 resuelta antes de desplegar

```text
[SDD P-INT-06] /entrega-hackathon estado. Revisa la entrega del backend frente al plan de §25: estación publicada, Insight funcionando, licencias (RNF-11), credenciales fuera del repositorio (RNF-06), planes gratuitos (RNF-10) y declaración de dónde y cómo se usó IA (§28). Pide el veredicto del subagente release-readiness-reviewer sin desplegar. El despliegue final solo se hace cuando el equipo haya resuelto DP-06 y con su aprobación explícita.
```

### P-INT-07 · Pedir la promoción a qa y main
- **Orden:** 52
- **Fase:** Promoción
- **Comando:** flujo-issues-y-pr
- **Ejecuta:** Equipo
- **Revisa:** Equipo
- **Depende de:** P-INT-06
- **Momento:** Dom 19:00–23:00, solo cuando la persona lo pida
- **Produce:** PR dev → qa y, tras probar en preproducción, PR qa → main
- **Herramientas:** skills `flujo-issues-y-pr`, `codigo-vivo`; subagente `revisor-codigo-vivo`; guarda de código vivo
- **Verificación:** sin código roto ni muerto; aprobación de todos excepto quien abre la PR

```text
[SDD P-INT-07] /flujo-issues-y-pr Pido de forma explícita la promoción dev → qa del backend. Antes de abrirla, pasa el revisor de código vivo (npm run codigo:revisar y el subagente revisor-codigo-vivo) y muéstrame los hallazgos con su plan; si hay errores, no la abras. Lista en la descripción todos los issues que lleva (node ai/scripts/issues-de-promocion.mjs dev qa). Después de probar en preproducción, la promoción qa → main se pide aparte. Ninguna se fusiona sin la aprobación de todos los colaboradores excepto quien la abre.
```

## 9. Definición de terminado

- [ ] San Ignacio procesada y publicada de punta a punta; se regenera desde el manifiesto con los mismos valores.
- [ ] Contratos con la web verificados; Insight disponible por su contrato.
- [ ] Revisión científica (Tabata) y de referencias (Alex) completas.
- [ ] Entrega revisada; despliegue solo tras DP-06 y con aprobación del equipo.
- [ ] Promociones abiertas solo a pedido, sin código muerto y con la aprobación de todos.
