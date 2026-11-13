---
id: M-VALIDACIÓN
titulo: Validación con Sentinel-2 y focos de calor, y controles de calidad
tipo: modulo
prefijo: VALIDACION
spec: specs/004-validacion
---

# SDD · M-VALIDACIÓN — Validación y controles de calidad

Lo que da confianza a las cifras: los controles de calidad que deciden qué fechas se usan y si algo se puede
publicar (CQ-01 a CQ-06), y la validación frente al dNBR de Sentinel-2 y los focos de calor (VC-01 a VC-05).

## 1. Ficha

| Campo | Valor |
|---|---|
| Módulo (§19) | M-VALIDACIÓN · «Comparar con Sentinel-2 y focos de calor; controles de calidad» |
| Responsable | Tabata, con apoyo de Alex |
| Revisora | Mimi |
| Repositorio | `UraqiVisionBack` (backend) |
| Spec | `specs/004-validacion` |
| Momento (§25) | Sáb 20:00–24:00 CQ-01 a CQ-06 (Tabata) y apoyo a validación (Alex) · Dom 9:00–14:00 VC-01 a VC-04 (Tabata) y Sentinel-2 y dNBR (Alex) |

## 2. Alcance del documento maestro

| ID | Requisito | Prioridad |
|---|---|---|
| RF-10 | Capa de focos de calor: focos FIRMS del periodo con fecha y fuente (aquí se preparan; los muestra la web) | MVP |
| RF-11 | Validación visible: métricas frente al dNBR de Sentinel-2; si no hubo imagen válida, la alternativa usada y «validación limitada» | MVP |
| CQ-01 a CQ-06 | Controles de calidad antes de publicar (§23.2): geometría, órbita, radiometría, polarizaciones, datos válidos y procedencia | MVP |
| VC-01 a VC-05 | Validación científica (§23.1): Sentinel-2, focos FIRMS, zonas de control, sensibilidad del umbral y revisión visual | MVP |

Fuentes complementarias de §10.3. Historia: CU-04.

## 3. Reglas y decisiones que aplican

- CQ-06: no se publica hasta completar la procedencia. CQ-04: sin HV en una fecha, la vista HV se deshabilita para
  esa fecha. CQ-05: si el porcentaje de datos válidos es bajo, la cifra se marca como limitada.
- VC-02: los focos son contexto, no prueba (también fechan y clasifican). VC-05 junto con VC-02 es la alternativa si
  no hay Sentinel-2 válida, y entonces el resultado se marca como validación limitada.
- RN-02, RN-03, RN-11 (citas de datos), RN-13 (métrica no calculada: «no reportada» con su motivo, nunca cero).

## 4. Contratos e integración

- **Consume**: la serie y los resultados de M-INGESTA y M-CIENCIA; focos FIRMS (los obtiene Alex, §25) e imágenes
  Sentinel-2 para el dNBR.
- **Produce** (§17.3): `validation.json` (métricas frente a Sentinel-2 y contexto de focos) y `quality.json`
  (resultado de CQ-01 a CQ-06, fechas excluidas y su motivo), que publica M-PUBLICACIÓN y lee la web (RF-07, RF-11,
  RF-33, RF-37).
- **Se coordina con**: M-CIENCIA (umbrales, VC-03, VC-04), M-PUBLICACIÓN (qué se puede publicar).

## 5. Calidad: pruebas y aceptación

- PS-01 para los cálculos de métricas con datos sintéticos; registro de VC-05 en el notebook (RNF-08).
- Criterio de RF-11: métricas y método explicados; sin imagen válida, la estación dice «validación limitada».
- Cada control de CQ-01 a CQ-06 deja su resultado en `quality.json`; ninguna fecha se excluye sin motivo.

## 6. Herramientas del repositorio

- Skills: `validacion-optica-firms`, `ciencia-radar-nisar`, `python-geoespacial`, `notebook-reproducible`,
  `test-driven-development`, `rigor-y-fuentes`.
- Subagentes: `revisor-cientifico`, `auditor-publicacion`, `revisor-qa`.
- MCP: `context7` (rasterio, GeoPandas), `qa-evidence`.
- Hooks: pre-commit, código vivo en la promoción.

