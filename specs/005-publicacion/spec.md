# Feature Specification: Publicación de la carpeta de una estación

**Feature Branch**: `005-publicacion`

**Created**: 2026-11-14

**Status**: Draft — propuesta de Mimi (responsable de M-PUBLICACIÓN); revisión de Tabata

**Input**: Prompt `[SDD P-PUBLICACION-01]` de `sdd/m-publicacion.md` y el documento maestro (§8, §17.3, §20.2, §22,
§23, §28, §31).

**Módulo (§19)**: M-PUBLICACIÓN · «Generar vistas, GeoJSON, CSV y textos de cada estación».

## Contexto y límites

Convierte los resultados del pipeline en la **carpeta publicada** de la estación San Ignacio de Velasco, el contrato
con la web (§17.3). La web solo lee estos archivos; no calcula nada. Publica la pregunta 1 (cicatrices) el sábado y
la pregunta 2 (quema o desmonte) el domingo (§25).

- **Estructura de §17.3 = propuesta de diseño del equipo.** Puede ajustarse; cualquier cambio se registra en §17.3
  del documento maestro antes de implementarse.
- **Fuera de alcance**: procesamiento a pedido de cualquier área (§8.2); el cálculo de cambio, clases y hectáreas
  (M-CIENCIA); la validación con FIRMS y Sentinel-2 (M-VALIDACIÓN); la ingesta de escenas (M-INGESTA).
- **No se decide aquí**: DP-03 (valores de la capa `mask`), DP-05 (polígonos de control) y DP-08 (recorte de
  50 × 50 km). Quedan como pendientes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Carpeta de la estación completa y verificable (Priority: P1)

Quien publica obtiene la carpeta de la estación con todos los archivos de §17.3 y un `quality.json` que dice qué
controles pasaron. Si algo falta, la carpeta no se publica.

**Why this priority**: sin carpeta completa la web no tiene con qué construir la estación; sin procedencia no se
publica (CQ-06).

**Independent Test**: sobre una carpeta de prueba con datos sintéticos (PS-01), la publicación genera todos los
archivos de §17.3 y el chequeo de contenido los encuentra completos.

**Acceptance Scenarios**:

1. **Given** resultados completos de una estación, **When** se publica, **Then** la carpeta contiene los archivos de
   §17.3 y `quality.json` con el resultado de cada control (sección 23 del documento).
2. **Given** falta un archivo requerido o un control de calidad no se pudo calcular, **When** se publica, **Then** la
   publicación se detiene y el motivo queda registrado; nunca se publica un archivo incompleto.
3. **Given** `manifest.json`, **When** se revisa, **Then** lista los gránulos usados con nombre, fecha, órbita, CRID,
   suma de verificación y versión del pipeline (CQ-06).

---

### User Story 2 - Vistas livianas y datos sin pérdida (Priority: P1)

Quien publica genera las vistas por fecha y polarización (HV, HH y cociente) para el mapa, y el dato de análisis en
COG sin pérdida para descargar. Los dos nunca se mezclan.

**Why this priority**: la web carga las vistas en el navegador; el análisis debe conservar sus valores exactos (§22).

**Independent Test**: las vistas pesan menos de 40 MB en total y el `change.tif` publicado conserva los valores del
análisis al compararlo bit a bit (PS-02).

**Acceptance Scenarios**:

1. **Given** una fecha con HH, HV y cociente, **When** se publican las vistas, **Then** se generan `AAAAMMDD_hv.webp`,
   `_hh` y `_ratio` con sus límites geográficos (RF-08).
2. **Given** una fecha que solo tiene HH, **When** se publican las vistas, **Then** no se genera la vista HV ni el
   cociente, y el motivo queda en `quality.json` (RF-08, CQ-04).
3. **Given** la carpeta de una estación, **When** se suma el peso de sus vistas, **Then** es menor de 40 MB (RNF-02).
4. **Given** `change.tif`, **When** se compara con el análisis, **Then** los valores son idénticos: sin remuestreo
   ni compresión con pérdida (RNF-09, §22).

---

### User Story 3 - Hectáreas, cicatrices y textos bilingües (Priority: P2)

Quien publica entrega las cifras con su rango de sensibilidad, las cicatrices con fecha y clase, y el `station.json`
con sus textos en español e inglés.

