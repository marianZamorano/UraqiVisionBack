---
id: M-PUBLICACIÓN
titulo: Vistas, GeoJSON, CSV y textos de cada estación
tipo: modulo
prefijo: PUBLICACION
spec: specs/005-publicacion
---

# SDD · M-PUBLICACIÓN — Vistas, GeoJSON, CSV y textos de cada estación

El contrato con la web: convierte los resultados del pipeline en la carpeta publicada de la estación (§17.3), con
vistas livianas para el mapa, datos descargables sin pérdida y textos en ambos idiomas. Publica la pregunta 1
(cicatrices) el sábado y la pregunta 2 (quema o desmonte) el domingo (§25).

## 1. Ficha

| Campo | Valor |
|---|---|
| Módulo (§19) | M-PUBLICACIÓN · «Generar vistas, GeoJSON, CSV y textos de cada estación» |
| Responsable | Mimi |
| Revisora | Tabata |
| Repositorio | `UraqiVisionBack` (backend) |
| Spec | `specs/005-publicacion` |
| Momento (§25) | Antes: repositorio y licencias · Sáb 9:00–13:00 estructura de publicación · Sáb 20:00–24:00 publicar pregunta 1 (cicatrices) · Dom 9:00–14:00 publicar pregunta 2 (quema o desmonte) |

## 2. Alcance del documento maestro

| ID | Requisito (§13) | Lo que publica este módulo | Prioridad |
|---|---|---|---|
| RF-05 | Mapa de cambio de estación | máscara de cambio y vistas con sus límites | MVP |
| RF-06 | Deslizador antes/después | vistas por fecha de la misma órbita | MVP |
| RF-07 | Línea de tiempo de la serie | fechas de la órbita y fechas excluidas con su motivo | MVP |
| RF-08 | Vista por polarización | vistas HH, HV y HV/HH; canales inexistentes declarados | MVP |
| RF-09 | Hectáreas por fecha | `hectares.csv` con rango; las cifras de la web coinciden con él | MVP |
| RF-22 | Descarga de datos | `change.tif` (COG), `scars.geojson` y `manifest.json` válidos, georreferenciados y con licencia | MVP |
| RF-27 | Cambio sobre el globo | máscara de cambio con su extensión correcta y zonas sin dato transparentes | MVP |

Estructura de la estación publicada (§17.3, propuesta de diseño del equipo: cualquier cambio se registra en el
documento): `station.json`, `manifest.json`, `change.tif`, `views/AAAAMMDD_hv.webp`, `_hh`, `_ratio`,
`scars.geojson`, `hectares.csv`, `validation.json`, `quality.json`, `footprints.geojson` y
`atlas/departments.geojson` (común a todo el sitio). Los textos de la estación (hipótesis, relato local, preguntas
sugeridas: RF-12, RF-13, RF-17) van en `station.json`.

## 3. Reglas y decisiones que aplican

- §22: separar análisis y vista (vistas PNG/WebP de 8 bits solo para el mapa); compresión sin pérdida en el COG;
  remuestreo solo en las vistas. RNF-09 (integridad), RNF-02 (vistas de una estación por debajo de 40 MB).
- RN-03 (cada cifra con fuente, fecha y método), RN-04 (nada simulado como resultado), RN-05 (hipótesis con fuente),
  RN-06 (hectáreas con rango), RN-07 (fechas de adquisición en UTC), RN-11 (citas NISAR), RN-13 (sin dato nunca
  cero), RNF-03 (textos en español e inglés), RNF-11 (licencias de los datos derivados).
- CQ-06: no se publica hasta completar la procedencia.

## 4. Contratos e integración

- **Consume**: COG y manifiesto de M-INGESTA, resultados de M-CIENCIA (máscaras, parches, clases, hectáreas),
  `validation.json` y `quality.json` de M-VALIDACIÓN, huellas de M-INGESTA.
- **Produce**: la carpeta publicada de §17.3 que lee la web (M-MAPA, M-GLOBO, M-INTERFAZ, M-ATLAS) y que usa
  Insight como fuente (RN-09).
