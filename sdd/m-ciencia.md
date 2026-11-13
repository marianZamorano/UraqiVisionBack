---
id: M-CIENCIA
titulo: Cambio de HV, parches, clases y hectáreas
tipo: modulo
prefijo: CIENCIA
spec: specs/003-ciencia
---

# SDD · M-CIENCIA — Cambio de HV, parches, clases y hectáreas

El corazón científico: de la serie de HV de San Ignacio a la máscara de cambio, los parches fechados, su clase
(¿quema o desmonte?) y las hectáreas con su rango. Responde las dos preguntas de la estación (§11.1, §11.2).

## 1. Ficha

| Campo | Valor |
|---|---|
| Módulo (§19) | M-CIENCIA · «Speckle, línea base, cociente de HV, parches, fenología, clases y hectáreas» |
| Responsable | Tabata |
| Revisor | Alex |
| Repositorio | `UraqiVisionBack` (backend) |
| Spec | `specs/003-ciencia` |
| Momento (§25) | Antes: entorno Python · Sáb 9:00–13:00 MC-01 y MC-02 · Sáb 14:00–20:00 MC-03 a MC-05 · Sáb 20:00–24:00 primeros mapas y hectáreas · Dom 9:00–14:00 MC-06 · Dom 14:00–19:00 revisión de umbrales y sensibilidad · Dom 19:00–23:00 revisión científica |

## 2. Alcance del documento maestro

| ID | Método (§12) | Prioridad |
|---|---|---|
| MC-02 | Línea base por píxel: mediana de HV en potencia lineal con al menos 3 fechas previas | MVP |
| MC-03 | Cociente de HV entre la fecha y la línea base, en dB, con dos umbrales calibrados con zonas de control y dNBR | MVP |
| MC-04 | Parches de al menos 1 ha con fecha de primera detección; los focos fechan y clasifican, no crean parches | MVP |
| MC-05 | Corrección por fenología con zonas de control sin fuego ni desmonte | MVP |
| MC-06 | Clasificación de parches en cuatro clases: compatible con quema, compatible con pérdida previa de estructura, evidencia ambigua o datos insuficientes | MVP |
| MC-07 | Hectáreas por fecha con rango de sensibilidad (dos umbrales) | MVP |
| MC-08 | Detector RXD | Plus |
| MC-09 | Clasificador exploratorio con scikit-learn y el dNBR como etiqueta | Plus |

Los ocho pasos de §12 (leer HHHH y HVHV en lineal → máscara y controles → promediar en lineal hasta unos 60 m →
línea base como mediana → convertir a dB → cociente de HV → dos umbrales y área mínima de 1 ha → cuatro clases).
MC-01 (preparación de la serie) es de M-INGESTA según §19, aunque §25 lo agenda para Tabata (ver `m-ingesta.md`).

## 3. Reglas y decisiones que aplican

- Promedios en potencia lineal y conversión a dB después (§12). RN-01 (misma órbita y grilla), RN-02 (una sola
  madurez y CRID), RN-05 (las clases son hipótesis compatibles, nunca certezas), RN-06 (hectáreas con rango),
  RN-13 (sin dato nunca es cero).
- §22: no remuestrear el análisis; las vistas para la web se generan aparte (M-PUBLICACIÓN).
- **Pendientes** de Tabata: DP-03 (valores de la capa mask del GCOV, sábado por la mañana) y DP-05 (polígonos de
  control para la fenología, sábado); DP-08 (recorte) con Alex. No se deciden en un prompt.

## 4. Contratos e integración

- **Consume**: COG por fecha en potencia lineal de M-INGESTA (MC-01) y focos FIRMS para fechar y clasificar (MC-04,
  MC-06).
- **Produce**: máscaras de cambio, parches con fecha y clase, y tabla de hectáreas por fecha con rango (§17.2), que
  M-PUBLICACIÓN convierte en `change.tif`, `scars.geojson` y `hectares.csv` (§17.3).
- **Se coordina con**: M-VALIDACIÓN (umbrales calibrados con dNBR, VC-01 a VC-04) y M-PUBLICACIÓN.

## 5. Calidad: pruebas y aceptación

- PS-01 (pytest con datos sintéticos): cálculo de dB, promedio de speckle, mediana, cociente de HV y hectáreas
  (MC-01 a MC-07).
