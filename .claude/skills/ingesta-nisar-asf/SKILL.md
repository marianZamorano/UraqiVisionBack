---
name: ingesta-nisar-asf
description: Procedimiento de ingesta de NISAR L2 GCOV para UraqiVision (M-INGESTA, MC-01, RF-26, CQ-02, CQ-06). Cubre buscar gránulos con asf_search o earthaccess, autenticarse con Earthdata Login sin exponer credenciales, recortar HHHH y HVHV desde la nube con GDAL ≥ 3.13, guardar COG sin pérdida, registrar el manifiesto con CRID y sumas de verificación y generar las huellas de escenas. Usar al buscar, descargar o recortar escenas NISAR, o al escribir el código de ingesta.
---

# Ingesta de NISAR L2 GCOV

Fuente: §10, §17.2 (pasos 1 y 2), §18, §22 y MC-01 del documento maestro, y la guía de datos NISAR de ASF
(`nisar-docs.asf.alaska.edu`, consultada el 12 nov 2026). Responsable: Alex (revisa Tabata). Las reglas
científicas que debe respetar el resultado están en la skill `ciencia-radar-nisar`.

## Datos objetivo (§10.1)

| Atributo | Valor |
|---|---|
| Producto | L2 GCOV, colecciones **PROVISIONAL** (`C2854338529-ASF`, short name `NISAR_L2_GCOV_PROVISIONAL_V1`, CRID P05023) y **VALIDATED** (`C3622241360-ASF`, `NISAR_L2_GCOV_V1`, CRID P05036) |
| Nunca | Productos BETA (RN-02) |
| Variables | `/science/LSAR/GCOV/grids/frequencyA/HHHH` y el equivalente `HVHV` (confirma el nombre exacto con `gdalinfo`); capas de apoyo `mask`, `numberOfLooks`, `rtcGammaToSigmaFactor` |
| Hueco | 27 jul – 10 ago 2026, sin datos |
| Órbitas sobre San Ignacio (§10.2) | 060A (10 fechas), 039D (9), 140D (8), del 18 jun al 16 oct 2026. VALIDATED: solo 161A del 23 oct tiene HH y HV |
| Recorte | ~50 × 50 km alrededor de San Ignacio, **pendiente (DP-08)**: no lo fijes tú |

## 1. Autenticación (sin exponer nada)

- Earthdata Login con un archivo `.netrc` en el home (`machine urs.earthdata.nasa.gov`). En Windows,
  earthaccess busca `~/_netrc`; la variable `NETRC` permite otra ubicación.
- **Nunca** leas, imprimas, copies ni versiones `.netrc`, contraseñas o tokens (las guardas lo bloquean).
  En el código, las credenciales llegan solo por `.netrc` o variables de entorno.
- No uses `ASFSession().auth_with_creds('usuario', 'clave')` con valores escritos en el código.

## 2. Buscar gránulos

Con **asf_search** (ejemplos de la guía de ASF):

```python
import asf_search as asf

results = asf.search(dataset="NISAR", processingLevel="GCOV", dataMaturity="PROVISIONAL")
url = results[0].get_urls()[0]
```

Para filtrar por área, fechas, órbita y dirección se usan los parámetros generales de asf_search
(`intersectsWith` con un WKT, `start`, `end`, `relativeOrbit`, `flightDirection`). **Verifica sus nombres y
valores en el manual de búsqueda de ASF o con `context7` antes de usarlos**, y comprueba en los resultados que
la madurez y el CRID son los esperados.

Con **earthaccess** (ejemplos de la guía de ASF):

```python
import earthaccess

earthaccess.login()  # usa .netrc o variables de entorno; si no hay, pide credenciales
results = earthaccess.search_data(short_name="NISAR_L2_GCOV_PROVISIONAL_V1", temporal=("2026-08-11", "2026-10-23"))
files = earthaccess.download(results, local_path="datos/crudos")  # solo si hace falta el archivo completo
```

- El acceso S3 directo solo funciona desde AWS `us-west-2` y necesita el endpoint
  `https://nisar.asf.earthdatacloud.nasa.gov/s3credentials`. Desde una laptop usa HTTPS.
- Guarda la lista de gránulos encontrada (nombre, fecha, órbita, dirección, polarizaciones, CRID) antes de
  descargar: es la base del manifiesto y de `footprints.geojson`.

## 3. Recortar desde la nube (§22: descargar solo lo necesario)

