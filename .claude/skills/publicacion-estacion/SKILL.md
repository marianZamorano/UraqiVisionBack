---
name: publicacion-estacion
description: Contrato de la carpeta publicada de una estación de UraqiVision (station.json, manifest.json, change.tif, vistas, scars.geojson, hectares.csv, validation.json, quality.json, footprints.geojson) y reglas de almacenamiento sin pérdida, peso y textos bilingües. Usar al generar, modificar o revisar archivos publicados o el código que los produce o los lee.
---

# Publicación de una estación

Fuente: §17.3, §22, RF-21, RF-22, RF-37, RNF-02, RNF-03, RNF-08, RNF-09, RNF-11, CQ-06 y PS-02/PS-03.
La estructura de §17.3 es una **propuesta de diseño del equipo**: puede ajustarse, pero todo cambio se
registra en el documento maestro antes de implementarlo.

## Archivos de una estación (§17.3)

| Archivo | Contenido mínimo |
|---|---|
| `station.json` | id, nombre es/en, área, órbita usada, fechas, hipótesis (con fuente), relato local, preguntas sugeridas |
| `manifest.json` | gránulos usados (nombre, fecha, órbita, CRID, suma de verificación) y versión del pipeline |
| `change.tif` | máscara o puntaje de cambio, COG sin pérdida |
| `views/AAAAMMDD_hv.webp`, `_hh`, `_ratio` | vistas del mapa y del deslizador, con sus límites geográficos |
| `scars.geojson` | cicatrices con fecha y clase |
| `hectares.csv` | fecha, hectáreas, rango inferior y superior |
| `validation.json` | métricas frente a Sentinel-2 y contexto de focos |
| `quality.json` | resultado de CQ-01 a CQ-06 |
| `footprints.geojson` | huellas de escenas con órbita, dirección, fechas y polarizaciones |
| `atlas/departments.geojson` | límites departamentales con fuente, fecha y versión (común a todo el sitio) |

## Reglas

- **Análisis y vista separados** (§22): el COG de análisis guarda potencia lineal float32 con compresión
  sin pérdida (DEFLATE o ZSTD con predictor). Las vistas PNG/WebP de 8 bits son solo para mirar; nunca se
  calcula nada a partir de ellas.
- **No se guardan los originales**: el manifiesto permite volver a descargar el mismo gránulo (RNF-08).
- **Ninguna estación se publica** sin `quality.json` completo y sin la procedencia de CQ-06.
- **Peso**: los archivos de vista de una estación suman menos de 40 MB (RNF-02).
- **Textos**: todo texto visible existe en español e inglés (RNF-03, PS-03).
- **Sin dato ≠ cero** (RN-13): en CSV y JSON, una métrica no calculada va vacía o `null` con un motivo,
  nunca `0`.
- **Fechas**: de adquisición, en UTC (RN-07). La conversión a hora de Bolivia la hace la web.
- **Cifras**: hectáreas siempre con rango (RN-06); cada cifra con fuente, fecha y método (RN-03).
- **Licencias y créditos**: datos derivados CC BY 4.0 (RNF-11); citas NISAR y FIRMS según sus guías
  (RN-11). Las descargas PNG y CSV llevan fecha, fuente y créditos (RF-21).
- **Coherencia**: lo que muestra la sección «Fuente y calidad» coincide con `manifest.json` y
  `quality.json` (RF-37); las cifras del gráfico coinciden con `hectares.csv` (RF-09).

## Checklist de revisión

- [ ] Están todos los archivos de la tabla, o la ausencia está justificada.
- [ ] `change.tif` es COG, float32, comprimido sin pérdida y en la grilla del análisis.
- [ ] `manifest.json` tiene nombre, fecha, órbita, CRID y suma de verificación de **cada** gránulo.
- [ ] Una sola madurez y un solo CRID en la serie principal (RN-02).
- [ ] `quality.json` cubre CQ-01 a CQ-06; las fechas excluidas tienen motivo.
- [ ] `hectares.csv` tiene rango inferior y superior en cada fila y ningún cero que signifique «sin dato».
- [ ] Cada clase de `scars.geojson` es una de las cuatro de RN-05.
- [ ] `station.json` tiene todos los textos en `es` y `en`, y cada hipótesis cita una fuente.
- [ ] Vistas < 40 MB en total.
- [ ] Los GeoJSON son válidos y están en coordenadas geográficas (WGS 84), como exige el formato GeoJSON.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). NISAR data user guide** — <https://nisar-docs.asf.alaska.edu/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RF-26, RF-37, RN-02, CQ-02, CQ-06. Guía de uso de los productos NISAR (GCOV, madurez, CRID, órbitas) que respaldan §10.1: cítala donde se busca, lee y describe el producto, y en la página de método.
- **Fundación Amigos de la Naturaleza (2023). Deforestación en Bolivia 1956–2022** — <https://fan-bo.org/wp-content/uploads/2024/08/Deforestacionen-Bolivia-1956-2022.pdf>
  Citada en: §4.2, §10.3, §11. Aplica a: RF-01, RF-03, RF-12, RF-13, MC-06. Cítala en la portada, en la ficha de Santa Cruz, en el relato y las hipótesis de San Ignacio y como contexto de la pregunta 2 (quema o desmonte).
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).
- **MapBiomas Bolivia (s. f.). Capas** — <https://bolivia.mapbiomas.org/en/capas/>
  Citada en: §10.3, §17. Aplica a: RF-14, RF-35, RF-03. Fuente de límites, áreas protegidas y territorios: cada capa que la use muestra fuente y año (RF-14, RF-35) y aparece en Acerca de.

<!-- referencias:fin -->