## 7. Riesgos y pendientes

- §24: humo o nubes impiden una imagen Sentinel-2 limpia → VC-02 y VC-05 y decirlo en la página de método;
  productos PROVISIONAL con artefactos en bordes → máscara de datos válidos.
- DP-03 (valores de la capa mask) condiciona CQ-05: no la decidas aquí.
- El apoyo de Alex (§19) se reparte por tareas en P-VALIDACION-04.

## 8. Secuencia de prompts

### P-VALIDACION-01 · Especificar
- **Orden:** 10
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/004-validacion/spec.md
- **Herramientas:** skills `documento-maestro`, `validacion-optica-firms`
- **Verificación:** cada requisito conserva su identificador

```text
[SDD P-VALIDACION-01] /speckit-specify Feature 004-validacion (número 004, nombre corto validacion) del backend de UraqiVision, módulo M-VALIDACIÓN de §19 (responsable Tabata, con apoyo de Alex). Controles de calidad antes de publicar (§23.2): misma geometría en toda la serie (CQ-01), mismo track y dirección con la separación entre fechas registrada (CQ-02), mismo producto y unidades con valores en rango físico (CQ-03), HH y HV presentes en cada fecha usada (CQ-04), porcentaje de datos válidos y marca de cifra limitada si es bajo (CQ-05) y procedencia completa en el manifiesto antes de publicar (CQ-06); cada fecha excluida con su motivo. Validación científica (§23.1): precisión, exhaustividad y Dice frente al dNBR de Sentinel-2 (VC-01), porcentaje de parches con al menos un foco FIRMS como contexto y no como prueba (VC-02), zonas de control (VC-03), sensibilidad del umbral (VC-04) y revisión visual registrada en el notebook (VC-05). Si no hay imagen Sentinel-2 válida, la estación dice «validación limitada» (RF-11). Focos FIRMS del periodo con fecha y fuente para la web (RF-10). Métricas no calculadas: «no reportada» con su motivo (RN-13). Historia CU-04.
```

### P-VALIDACION-02 · Aclarar
- **Orden:** 35
- **Fase:** 3 · Aclaraciones
- **Comando:** speckit-clarify
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-01
- **Momento:** Sáb 14:00–20:00
- **Produce:** sección Clarifications de specs/004-validacion/spec.md
- **Herramientas:** skills `documento-maestro`, `validacion-optica-firms`
- **Verificación:** máximo 5 preguntas; pendientes marcados

```text
[SDD P-VALIDACION-02] /speckit-clarify Aclara la spec 004-validacion con un máximo de 5 preguntas, una a la vez, con una opción recomendada basada en el documento maestro (§23). Prioriza: qué umbral de datos válidos marca una cifra como limitada (CQ-05), qué ventana temporal se usa para los focos FIRMS (VC-02), qué hace el pipeline si la única imagen Sentinel-2 tiene humo (VC-05), qué rango físico se considera válido (CQ-03) y cómo se registra la revisión visual. Lo que dependa de DP-03 queda como pendiente.
```

### P-VALIDACION-03 · Planificar
- **Orden:** 36
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-02
- **Momento:** Sáb 14:00–20:00
- **Produce:** specs/004-validacion/plan.md, data-model.md
- **Herramientas:** skills `validacion-optica-firms`, `python-geoespacial`; MCP `context7`
- **Verificación:** esquemas de validation.json y quality.json coherentes con §17.3

```text
[SDD P-VALIDACION-03] /speckit-plan Reutiliza la base de specs/001-base-pipeline y los resultados de specs/003-ciencia. Define los esquemas de validation.json y quality.json (propuesta de diseño de §17.3) junto con M-PUBLICACIÓN. Cada control de CQ-01 a CQ-06 es una función probada con datos sintéticos que devuelve aprobado, advertencia o exclusión con su motivo. Las métricas de VC-01 se calculan con rasterio y GeoPandas (§18). Consulta la documentación vigente con el MCP context7. Marca como hipótesis lo que el documento no fija.
```