GDAL **3.13 o superior** lee el HDF5 de NISAR (antes había que usar el driver `NETCDF`). Lista los
subdatasets y recorta solo el área:

```bash
gdalinfo --config GDAL_HTTP_NETRC=YES "/vsicurl/https://<URL del gránulo>"
gdal_translate --config GDAL_HTTP_NETRC=YES \
  -projwin <xmin> <ymax> <xmax> <ymin> -projwin_srs EPSG:4326 \
  -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES \
  "<SUBDATASET_N_NAME de gdalinfo para HHHH>" HHHH_<fecha>.tif
```

- Usa el nombre de subdataset **exacto** que imprime `gdalinfo`; no lo construyas a mano.
- `-projwin` con `-projwin_srs` es la vía eficiente según ASF; `gdalwarp -cutline` también funciona pero es
  más lento y **remuestrea**: no lo uses para los datos de análisis (§22: no remuestrear el análisis).
- Para usar cookies en lugar de reautenticar en cada petición: `GDAL_HTTP_COOKIEFILE` y `GDAL_HTTP_COOKIEJAR`
  apuntando a un archivo temporal.
- openSEPPO es la otra herramienta prevista en §18; consulta su repositorio antes de usarla (la guía de ASF no
  trae ejemplos).

## 4. Guardar sin pérdida

- Potencia lineal **float32**, tal como viene; sin convertir a dB (el dB es del análisis, §12).
- COG con `COMPRESS=DEFLATE` o `ZSTD` y `PREDICTOR=YES` (para float elige el predictor de punto flotante).
  No uses JPEG ni WEBP con pérdida (RNF-09). Detalle en la skill `python-geoespacial`.
- Un archivo por fecha y polarización, con un nombre que incluya fecha, órbita y polarización.

## 5. Manifiesto y huellas

- `manifest.json` (CQ-06): por gránulo, nombre, fecha de adquisición en UTC, órbita, dirección, CRID, madurez
  y suma de verificación del archivo usado, más la versión del pipeline. Sin él no se publica la estación.
- `footprints.geojson` (RF-26): el polígono de cada escena **tal como lo da el catálogo**, con órbita,
  dirección, fechas y polarizaciones. RF-26 exige que coincida con el catálogo CMR: no lo dibujes a mano.

## Checklist

- [ ] Solo PROVISIONAL en la serie principal; VALIDATED aparte; ningún BETA.
- [ ] Credenciales solo por `.netrc` o variables de entorno; nada impreso ni versionado.
- [ ] Recorte con `gdal_translate -projwin`, sin remuestrear.
- [ ] COG float32 sin pérdida, en potencia lineal.
- [ ] Manifiesto con CRID y sumas de verificación de cada gránulo.
- [ ] Huellas tomadas del catálogo.
- [ ] El recorte de DP-08 lo fijó el equipo antes de procesar.

## Referencias del documento maestro (§31)

<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->

Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de
usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`
y `npm run referencias:revisar`.

- **Alaska Satellite Facility (2026). NISAR data user guide** — <https://nisar-docs.asf.alaska.edu/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RF-26, RF-37, RN-02, CQ-02, CQ-06. Guía de uso de los productos NISAR (GCOV, madurez, CRID, órbitas) que respaldan §10.1: cítala donde se busca, lee y describe el producto, y en la página de método.
- **Alaska Satellite Facility (2026). Open source software packages** — <https://nisar-docs.asf.alaska.edu/using-open-source/>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-08. Paquetes de código abierto para trabajar con NISAR (respalda las herramientas de §18): consúltala al elegir y fijar versiones y cítala en el notebook reproducible.
- **Alaska Satellite Facility (2026). Using NISAR data with GDAL** — <https://hyp3-docs.asf.alaska.edu/nisar-docs/gdal>
  Citada en: no la cita el cuerpo del documento (relación propuesta por el equipo). Aplica a: MC-01, RNF-09. Lectura y recorte del GCOV con GDAL desde la nube (§17.2, §18, §22): cítala en el código de recorte y extracción de HHHH y HVHV.
- **GDAL/OGR contributors (2026). COG: Cloud Optimized GeoTIFF generator** — <https://gdal.org/drivers/raster/cog.html>
  Citada en: §22. Aplica a: RNF-09, RF-22, PS-02, MC-01. Opciones del driver COG al escribir change.tif y los COG por fecha sin pérdida; cítala donde se escriben y en la prueba de integridad (PS-02).

<!-- referencias:fin -->
