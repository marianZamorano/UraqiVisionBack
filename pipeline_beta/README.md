# UraqiVision — descarga de datos del MVP

NASA Space Apps 2026, reto *Dancing with the SARs*. Este repositorio deja un contenedor
reproducible y los scripts para **descargar** los datos del MVP sobre San Ignacio de Velasco
(Santa Cruz, Bolivia). Todavía no procesa nada ni incluye la web.

## Requisitos

- Docker con Compose v2 y `make`.
- Cuenta gratuita de NASA Earthdata (solo para el script 02): <https://urs.earthdata.nasa.gov/users/new>
- MAP_KEY gratuita de FIRMS (solo para el script 03): <https://firms.modaps.eosdis.nasa.gov/api/map_key/>

```bash
cp .env.example .env      # y completa EARTHDATA_USERNAME, EARTHDATA_PASSWORD, FIRMS_MAP_KEY
make build
make comprobar            # importa todas las librerías y dice qué credenciales ve
```

`.env` y `data/` están en `.gitignore`: nunca van al repositorio.

## Cómo correr todo

| Paso | Comando | Qué hace | Credenciales |
|---|---|---|---|
| 01 | `make listar` | Tabla de escenas NISAR GCOV por (track, dirección) y recomendación de track. Guarda `data/meta/nisar_escenas.csv` | no |
| 02 | `make recortar COLECCION=provisional TRACK=<n> DIR=<A\|D> MAX=2` | Prueba con 2 fechas (primera y última: una a cada lado del hueco) | Earthdata |
| 07 | `make verificar` | Valida los GeoTIFF y hace quicklooks HVHV | no |
| 02 | `make recortar COLECCION=provisional TRACK=<n> DIR=<A\|D>` | Serie PROVISIONAL completa | Earthdata |
| 02 | `make recortar COLECCION=validated TRACK=<n> DIR=<A\|D>` | Tramo VALIDATED, en carpeta aparte | Earthdata |
| 05 | `make limites` | Departamentos de Bolivia (geoBoundaries ADM1) | no |
| 03 | `make firms` | Focos VIIRS/MODIS de Bolivia desde el 17 jun | FIRMS |
| 04 | `make sentinel2` | Sentinel-2 L2A antes/después, solo el recorte | no |
| 06 | `make huellas` | Huellas de GCOV PROVISIONAL sobre Bolivia (solo metadatos) | no |
| 07 | `make verificar` | Resumen final y GB usados | no |

Conviene correr 05 antes que 03 y 06: si existe `bolivia_adm1.geojson`, FIRMS se filtra al
polígono real del país y las huellas llevan la propiedad `toca_bolivia`.

