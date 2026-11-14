# Research: Ingesta de escenas NISAR (002-ingesta)

**Fecha**: 2026-11-14 · **Prompt SDD**: P-INGESTA-03 · **Issue**: #29

Cada decisión indica su estado: **hecho verificado** (con fuente y fecha), **propuesta** del plan o
**hipótesis** (falta comprobarla). El MCP `context7` no estaba disponible en esta sesión (sus servidores no
están aprobados en Claude Code), así que las firmas exactas de las librerías se confirman con él al
implementar; aquí solo se usa lo que ya está en las guías citadas o lo que se comprobó directamente.

## R1. Búsqueda en el catálogo

- **Decisión**: buscar en el catálogo CMR con `earthaccess` por colección, caja del área y periodo. `asf_search`
  queda como alternativa equivalente (§18 lista las dos).
- **Fundamento**: la búsqueda en CMR no necesita credenciales y devuelve los metadatos UMM-G completos.
- **Hecho verificado** (consulta a CMR del 14 nov 2026, gránulo
  `NISAR_L2_PR_GCOV_028_060_A_169_2005_DHDH_A_20260817T095044_20260817T095119_P05023_N_F_J_001`): cada gránulo
  trae los atributos `TRACK_NUMBER`, `ASCENDING_DESCENDING`, `FRAME_NUMBER`, `FREQUENCY_A_POLARIZATION` y
  `STACK_ID`, y su huella en `SpatialExtent`. El CRID está en el nombre del gránulo.
- **Alternativa considerada**: `asf_search` con `relativeOrbit` y `flightDirection`. Los nombres de esos
  parámetros hay que verificarlos (skill `ingesta-nisar-asf`), por eso no es la primera opción.

## R2. Lectura del GCOV desde la nube y recorte

- **Decisión**: recortar con GDAL 3.13 o superior, leyendo el HDF5 remoto por `/vsicurl/` y extrayendo la
  ventana del área con `gdal_translate -projwin` (sin `gdalwarp`, que remuestrea).
- **Hecho verificado** (guía de ASF *Using NISAR data with GDAL*, consultada el 14 nov 2026): el driver HDF5 de
  GDAL lee el formato NISAR desde la versión 3.13.0; el subdataset se nombra como
  `HDF5:"/vsicurl/https://…h5"://science/LSAR/GCOV/grids/frequencyA/HHHH`; la autenticación usa
  `GDAL_HTTP_NETRC=YES` con `GDAL_HTTP_COOKIEFILE` y `GDAL_HTTP_COOKIEJAR`; y `gdal_translate` con `-projwin`
  y `-projwin_srs` es la vía más eficiente para una extracción simple.
- **Riesgo**: en el entorno de la prueba de Alex (conda-forge, 14 nov 2026) se instaló GDAL 3.12.3, por debajo
  del mínimo. **Hipótesis**: se puede fijar `gdal>=3.13` en el entorno de la base del pipeline. Se comprueba
  como primera tarea.
- **Respaldo (hipótesis, requiere acuerdo del equipo)**: si GDAL 3.13 no se puede instalar a tiempo, leer la
  misma ventana con `h5py` sobre el archivo remoto abierto con `earthaccess`. Funcionó en la prueba de Alex
  con las 18 escenas de la órbita 060A, pero es una vía distinta de la que fija §18 para recortar, así que se
  registra como desviación si se usa.
- **Alternativa descartada**: `openSEPPO`. En la prueba, conda-forge lo exigía con Python 3.12 o superior; la
  versión de Python la fija `specs/001-base-pipeline`, aún sin escribir. Se reconsidera cuando exista.
- **Regla**: la ventana se calcula sobre la grilla del producto y se toma por píxeles enteros; nunca se
  reproyecta ni se cambia la resolución (§22, RN-01, FR-008).

## R3. Variables del GCOV

- **Decisión**: leer con `h5py` (o con los subdatasets de GDAL) solo `HHHH`, `HVHV` y `mask` del grupo
  `/science/LSAR/GCOV/grids/frequencyA`, además de las coordenadas y la proyección del grupo.
- **Hecho verificado**: la ruta del grupo figura en la guía de ASF citada en R2.
- **Observación de la prueba de Alex** (por reproducir): el grupo trae `xCoordinates`, `yCoordinates` y
  `projection` con el código EPSG; el paso de la grilla en la órbita 060A es de 20 m.
- **Pendiente (DP-03)**: qué significa cada valor de `mask`. La ingesta la copia en su tipo original.

## R4. Escritura de los COG

- **Decisión**: `rasterio` con el driver COG de GDAL, `float32`, compresión `DEFLATE` y predictor de coma
  flotante; sin dato como `NaN`. La máscara se escribe en su tipo original con predictor entero. `ZSTD` es la
  alternativa admitida por §22.