- **Se coordina con**: la web en `UraqiVision` (contrato §17.3: un cambio de formato se acuerda entre los dos
  repositorios) y M-INSIGHT.

## 5. Calidad: pruebas y aceptación

- PS-02 (los COG publicados conservan los valores del análisis: RNF-09), PS-03 (cada estación con todos sus
  archivos y textos en ambos idiomas: RNF-03).
- RNF-02 (peso de las vistas), RF-09 y RF-37 (las cifras coinciden con los archivos), RF-22 (archivos válidos y
  georreferenciados).

## 6. Herramientas del repositorio

- Skills: `publicacion-estacion`, `python-geoespacial`, `notebook-reproducible`, `rigor-y-fuentes`,
  `test-driven-development`.
- Subagentes: `auditor-publicacion`, `revisor-cientifico`, `revisor-qa`.
- MCP: `context7` (rasterio, GeoPandas, pandas), `qa-evidence`.
- Hooks: pre-commit, código vivo en la promoción.

**Referencias del documento maestro (§31)**

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Fundación Amigos de la Naturaleza (2023). Deforestación en Bolivia 1956–2022** — <https://fan-bo.org/wp-content/uploads/2024/08/Deforestacionen-Bolivia-1956-2022.pdf>
  Citada en: §4.2, §10.3, §11. Aplica a: RF-01, RF-03, RF-12, RF-13, MC-06. Cítala en la portada, en la ficha de Santa Cruz, en el relato y las hipótesis de San Ignacio y como contexto de la pregunta 2 (quema o desmonte).
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).
- **MapBiomas Bolivia (s. f.). Capas** — <https://bolivia.mapbiomas.org/en/capas/>
  Citada en: §10.3, §17. Aplica a: RF-14, RF-35, RF-03. Fuente de límites, áreas protegidas y territorios: cada capa que la use muestra fuente y año (RF-14, RF-35) y aparece en Acerca de.

<!-- referencias:fin -->

## 7. Riesgos y pendientes

- La meta del sábado a las 13:00 depende de que la estructura de publicación esté lista con el primer par real.
- El contrato de §17.3 es una propuesta: cualquier cambio se acuerda con la web y se registra en el documento.
- RF-12 y RF-13 (hipótesis y relato local) no tienen módulo en §19; aquí solo se publican: acuerden quién los redacta.

## 8. Secuencia de prompts

### P-PUBLICACION-01 · Especificar
- **Orden:** 11
- **Fase:** 2 · Especificación
- **Comando:** speckit-specify
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PROY-01
- **Momento:** Antes del sábado 14
- **Produce:** specs/005-publicacion/spec.md
- **Herramientas:** skills `documento-maestro`, `publicacion-estacion`
- **Verificación:** cada requisito conserva su identificador; estructura de §17.3 marcada como propuesta

```text
[SDD P-PUBLICACION-01] /speckit-specify Feature 005-publicacion (número 005, nombre corto publicacion) del backend de UraqiVision, módulo M-PUBLICACIÓN de §19 (responsable Mimi). Publicar la carpeta de la estación San Ignacio de Velasco con la estructura propuesta en §17.3: station.json (identificador, nombre es/en, área, órbita, fechas, hipótesis con fuente, relato local y preguntas sugeridas), manifest.json (gránulos, fecha, órbita, CRID, suma de verificación y versión del pipeline), change.tif en COG sin pérdida, vistas WebP de 8 bits por fecha y polarización (HV, HH y cociente) con sus límites, scars.geojson con fecha y clase, hectares.csv con fecha, hectáreas y rango, validation.json, quality.json, footprints.geojson y atlas/departments.geojson. Lo publicado alimenta RF-05 a RF-09, RF-22 y RF-27 de la web. Reglas: separar análisis y vista (§22), integridad de los valores (RNF-09), vistas por debajo de 40 MB (RNF-02), textos en español e inglés (RNF-03), cifras con fuente, fecha y método (RN-03), nada simulado (RN-04), hipótesis con fuente (RN-05), hectáreas con rango (RN-06), fechas UTC (RN-07), sin dato nunca cero (RN-13), licencias (RNF-11) y no publicar sin procedencia completa (CQ-06).
```