**Why this priority**: son las cifras y textos que la web muestra; sin rango ni idioma completo no cumplen RN-06 ni
RNF-03.

**Independent Test**: `hectares.csv` tiene una fila por fecha con hectáreas, rango inferior y superior; `station.json`
tiene cada texto en `es` y `en`.

**Acceptance Scenarios**:

1. **Given** las hectáreas de una fecha, **When** se publican, **Then** aparecen con rango inferior y superior
   (RN-06, RF-09).
2. **Given** una métrica que no se pudo calcular, **When** se publica, **Then** aparece como «no reportada» con su
   motivo y **nunca** como cero (RN-13).
3. **Given** `station.json`, **When** se revisa, **Then** el nombre, las hipótesis, el relato y las preguntas tienen
   versión en español e inglés (RNF-03, PS-03); cada hipótesis cita su fuente (RN-05).
4. **Given** una fecha de adquisición, **When** se publica, **Then** se guarda en UTC (RN-07).

---

### Edge Cases

- Un texto existe en español pero falta en inglés: la carpeta no pasa el chequeo de contenido (PS-03).
- Una vista supera el peso previsto: se reduce la resolución de la vista, nunca la del análisis (RNF-02, §22).
- Un descriptor de hipótesis sin fuente: no se publica (RN-05).
- Los límites departamentales no tienen fuente, fecha ni versión: no se publican (ver «Aclaraciones pendientes»).
- Una cifra de hectáreas no tiene rango de sensibilidad: no se publica sin él (RN-06).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Publicar la carpeta de la estación con los archivos de la estructura de §17.3 (propuesta de diseño).
- **FR-002**: Escribir `station.json` con identificador, nombre en español e inglés, área, órbita usada, fechas,
  hipótesis con fuente, relato local y preguntas sugeridas (RN-05, RN-03, RNF-03).
- **FR-003**: Escribir `manifest.json` con gránulos usados (nombre, fecha, órbita, CRID, suma de verificación) y
  versión del pipeline; los datos vienen de M-INGESTA (CQ-06).
- **FR-004**: Escribir `change.tif` como COG `float32` sin pérdida con la máscara o puntaje de cambio (RNF-09, §22).
- **FR-005**: Generar vistas WebP de 8 bits por fecha y polarización (`AAAAMMDD_hv`, `_hh`, `_ratio`) con sus límites
  geográficos; separadas del análisis (§22, RF-08).
- **FR-006**: Generar `scars.geojson` con fecha y clase de cada polígono (RN-05, RF-05).
- **FR-007**: Generar `hectares.csv` con fecha, hectáreas, rango inferior y superior (RN-06, RF-09).
- **FR-008**: Incluir `validation.json` con las métricas de M-VALIDACIÓN frente a Sentinel-2 y el contexto de focos
  de calor (VC-01 a VC-05).
- **FR-009**: Escribir `quality.json` con el resultado de cada control de calidad de la sección 23 del documento.
- **FR-010**: Generar `footprints.geojson` con órbita, dirección, fechas y polarizaciones; los datos vienen de
  M-INGESTA (RF-26).
- **FR-011**: Incluir `atlas/departments.geojson` con fuente, fecha y versión, común a todo el sitio.
- **FR-012**: No publicar una carpeta incompleta: si falta un archivo requerido, la publicación se detiene (CQ-06).
- **FR-013**: Marcar como «no reportada» con su motivo todo dato que no se pudo calcular; nunca como cero (RN-13).
- **FR-014**: Guardar fechas de adquisición en UTC (RN-07).
- **FR-015**: Verificar que la suma de pesos de las vistas es menor de 40 MB (RNF-02).

### Key Entities

- **Carpeta publicada**: conjunto de archivos de §17.3 de una estación, con su procedencia.
- **station.json**: descriptor bilingüe de la estación (identificador, textos, hipótesis con fuente, preguntas).
- **Vista**: imagen WebP de 8 bits de una fecha y polarización, con sus límites geográficos.
- **Cicatriz**: polígono con fecha y clase, del archivo `scars.geojson`.
- **Cifra de hectáreas**: valor por fecha con su rango inferior y superior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La carpeta de San Ignacio de Velasco contiene el 100 % de los archivos de §17.3 cuando se publica.
- **SC-002**: El 100 % de los textos de `station.json` existe en español e inglés (RNF-03, PS-03).
- **SC-003**: El peso total de las vistas es menor de 40 MB (RNF-02).
- **SC-004**: `change.tif` conserva el 100 % de los valores del análisis (RNF-09, PS-02).
- **SC-005**: Ninguna cifra de hectáreas se publica sin rango; ninguna métrica ausente aparece como cero (RN-06,
  RN-13).