### P-VALIDACION-04 · Tareas
- **Orden:** 37
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-03
- **Momento:** Sáb 14:00–20:00
- **Produce:** specs/004-validacion/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** responsable y apoyo por tarea; cada tarea con identificador y prueba

```text
[SDD P-VALIDACION-04] /speckit-tasks Ordena por historia y en el orden de §25: controles CQ-01 a CQ-06 (sábado 20:00–24:00), después VC-01 a VC-04 con Sentinel-2 y dNBR (domingo 9:00–14:00) y VC-05. Cada tarea lleva su responsable según §19 (Tabata) y las de Sentinel-2, dNBR y focos marcan el apoyo de Alex como agenda §25. Cada tarea cita su identificador y su prueba (PS-01). Prueba antes que implementación; [P] en las paralelizables.
```

### P-VALIDACION-05 · Analizar
- **Orden:** 38
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-04
- **Momento:** Sáb 14:00–20:00
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagentes `guardian-alcance`, `revisor-cientifico`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-VALIDACION-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/004-validacion y pásalos por los subagentes guardian-alcance (alcance de §8, reglas de §16 y §23) y revisor-cientifico (CQ-01 a CQ-06, VC-01 a VC-05). Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-VALIDACION-06 · Implementar controles y validación
- **Orden:** 40
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-05, P-CIENCIA-06, P-INGESTA-07
- **Momento:** Sáb 20:00–24:00 CQ · Dom 9:00–14:00 VC
- **Produce:** quality.json (CQ-01 a CQ-06) y validation.json (VC-01 a VC-05, RF-10, RF-11)
- **Herramientas:** skills `test-driven-development`, `validacion-optica-firms`, `flujo-issues-y-pr`; subagente `revisor-cientifico`
- **Verificación:** PS-01 en verde; ninguna fecha excluida sin motivo; «validación limitada» cuando corresponde

```text
[SDD P-VALIDACION-06] /speckit-implement Implementa de specs/004-validacion primero los controles de calidad CQ-01 a CQ-06 con quality.json y las fechas excluidas con su motivo (sábado 20:00–24:00), y después la validación VC-01 a VC-05 con validation.json, los focos FIRMS del periodo (RF-10) y la marca de «validación limitada» si no hubo Sentinel-2 válida (RF-11), una tarea a la vez y prueba primero (PS-01). Las métricas que no se pudieron calcular son «no reportada» con su motivo (RN-13). Crea el issue y la rama tipo/N desde dev (skill flujo-issues-y-pr). Detente al terminar cada historia y muéstrame la evidencia.
```

### P-VALIDACION-07 · Verificar
- **Orden:** 47
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Tabata
- **Revisa:** Mimi
- **Depende de:** P-VALIDACION-06
- **Momento:** Dom 14:00–19:00
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `revisor-cientifico`, `auditor-publicacion`, `revisor-qa`; MCP `qa-evidence`; `npm run codigo:revisar`
- **Verificación:** CQ y VC con evidencia; revisión de Mimi

```text
[SDD P-VALIDACION-07] /speckit-converge Compara el código con specs/004-validacion y agrega como tareas lo que falte. Verifica con evidencia ejecutada CQ-01 a CQ-06, VC-01 a VC-05, RF-10 y RF-11: pytest (PS-01), quality.json y validation.json coherentes con lo calculado, revisión visual registrada en el notebook (VC-05) y revisor de código vivo (npm run codigo:revisar). Pide revisión a revisor-cientifico y auditor-publicacion, y la revisión humana de Mimi (revisora de M-VALIDACIÓN según §19). Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] CQ-01 a CQ-06 con su resultado en `quality.json`; ninguna fecha excluida sin motivo.
- [ ] VC-01 a VC-05 con sus métricas en `validation.json`; «validación limitada» cuando no hubo Sentinel-2 válida.
- [ ] Focos FIRMS del periodo con fecha y fuente (RF-10); métricas no calculadas como «no reportada».
- [ ] PS-01 en verde; revisado por Mimi; sin código muerto.
- [ ] PR a dev fusionada y el historial del SDD registrado.