### P-PUBLICACION-02 · Aclarar
- **Orden:** 22
- **Fase:** 3 · Aclaraciones
- **Comando:** speckit-clarify
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-01
- **Momento:** Antes del sábado 14
- **Produce:** sección Clarifications de specs/005-publicacion/spec.md
- **Herramientas:** skills `documento-maestro`, `publicacion-estacion`
- **Verificación:** máximo 5 preguntas; cambios del contrato acordados con la web

```text
[SDD P-PUBLICACION-02] /speckit-clarify Aclara la spec 005-publicacion con un máximo de 5 preguntas, una a la vez, con una opción recomendada basada en el documento maestro (§17.3, §22). Prioriza: cómo se expresan los límites geográficos de cada vista, cómo se declara en los archivos una fecha sin HV (CQ-04, RF-08), cómo se escalan las vistas a 8 bits sin usarse para calcular, dónde van los focos del periodo y cómo se versiona la carpeta publicada. Si una respuesta cambia el contrato de §17.3, regístrala como pendiente de acordar con la web.
```

### P-PUBLICACION-03 · Planificar
- **Orden:** 23
- **Fase:** 4 · Plan
- **Comando:** speckit-plan
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-02
- **Momento:** Antes del sábado 14
- **Produce:** specs/005-publicacion/plan.md, data-model.md, contracts/
- **Herramientas:** skills `publicacion-estacion`, `python-geoespacial`; MCP `context7`
- **Verificación:** contratos de §17.3 en contracts/ coherentes con los de la web

```text
[SDD P-PUBLICACION-03] /speckit-plan Reutiliza la base de specs/001-base-pipeline. Escribe en contracts/ el esquema de cada archivo de §17.3 como propuesta de diseño y compáralo con los tipos de la web (UraqiVision, specs/001-base-web/contracts): si difieren, regístralo como conflicto para acordarlo entre ambos repositorios. COG con rasterio, DEFLATE o ZSTD y predictor (§22); vistas de 8 bits solo para el mapa; GeoJSON con GeoPandas; CSV con pandas (§18). Una prueba de integridad compara los valores del COG publicado con los del análisis (PS-02). Consulta la documentación vigente con el MCP context7.
```

### P-PUBLICACION-04 · Tareas
- **Orden:** 24
- **Fase:** 5 · Tareas
- **Comando:** speckit-tasks
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-03
- **Momento:** Antes del sábado 14
- **Produce:** specs/005-publicacion/tasks.md
- **Herramientas:** skill `sdd-uraqivision`
- **Verificación:** cada tarea con responsable, identificador y prueba, en el orden de §25

```text
[SDD P-PUBLICACION-04] /speckit-tasks Ordena por historia y en el orden de §25: estructura de publicación con el primer par real (sábado 9:00–13:00), publicación de la pregunta 1 con cicatrices y hectáreas (20:00–24:00) y de la pregunta 2 con las clases (domingo 9:00–14:00). Cada tarea lleva su responsable según §19 (Mimi), su identificador y su prueba (PS-02, PS-03). Prueba antes que implementación; [P] en las paralelizables.
```

### P-PUBLICACION-05 · Analizar
- **Orden:** 25
- **Fase:** 6 · Análisis
- **Comando:** speckit-analyze
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-04
- **Momento:** Antes del sábado 14
- **Produce:** informe de coherencia (⛔ espera «apruebo»)
- **Herramientas:** subagentes `guardian-alcance`, `auditor-publicacion`
- **Verificación:** sin hallazgos críticos; la persona escribe «apruebo»

```text
[SDD P-PUBLICACION-05] /speckit-analyze Revisa la coherencia entre spec.md, plan.md y tasks.md de specs/005-publicacion y pásalos por los subagentes guardian-alcance (alcance de §8, reglas de §16, §17.3 y §22) y auditor-publicacion. Lista los hallazgos por severidad y detente hasta que la persona escriba «apruebo».
```

### P-PUBLICACION-06 · Implementar la estructura de publicación
- **Orden:** 28
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-05, P-PROY-07
- **Momento:** Sáb 9:00–13:00
- **Produce:** carpeta publicada con el primer par real (station.json, manifest.json, vistas)
- **Herramientas:** skills `test-driven-development`, `publicacion-estacion`, `flujo-issues-y-pr`
- **Verificación:** PS-02 y PS-03 en verde; la web puede leer el primer par real