## Clarifications (P-PUBLICACION-02)

Preguntas de aclaración, con su estado. Solo se registran opciones y recomendación; no se cambia el contrato de
§17.3 sin acordarlo con la web (§28).

| # | Pregunta | Estado | Base y recomendación |
|---|---|---|---|
| C1 | ¿Cómo se escalan las vistas a 8 bits sin que se usen para calcular? | **Resuelta por el documento** | §22: las vistas son PNG/WebP de 8 bits solo para el mapa; los cálculos usan los COG en float32. |
| C2 | ¿Cómo se declara una fecha sin HV? | **Resuelta por el documento** | RF-08 y CQ-04: HV y el cociente se deshabilitan con explicación. Recomendación a validar: registrar el motivo en `quality.json`. |
| C3 | ¿Cómo se expresan los límites geográficos de cada vista? | **Pendiente de acordar con la web** | §17.3 pide los límites, no su formato. Opciones: bbox en `station.json` o en cada vista. Recomendación: bbox en EPSG:4326 por vista, a acordar con M-MAPA. |
| C4 | ¿Dónde van los focos de calor del periodo? | **Pendiente de acordar con la web** | §17.3 no tiene archivo de focos; añadirlo cambia el formato. Recomendación: no añadir archivo; los focos van en `validation.json` (contexto), a acordar con M-VALIDACIÓN. |
| C5 | ¿Cómo se versiona la carpeta publicada? | **Pendiente de acordar con la web** | El documento no lo define. Recomendación: campo de versión en `manifest.json` y `station.json`, a acordar con M-ATLAS y M-INTERFAZ. |

Ninguna pregunta C3 a C5 se implementa hasta acordarla con la web.

## Aclaraciones pendientes del equipo (máximo 3)

- [NEEDS CLARIFICATION: fuente, fecha y versión de los límites departamentales de `atlas/departments.geojson`.
  El documento no las fija. Decide el equipo (responsable de M-ATLAS, en la web).]
- [NEEDS CLARIFICATION: quién redacta el relato local y las preguntas sugeridas de `station.json` en ambos idiomas.
  §25 no lo asigna; RF-13 solo dice «texto breve del equipo». Cualquier texto con cifras necesita fuente y fecha de
  consulta.]

**Cerrada**: la representación de zonas sin dato. §20.2 fija trama gris con explicación en la leyenda para las
visualizaciones 2D, y RF-27 pide zonas sin dato transparentes solo en el globo. La vista WebP sigue §20.2 (trama).

## Assumptions

- La estructura de §17.3 se usa tal cual, como propuesta; un cambio se registra en el documento antes de
  implementarlo.
- Las vistas WebP y los datos de análisis salen del mismo pipeline; el remuestreo solo ocurre en las vistas (§22).
- M-PUBLICACIÓN consume los resultados de M-CIENCIA, la validación de M-VALIDACIÓN y la ingesta de M-INGESTA; no los
  recalcula.
- No se usan librerías nuevas en esta spec: la elección de herramientas se hace en el plan (§18).

## Referencias de §31 que aplican

- Alaska Satellite Facility (2026). *NISAR data user guide* — <https://nisar-docs.asf.alaska.edu/> (RN-02, RN-08):
  madurez y CRID que se publican en `manifest.json` y en la página de método.
- GDAL/OGR contributors (2026). *COG: Cloud Optimized GeoTIFF generator* — <https://gdal.org/drivers/raster/cog.html>
  (RNF-09, PS-02): escritura de `change.tif` sin pérdida.
- Alaska Satellite Facility (2026). *Using NISAR data with GDAL* — <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal>
  (RNF-09): procedencia del dato que se publica.
- Cesium GS (2026). *CesiumJS* [Software] — <https://github.com/CesiumGS/cesium> (RF-27, RNF-11): la web dibuja la
  máscara de cambio; la atribución va en la web.

Las fuentes se citan en APA 7 donde se implementen; esta spec no añade otras.