- VC-03 (el cambio de HV en las zonas de control es menor que en las cicatrices) y VC-04 (sensibilidad del umbral:
  se publica el rango), con M-VALIDACIÓN.
- RNF-08: cada resultado se regenera desde el manifiesto y el notebook.

## 6. Herramientas del repositorio

- Skills: `ciencia-radar-nisar`, `python-geoespacial`, `notebook-reproducible`, `test-driven-development`,
  `rigor-y-fuentes`.
- Subagentes: `revisor-cientifico`, `revisor-qa`.
- MCP: `context7` (xarray, rioxarray, SciPy, rasterio, GeoPandas).
- Hooks: pre-commit, código vivo en la promoción.

**Referencias del documento maestro (§31)**

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). NISAR data user guide** — <https://nisar-docs.asf.alaska.edu/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RF-26, RF-37, RN-02, CQ-02, CQ-06. Guía de uso de los productos NISAR (GCOV, madurez, CRID, órbitas) que respaldan §10.1: cítala donde se busca, lee y describe el producto, y en la página de método.
- **Belenguer-Plomer, Tanase, Fernandez-Carrillo y Chuvieco (2019). Burned area detection and mapping using Sentinel-1 backscatter coefficient and thermal anomalies** — <https://doi.org/10.1016/j.rse.2019.111345>
  Citada en: §11.1, §12 (MC-08), §23.1 (VC-01). Aplica a: MC-03, MC-08, VC-01, RF-11, RF-15. Cítala en la implementación de MC-03 y MC-08, en las métricas de VC-01 y en la página de método. El Dice de 0,59 es de banda C: no lo presentes como meta ni como resultado de banda L.
- **Fundación Amigos de la Naturaleza (2023). Deforestación en Bolivia 1956–2022** — <https://fan-bo.org/wp-content/uploads/2024/08/Deforestacionen-Bolivia-1956-2022.pdf>
  Citada en: §4.2, §10.3, §11. Aplica a: RF-01, RF-03, RF-12, RF-13, MC-06. Cítala en la portada, en la ficha de Santa Cruz, en el relato y las hipótesis de San Ignacio y como contexto de la pregunta 2 (quema o desmonte).
- **Maillard (2023). Post-fire natural regeneration trends in Bolivia: 2001–2021** — <https://doi.org/10.3390/fire6010018>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RF-03, RF-12. Regeneración después del fuego en Bolivia: contexto de «recuperación del bosque» de la ficha de Santa Cruz (§10.4) y de las hipótesis; el documento no la cita en el cuerpo.
- **Maillard et al. (2022). Phenology patterns and postfire vegetation regeneration in the Chiquitania region of Bolivia using Sentinel-2** — <https://doi.org/10.3390/fire5030070>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-05, VC-01, VC-03. Fenología del bosque chiquitano con Sentinel-2: respaldo de la corrección por fenología (MC-05) y de las zonas de control (VC-03); el documento no la cita en el cuerpo.
- **NISAR (2025). NASA-ISRO SAR (NISAR) mission science users' handbook (2.ª ed.)** — <https://doi.org/10.48577/jpl.UD4HV3>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: RN-11, RF-08, RF-15, RF-19, RF-24, RF-16. Fundamentos de la misión y del radar (§9): respalda el texto de qué resalta cada polarización (RF-08), el glosario (RF-19), la página de método y las citas de datos (RN-11, RF-24) y las explicaciones de Insight; el documento no la cita en el cuerpo.

<!-- referencias:fin -->

## 7. Riesgos y pendientes

- §24: la caída de hojas del bosque seco se confunde con quema o desmonte (alta probabilidad, alto impacto) →
  zonas de control (MC-05) y focos como evidencia independiente; pocas fechas previas por el inicio en junio y el
  hueco de fines de julio (MC-02); una sola persona procesa los datos → RXD y el clasificador quedan como Plus.
- DP-03, DP-05 y DP-08 pendientes.

## 8. Secuencia de prompts

### P-CIENCIA-01 · Especificar
- **Orden:** 9
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/003-ciencia/spec.md
- **Herramientas:** skills `documento-maestro`, `ciencia-radar-nisar`
- **Verificación:** cada método conserva su identificador; DP-03 y DP-05 marcadas como pendientes