Otros: `make shell` (bash en el contenedor) y `make lab` (JupyterLab en
<http://127.0.0.1:8888>; el token aparece en la consola).

Todos los scripts son idempotentes: si la salida ya existe y es válida, la saltan. El 02 se
puede cortar con Ctrl-C y volver a lanzar con el mismo comando.

## Estructura

```
config/aoi.yaml              zona, periodo, hueco, colecciones y límite de GB (DP-08: editable)
scripts/                     00_comprobar_entorno … 07_verificar, y _comun.py
data/raw/nisar_provisional/  SanIgnacio_<YYYYMMDD>_T<track><dir>_F<frame>_<capa>.tif
data/raw/nisar_validated/    igual, tramo VALIDATED (nunca se mezcla con PROVISIONAL)
data/raw/sentinel2/          SanIgnacio_S2_<antes|despues>_<YYYYMMDD>_<nir08|swir22|scl>.tif
data/raw/firms/              bolivia_2026.csv, SanIgnacio_2026.csv, tramos/
data/raw/boundaries/         bolivia_adm1.geojson
data/meta/                   manifest.json, nisar_escenas.csv, nisar_huellas_bolivia.geojson,
                             verificacion.csv, quicklooks/
notebooks/
```

## Decisiones de diseño

- **La zona vive en `config/aoi.yaml`.** Cambiar la caja ahí basta; ningún script la tiene escrita.
- **Nunca se descarga un HDF5 de NISAR completo** (≈2 GB cada uno). El 02 abre el archivo remoto
  con `earthaccess.open` y lee con `h5py` solo la ventana de la caja.
- **Potencia lineal float32**, tal cual viene en GCOV. Nada de dB ni amplitud: eso se calcula
  después. `mask` conserva su tipo original.
- **PROVISIONAL y VALIDATED van en carpetas separadas** y con el campo `coleccion` y el CRID en
  el manifest, para que nunca terminen en la misma pila.
- **Un archivo por frame.** Si la caja cae en dos frames de la misma fecha, se guardan los dos
  recortes sin unir (unir es procesamiento).
- **Reprocesos:** si la misma adquisición aparece con dos CRID, se usa el más alto.
- **Límite de disco:** `limite_gb: 5` en la config; el 02 se detiene antes de pasarlo.

## Áreas protegidas (no automatizado)

No encontré una fuente abierta con descarga directa y estable, así que no hay script. Dónde
conseguirlas:

- **SERNAP** (Servicio Nacional de Áreas Protegidas), vía **GeoBolivia** (<https://geo.gob.bo>):
  buscar "áreas protegidas" en el catálogo; ofrece capas nacionales, departamentales y
  municipales como shapefile o WFS.
- **MapBiomas Bolivia** (<https://bolivia.mapbiomas.org>): las estadísticas y mapas de cobertura
  incluyen áreas protegidas como unidad territorial.
- Alternativa global: **WDPA / Protected Planet** (<https://www.protectedplanet.net/country/BOL>),
  descarga manual con licencia de uso no comercial.

Guardar el archivo en `data/raw/boundaries/` (por ejemplo `areas_protegidas.geojson`).
Los enlaces de arriba son puntos de partida: no verifiqué una URL de descarga concreta.

## Estado de la descarga (14 nov 2026)

Total en `data/`: **0,88 GB** (límite 5 GB). Ningún script terminó con fallos.

| Dato | Qué se bajó | Peso |
|---|---|---|
| NISAR PROVISIONAL | Track 060 A, 9 fechas DHDH × 2 frames (169 y 170) × 4 capas = 72 GeoTIFF | 0,77 GB |
| NISAR VALIDATED | Nada: la colección no tiene escenas del track 060 A sobre la caja | 0 |
| Sentinel-2 | antes 2026-07-07 (0,0 % nubes en la caja), después 2026-09-28 (0,6 %); nir08, swir22, scl | 53 MB |
| FIRMS | 196 674 focos en Bolivia (17 jun – 14 nov), 1 134 en la caja | 45 MB |
| Límites | 9 departamentos (geoBoundaries ADM1, dominio público) | 9 MB |
| Huellas | 1 078 huellas GCOV PROVISIONAL, 16 tracks, 94 fechas | 1 MB |

### Calidad de la serie NISAR (track 060 A) — leer antes de procesar

Verificado con `make verificar` (tabla completa en `data/meta/verificacion.csv`):

| Fecha | Frame 169 (≈98 % de la caja) | Frame 170 (≈30 %, franja norte) |
|---|---|---|
| 2026-06-18 | **Mala**: bandas, mediana HH ≈ 8 (el browse oficial de NASA muestra lo mismo) | **Mala** |
| 2026-06-30 | **Desplazada ~20 km**: valores en rango, pero la imagen está fuera de su sitio (correlación 0,03 con las fechas limpias; coincide solo al moverla 20,5 km al norte y 4,4 km al oeste) | **Desplazada** |
| 2026-07-12 | **Vacía**: todo ceros, `mask` = 0 en el 100 % | **Mala**: mediana HH ≈ 1,1 |
| 2026-07-24 | **Mala**: valores ~8× más altos (mediana HH 1,7; p98 178) | **Vacía**: todo ceros |
| 2026-08-17 | buena | buena |
| 2026-08-29 | buena | buena |
| 2026-09-10 | buena | buena |
| 2026-10-04 | buena | buena |
| 2026-10-16 | buena | buena |

- Las 5 fechas posteriores al hueco son coherentes entre sí (mediana HH 0,18–0,21; HV 0,058–0,063).
- **Antes del hueco no hay ninguna escena utilizable** en este track: el 30 jun pasa los controles de valores,
  pero está georreferenciado ~20 km fuera de su sitio. La línea base solo puede salir de fechas posteriores al hueco.
  El problema es de la órbita 060A: las órbitas 161A, 089A y 118A tienen 3 o 4 fechas sanas antes del hueco
  (ver `BACKEND-ESTADO-LOCAL.md` en UraqiVisionBack).
- `mask` = 0 coincide con las zonas dañadas (18 jun: 43 %; 12 jul: 100 %), así que sirve para
  filtrar. El 24 jul no lo marca: hay que descartarlo por valores.
- Los dos frames están en **CRS distintos**: 169 en EPSG:32721 (UTM 21S) y 170 en EPSG:32720
  (UTM 20S). Sentinel-2 está en EPSG:32720. Habrá que reproyectar a una grilla común.
- El 22 sep existe en el track pero es SHSH (solo HH), por eso no está.

### Otras notas

- `openseppo` no está en el contenedor: en conda-forge exige Python ≥ 3.12 y aquí se fija 3.11.
- `uraqi_recorte_nisar.py` no estaba en la carpeta; el 02 se escribió desde cero.
- FIRMS: se usa el producto estándar (SP) hasta donde existe y NRT después. VIIRS SNPP NRT
  llegaba solo hasta el 2 nov según la propia API.
- El 02 tarda ~3 min por escena y una lectura HTTP se colgó una vez; por eso cada escena corre
  en un subproceso con límite de 12 min y reintentos.
- Sentinel-2 se guarda como DN uint16; si `boa_offset_aplicado` es verdadero en el manifest,
  reflectancia = DN / 10000.

## Comandos de cada script (rutas desde la raíz de UraqiVisionBack)

Lo normal es usar `make` dentro de `pipeline_beta/`, que corre cada script en el contenedor. Cada comando de
`make` equivale a uno de estos (con el entorno del contenedor):

| Paso | Comando |
|---|---|
| 00 | `python pipeline_beta/scripts/00_comprobar_entorno.py` |
| 01 | `python pipeline_beta/scripts/01_nisar_listar.py` |
| 02 | `python pipeline_beta/scripts/02_nisar_recortar.py --coleccion provisional --track 60 --dir A` |
| 03 | `python pipeline_beta/scripts/03_firms.py` |
| 04 | `python pipeline_beta/scripts/04_sentinel2.py` |
| 05 | `python pipeline_beta/scripts/05_limites.py` |
| 06 | `python pipeline_beta/scripts/06_huellas_bolivia.py` |
| 07 | `python pipeline_beta/scripts/07_verificar.py` |
| 08 | `python pipeline_beta/scripts/08_publicar_borrador.py` (publicación §17.3; «publicada con límites» o borrador) |
| 09 | `python pipeline_beta/scripts/09_enviar_avisos.py` (avisos de detecciones nuevas; `--enviar` para mandarlos) |
| 10 | `python pipeline_beta/scripts/10_mapa_agua.py` (mapa de agua de época seca; exploratorio, fuera del MVP) |

Utilidades compartidas: `pipeline_beta/scripts/_comun.py` (importado por todos).

Endpoint local de desarrollo para la web (lee `publicado/` y `zonas/*/publicado/`):

```bash
python3 pipeline_beta/zonas/servidor_estaciones.py --puerto 8787
```

Descarga de una zona nueva: `pipeline_beta/zonas/descargar_zona.sh <id> <Nombre> "<descripción>" <O> <S> <E> <N> [track dir]`.

## Avisos al servidor de alertas (RF-40, Futuro)

`09_enviar_avisos.py` lee la estación publicada y, por cada fecha con detección **confirmada** que todavía no se avisó,
manda un `AVISO` (nunca una `ALERTA`) a `POST /notificar` del servidor de alertas:

```json
{"tipo": "AVISO", "categoria": "PERDIDA_VEGETACION", "mensaje": "…", "destino": "todos",
 "datos": {"estacion": "sanignacio", "subtipo": "compatible_quema", "superficie_ha": 684, "rango_ha": [389, 1005],
           "fecha_observacion_utc": "…", "retraso_dias": 41, "enlace": "…/station/sanignacio", "nota": "…"}}
```

- Solo avisa estaciones `publicada_con_limites` (RN-04) y nunca da instrucciones de emergencia (RN-10): el dato de
  NISAR llega días o semanas después de la observación.
- La primera vez de cada estación solo avisa la fecha más reciente; lo ya avisado queda en `data/meta/avisos_enviados.json`.
- Variables: `AVISOS_URL`, `AVISOS_TOKEN` (cabecera `X-Token`, nunca en el código) y `AVISOS_WEB`. Sin `--enviar` solo
  muestra el aviso.

Para correr todo de forma periódica: `pipeline_beta/zonas/actualizar_y_avisar.sh` (baja escenas nuevas, publica y avisa
cada estación; en el propio script hay un ejemplo de cron).