- **Fundamento**: §22 y RNF-09 (sin pérdida); guía del driver COG de GDAL (§31).
- **Nota**: las vistas reducidas internas del COG (overviews) se promedian, pero el nivel base no se toca; la
  prueba de integridad PS-02 compara el nivel base con el original.

## R5. Sumas de verificación

- **Decisión**: registrar la suma del gránulo original que publica el catálogo y la SHA-256 de cada archivo
  guardado (FR-013, FR-013a).
- **Hecho verificado** (misma consulta a CMR de R1): el catálogo publica la suma **MD5** del archivo `.h5` en
  `DataGranule.ArchiveAndDistributionInformation[].Checksum`.
- **Regla**: si un gránulo no trae suma, figura como «no reportada», con su motivo (RN-13).

## R6. Huellas

- **Decisión**: tomar el polígono de `SpatialExtent.HorizontalSpatialDomain.Geometry.GPolygons` de cada
  gránulo tal como viene y escribirlo en GeoJSON con órbita, dirección, fechas y polarizaciones.
- **Fundamento**: RF-26 exige que coincidan con el catálogo; no se dibujan ni se simplifican.

## R7. Promedio a unos 60 m (MC-01)

- **Decisión (propuesta, pendiente de la confirmación de Tabata)**: promediar en potencia lineal por bloques
  enteros de píxeles hasta unos 60 m, ignorando los píxeles sin dato, y entregar junto a la pila la fracción
  de píxeles válidos de cada bloque como máscara de datos válidos.
- **Hipótesis**: con el paso de 20 m observado en la prueba, el bloque es de 3 × 3 píxeles. El tamaño del
  bloque es un parámetro, no una constante.
- **Regla**: el promedio nunca se hace en dB (§12). La pila promediada es un producto derivado; los recortes
  en resolución original no se modifican.

## R8. Credenciales

- **Decisión**: las credenciales de Earthdata se leen de `.netrc` local, que usan tanto GDAL
  (`GDAL_HTTP_NETRC`) como `earthaccess`; el código nunca las lee, imprime ni copia (RNF-06).
- **Punto a comunicar al equipo**: la clave gratuita de FIRMS es una variable de entorno nueva. Agregarla a
  `.env.example` cambia la estructura del entorno, y las reglas del repositorio piden avisar al equipo antes.

## R9. Descargas lentas (§24)

- **Decisión (propuesta)**: cada escena se procesa en un subproceso con tiempo límite y reintentos con espera
  creciente; lo ya obtenido y válido se salta al relanzar; un archivo solo se da por bueno si se escribió
  entero (escritura a un nombre temporal y renombrado final).
- **Hipótesis de valores iniciales**, tomados de la prueba de Alex (unos 3 minutos por escena y una lectura
  colgada): 12 minutos por intento y 5 intentos. Son parámetros.

## R10. Focos de calor FIRMS

- **Decisión (propuesta)**: obtener los focos por área y por tramos de pocos días desde el servicio de FIRMS,
  para VIIRS (S-NPP y NOAA-20) y MODIS, guardando la fuente de cada foco.
- **Hipótesis**: se usa el producto estándar hasta donde exista y el de tiempo casi real después, como en la
  prueba de Alex. El formato exacto del servicio se verifica al implementar.

## R11. Configuración y pendientes

- **Decisión**: un archivo de configuración por estación con el área, el periodo, el hueco, la órbita y las
  colecciones. Ningún módulo lleva esos valores escritos (FR-002a, FR-012).
- **Pendiente (DP-08)**: el área definitiva. El plan no la fija.

## R12. Base del pipeline

- **Hipótesis**: `specs/001-base-pipeline` (Tabata y Mimi) no existe todavía. La estructura de carpetas, la
  versión de Python y el esquema del manifiesto que usa este plan son una propuesta para conciliar con esa
  spec cuando se escriba. La ingesta entrega los **datos** del manifiesto; el archivo `manifest.json` de la
  estación publicada (§17.3) lo arma M-PUBLICACIÓN.

## Referencias (§31)

- Alaska Satellite Facility. (2026). *NISAR data user guide*. <https://nisar-docs.asf.alaska.edu/>
- Alaska Satellite Facility. (2026). *Open source software packages*.
  <https://nisar-docs.asf.alaska.edu/using-open-source/>
- Alaska Satellite Facility. (2026). *Using NISAR data with GDAL*.
  <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal> (consultada el 14 de noviembre de 2026).
- GDAL/OGR contributors. (2026). *COG: Cloud Optimized GeoTIFF generator*.
  <https://gdal.org/drivers/raster/cog.html>