```text
[SDD P-CIENCIA-01] /speckit-specify Feature 003-ciencia (número 003, nombre corto ciencia) del backend de UraqiVision, módulo M-CIENCIA de §19 (responsable Tabata). A partir de la serie de HV de San Ignacio en potencia lineal (la prepara M-INGESTA, MC-01), calcular la línea base por píxel como mediana con al menos 3 fechas previas (MC-02); el cociente de HV entre cada fecha y la línea base en dB con dos umbrales (MC-03); parches de al menos 1 ha con su fecha de primera detección, usando los focos FIRMS para fechar y clasificar y no para crear parches (MC-04); la corrección por fenología con zonas de control (MC-05); la clasificación de cada parche en una de cuatro clases: compatible con quema, compatible con pérdida previa de estructura, evidencia ambigua o datos insuficientes (MC-06); y las hectáreas por fecha con su rango de sensibilidad (MC-07). Sigue los ocho pasos de §12: promedios en potencia lineal y dB después; misma órbita y grilla (RN-01); las clases son hipótesis compatibles, nunca certezas (RN-05); hectáreas con rango (RN-06); sin dato nunca es cero (RN-13). Responde las preguntas de §11.1 y §11.2. Plus si sobra tiempo: MC-08 y MC-09. Los valores de la capa mask (DP-03) y los polígonos de control (DP-05) son decisiones pendientes: no las decidas.
```

### P-CIENCIA-02 · Aclarar
- **Orden:** 18
- **Fase:** 3 · Aclaraciones
- **Comando:** speckit-clarify
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-01
- **Momento:** Antes del sábado 14
- **Produce:** sección Clarifications de specs/003-ciencia/spec.md
- **Herramientas:** skills `documento-maestro`, `ciencia-radar-nisar`
- **Verificación:** máximo 5 preguntas; pendientes marcados

```text
[SDD P-CIENCIA-02] /speckit-clarify Aclara la spec 003-ciencia con un máximo de 5 preguntas, una a la vez, con una opción recomendada basada en el documento maestro (§12). Prioriza: qué se hace si hay menos de 3 fechas previas (MC-02), cómo se calibran los dos umbrales con las zonas de control y el dNBR (MC-03), qué regla de orden temporal y forma separa las cuatro clases (MC-06), cómo se calcula el área de píxel en la grilla UTM (MC-07) y cuándo un parche es «datos insuficientes». DP-03 y DP-05 quedan como pendientes.
```

### P-CIENCIA-03 · Planificar
- **Orden:** 19
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-02
- **Momento:** Antes del sábado 14
- **Produce:** specs/003-ciencia/plan.md, research.md, data-model.md
- **Herramientas:** skills `ciencia-radar-nisar`, `python-geoespacial`, `notebook-reproducible`; MCP `context7`
- **Verificación:** stack de §18; lineal antes que dB; sin remuestrear el análisis

```text
[SDD P-CIENCIA-03] /speckit-plan Usa NumPy, xarray, rioxarray y SciPy para la serie y la estadística, GeoPandas para parches y focos y pandas para la tabla de hectáreas (§18). Reutiliza la base de specs/001-base-pipeline. Cada paso de §12 es una función pura probada con datos sintéticos (PS-01); los promedios en potencia lineal y la conversión a dB después; nunca se remuestrea el análisis (§22). Umbrales y polígonos de control configurables hasta que se resuelvan DP-03 y DP-05. Las figuras de control con Matplotlib quedan en el notebook (RNF-08). Consulta la documentación vigente con el MCP context7. Marca como hipótesis lo que el documento no fija.
```

### P-CIENCIA-04 · Tareas
- **Orden:** 20
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-03
- **Momento:** Antes del sábado 14
- **Produce:** specs/003-ciencia/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** cada tarea con responsable, identificador y prueba, en el orden de §25

```text
[SDD P-CIENCIA-04] /speckit-tasks Ordena por historia y en el orden de §25: MC-02 (sábado 9:00–13:00), MC-03 a MC-05 (14:00–20:00), primeros mapas y MC-07 (20:00–24:00) y MC-06 (domingo 9:00–14:00); MC-08 y MC-09 solo como Plus al final. Cada tarea lleva su responsable según §19 (Tabata), su identificador y su prueba (PS-01). Prueba antes que implementación; [P] en las paralelizables.
```

