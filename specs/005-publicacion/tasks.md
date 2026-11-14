# Tareas: publicación de la estación (005-publicacion)

**Estado:** tareas de P-PUBLICACION-04 (issue #54). Ninguna tarea está hecha: la implementación empieza en
P-PUBLICACION-06. Las tareas `[BLOQUEADA]` dependen de otro módulo o de una decisión. Convención: `T0NN` identifica la tarea.

Fuentes: `specs/005-publicacion/spec.md`, `plan.md`, `contracts/archivos-publicados.md`; §17.3, §22, §23.3.

## Fase A: base sin datos reales (desbloqueada)

- [ ] T001 Esquema de `station.json` con textos en es y en; prueba: falla si falta un idioma (PS-03, RNF-03).
- [ ] T002 Esquema de `manifest.json`; prueba: falla si falta CRID, suma o versión del pipeline (CQ-06, RN-02).
- [ ] T003 Esquema de `hectares.csv` con rango inferior y superior; prueba: falla si falta el rango (RN-06).
- [ ] T004 Regla «no reportada»: una métrica ausente se escribe con motivo, nunca como 0; prueba con datos sintéticos (RN-13, PS-01).
- [ ] T005 Regla de fechas en UTC; prueba con fecha con zona horaria (RN-07, PS-01).
- [ ] T006 Chequeo de carpeta completa: falla si falta un archivo de §17.3 (CQ-06, PS-03).
- [ ] T007 Chequeo de peso: las vistas suman menos de 40 MB; prueba con vistas sintéticas (RNF-02).

## Fase B: archivos del análisis (bloqueada por Tabata)

- [ ] T008 **[BLOQUEADA: M-CIENCIA, P-CIENCIA-07]** `change.tif` en COG sin pérdida; prueba: valores idénticos al análisis (RNF-09, PS-02, §22).
- [ ] T009 **[BLOQUEADA: M-CIENCIA, P-CIENCIA-07]** Vistas WebP de 8 bits `_hv`, `_hh`, `_ratio` con límites geográficos; prueba: se deshabilitan HV y cociente si falta HH o HV (RF-08, CQ-04).
- [ ] T010 **[BLOQUEADA: M-CIENCIA, P-CIENCIA-07]** `scars.geojson` con fecha y clase; prueba: cada clase tiene su significado (RN-05).
- [ ] T011 **[BLOQUEADA: M-CIENCIA, P-CIENCIA-07]** `hectares.csv` con datos reales; prueba: las cifras coinciden con el análisis (RF-09).

## Fase C: validación y calidad (bloqueada por Tabata)

- [ ] T012 **[BLOQUEADA: M-VALIDACIÓN, P-VALIDACION-06]** `validation.json` con métricas frente a Sentinel-2 y focos de calor (VC-01 a VC-05).
- [ ] T013 **[BLOQUEADA: M-VALIDACIÓN, P-VALIDACION-06]** `quality.json` con el resultado de cada control de §23.2 (CQ-01 a CQ-06).

## Fase D: procedencia y textos (bloqueada por decisiones)

- [ ] T014 **[BLOQUEADA: M-INGESTA]** `footprints.geojson` con órbita, dirección, fechas y polarizaciones; prueba: coinciden con el catálogo CMR (RF-26). Depende de P-INGESTA-02 a 05 (#29).
- [ ] T015 **[BLOQUEADA: M-INGESTA]** `manifest.json` con datos reales de gránulos y sumas (CQ-06).
- [ ] T016 **[BLOQUEADA: decisión del equipo]** `atlas/departments.geojson` con fuente, fecha y versión (marca NEEDS CLARIFICATION de la spec).
- [ ] T017 **[BLOQUEADA: decisión del equipo]** Relato local y preguntas sugeridas de `station.json` (marca NEEDS CLARIFICATION de la spec).

## Fase E: contrato con la web (bloqueada por acuerdo)

- [ ] T018 **[BLOQUEADA: acuerdo con la web]** Comparar los esquemas con los tipos de `UraqiVision`; si difieren, registrar el conflicto (`specs/001-base-web/contracts` no está en la copia local).
- [ ] T019 **[BLOQUEADA: acuerdo con la web]** Acordar C3 a C5 de la spec: límites de vista, focos del periodo y versionado de la carpeta.

## Fase F: verificación final

- [ ] T020 Chequeo de contenido de una estación completa: todos los archivos y textos en es y en (PS-03).
- [ ] T021 Prueba de integridad sobre datos reales de San Ignacio (PS-02), tras T008.