```text
[SDD P-PUBLICACION-06] /speckit-implement Implementa de specs/005-publicacion la estructura de la carpeta publicada con el primer par real de San Ignacio: station.json en ambos idiomas, manifest.json con procedencia completa (CQ-06) y las vistas por fecha y polarización con sus límites, una tarea a la vez y prueba primero (PS-02, PS-03). Es lo que la web necesita para el antes/después del sábado a las 13:00 (§25). Crea el issue y la rama tipo/N desde dev (skill flujo-issues-y-pr). Detente al terminar cada historia y muéstrame la evidencia.
```

### P-PUBLICACION-07 · Publicar las preguntas 1 y 2
- **Orden:** 41
- **Fase:** 7 · Implementación
- **Comando:** speckit-implement
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-06, P-CIENCIA-07, P-VALIDACION-06
- **Momento:** Sáb 20:00–24:00 pregunta 1 · Dom 9:00–14:00 pregunta 2
- **Produce:** change.tif, scars.geojson, hectares.csv, validation.json, quality.json y footprints.geojson publicados
- **Herramientas:** skills `test-driven-development`, `publicacion-estacion`, `rigor-y-fuentes`; subagente `auditor-publicacion`
- **Verificación:** PS-02 y PS-03 en verde; RNF-02 bajo 40 MB; cifras coinciden con el análisis

```text
[SDD P-PUBLICACION-07] /speckit-implement Implementa de specs/005-publicacion la publicación de la pregunta 1 (dónde y cuándo quemó: change.tif, scars.geojson con fecha, hectares.csv con rango) el sábado por la noche y de la pregunta 2 (quema o desmonte: clases en scars.geojson, validation.json y quality.json) el domingo, más footprints.geojson, una tarea a la vez y prueba primero (PS-02, PS-03). Nada se publica sin procedencia completa (CQ-06); vistas por debajo de 40 MB (RNF-02); textos en ambos idiomas con hipótesis citadas (RN-05). Detente al terminar cada historia y muéstrame la evidencia.
```

### P-PUBLICACION-08 · Verificar
- **Orden:** 48
- **Fase:** 8 · Verificación
- **Comando:** speckit-converge
- **Ejecuta:** Mimi
- **Revisa:** Tabata
- **Depende de:** P-PUBLICACION-07
- **Momento:** Dom 14:00–19:00
- **Produce:** informe de verificación y PR a dev
- **Herramientas:** subagentes `auditor-publicacion`, `revisor-cientifico`, `revisor-qa`; MCP `qa-evidence`; `npm run codigo:revisar`
- **Verificación:** PS-02, PS-03 y RNF-02 con evidencia; revisión de Tabata

```text
[SDD P-PUBLICACION-08] /speckit-converge Compara el código con specs/005-publicacion y agrega como tareas lo que falte. Verifica con evidencia ejecutada la integridad de los COG publicados (PS-02), que la estación tenga todos sus archivos y textos en ambos idiomas (PS-03), el peso de las vistas (RNF-02), que las cifras coincidan con el análisis (RF-09) y que los archivos coincidan con los contratos de la web; revisor de código vivo (npm run codigo:revisar). Pide revisión a auditor-publicacion y revisor-cientifico, y la revisión humana de Tabata (revisora de M-PUBLICACIÓN según §19). Con todo en verde, abre la PR a dev con «Closes #N».
```

## 9. Definición de terminado

- [ ] Carpeta de San Ignacio con todos los archivos de §17.3 y textos en ambos idiomas (PS-03).
- [ ] COG sin pérdida con los mismos valores que el análisis (PS-02, RNF-09); vistas bajo 40 MB (RNF-02).
- [ ] Preguntas 1 y 2 publicadas; nada publicado sin procedencia completa (CQ-06).
- [ ] Contratos acordados con la web; revisado por Tabata; sin código muerto.
- [ ] PR a dev fusionada y el historial del SDD registrado.