### P-CIENCIA-05 · Analizar
- **Orden:** 21
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-04
- **Momento:** Antes del sábado 14
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagentes `guardian-alcance`, `revisor-cientifico`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-CIENCIA-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/003-ciencia y pásalos por los subagentes guardian-alcance (alcance de §8, reglas de §16, pendientes de §29) y revisor-cientifico (§12, MC-02 a MC-07, RN-01, RN-05, RN-06). Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-CIENCIA-06 · Implementar línea base, cociente, parches y fenología
- **Orden:** 27
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-05, P-PROY-07, P-INGESTA-06
- **Momento:** Sáb 9:00–13:00 MC-02 · Sáb 14:00–20:00 MC-03 a MC-05
- **Produce:** línea base, cambio de HV en dB, parches fechados y corrección por fenología
- **Herramientas:** skills `test-driven-development`, `ciencia-radar-nisar`, `flujo-issues-y-pr`; subagente `revisor-cientifico`
- **Verificación:** PS-01 en verde; primer antes/después real disponible el sábado a las 13:00

```text
[SDD P-CIENCIA-06] /speckit-implement Implementa de specs/003-ciencia la línea base (MC-02), el cociente de HV en dB con dos umbrales (MC-03), los parches de al menos 1 ha con fecha de primera detección (MC-04) y la corrección por fenología (MC-05), una tarea a la vez y prueba primero con datos sintéticos (PS-01). Promedios en potencia lineal y dB después (§12). Prioriza lo necesario para el primer antes/después real del sábado a las 13:00 (§25). Crea el issue y la rama tipo/N desde dev (skill flujo-issues-y-pr); un commit por tarea con su identificador. Detente al terminar cada historia y muéstrame la evidencia.
```

### P-CIENCIA-07 · Implementar clases y hectáreas
- **Orden:** 39
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-06
- **Momento:** Sáb 20:00–24:00 hectáreas · Dom 9:00–14:00 MC-06
- **Produce:** hectáreas por fecha con rango (MC-07) y clases de parche (MC-06)
- **Herramientas:** skills `test-driven-development`, `ciencia-radar-nisar`, `notebook-reproducible`
- **Verificación:** PS-01 en verde; clases como hipótesis compatibles (RN-05)

```text
[SDD P-CIENCIA-07] /speckit-implement Implementa de specs/003-ciencia las hectáreas por fecha con su rango de sensibilidad a partir de los dos umbrales (MC-07, RN-06) y la clasificación de cada parche en una de las cuatro clases según el orden temporal entre la caída de HV y los focos y la forma del parche (MC-06, RN-05), una tarea a la vez y prueba primero (PS-01). Los datos ausentes nunca son cero (RN-13). Registra los parámetros en el notebook (RNF-08). Detente al terminar cada historia y muéstrame la evidencia.
```

### P-CIENCIA-08 · Verificar
- **Orden:** 46
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Tabata
- **Revisa:** Alex
- **Depende de:** P-CIENCIA-07
- **Momento:** Dom 14:00–19:00 (revisión de umbrales y sensibilidad)
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `revisor-cientifico`, `revisor-qa`; MCP `qa-evidence`; `npm run codigo:revisar`
- **Verificación:** MC-02 a MC-07 con evidencia; VC-03 y VC-04 revisados; revisión de Alex

```text
[SDD P-CIENCIA-08] /speckit-converge Compara el código con specs/003-ciencia y agrega como tareas lo que falte. Verifica con evidencia ejecutada MC-02 a MC-07: pytest (PS-01), zonas de control con menos cambio que las cicatrices (VC-03), rango de hectáreas con los dos umbrales (VC-04) y regeneración desde el manifiesto y el notebook (RNF-08); revisor de código vivo (npm run codigo:revisar). Pide revisión a revisor-cientifico y revisor-qa, y la revisión humana de Alex (revisor de M-CIENCIA según §19). Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] Línea base, cociente de HV, parches, fenología, clases y hectáreas según §12 (MC-02 a MC-07).
- [ ] Promedios en lineal y dB después; nada remuestreado en el análisis.
- [ ] Clases como hipótesis compatibles (RN-05); hectáreas con rango (RN-06); sin dato nunca cero (RN-13).
- [ ] DP-03 y DP-05 resueltas por Tabata; VC-03 y VC-04 revisados.
- [ ] PS-01 en verde; revisado por Alex; resultados reproducibles desde el notebook; sin código muerto.
- [ ] PR a dev fusionada y el historial del SDD registrado.
