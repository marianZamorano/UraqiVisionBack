# Backend de UraqiVision — estado local (14 nov 2026)

Resumen de lo que existe **en la máquina de Alex** sobre datos, procesamiento y endpoints del backend. Nada de esto
está en git todavía: el código vive en `nasa/` (repositorio propio de descarga) y en `nasa/zonas/`, fuera de
`UraqiVisionBack`. Para integrarlo hay que seguir el flujo del equipo (issue → rama `tipo/N` desde `dev` → PR).

> **Todo lo publicado es un borrador exploratorio.** Umbrales sin calibrar (MC-03), sin zonas de control (DP-05),
> línea base de 2 fechas en lugar de 3 (MC-02). Ninguna cifra es un resultado (RN-04).

Rutas relativas a `~/projects/hackathon/`.

**En este repositorio**, el código está en `pipeline_beta/` (copia de `nasa/` más `nasa/zonas/`): donde abajo dice
`nasa/…`, en el repo es `pipeline_beta/…`. Datos, carpetas publicadas, logs y el `.html` del cuaderno no se
versionan (`pipeline_beta/.gitignore`); el cuaderno va sin salidas. Para reconstruir: `cp .env.example .env`
(credenciales Earthdata y FIRMS), `make build`, scripts 00–07, y `08_publicar_borrador.py`.

## 1. Mapa de carpetas

| Ruta | Qué es |
|---|---|
| `nasa/` | Pipeline de descarga original (repo git propio). Zona San Ignacio de Velasco |
| `nasa/scripts/00…08` | Scripts del pipeline (ver §2) |
| `nasa/config/aoi.yaml` | Caja, periodo, hueco, colecciones, límite de GB y textos de la estación |
| `nasa/data/` | Datos de San Ignacio (0,88 GB, ignorado por git) |
| `nasa/publicado/sanignacio/` | Estación San Ignacio publicada en borrador (§17.3) |
| `nasa/notebooks/01_explorar_san_ignacio.ipynb` (+ `.html`) | Cuaderno explicativo en español (ver §6) |
| `nasa/zonas/<zona>/` | Copia aislada del pipeline por zona, con sus propios `config/` y `data/` |
| `nasa/zonas/descargar_zona.sh` | Crea una zona nueva y la descarga entera |
| `nasa/zonas/cola.txt` | Lista de zonas candidatas que se descargaron |
| `nasa/zonas/servidor_estaciones.py` | Endpoint local que sirve las estaciones a la web (ver §5) |
| `UraqiVisionBack/pipeline_beta/` | Lo que se versiona: código de `nasa/` y `nasa/zonas/` sin datos |

## 2. Pipeline de descarga (`nasa/scripts/`)

Todo corre en el contenedor Docker `uraqivision:latest` (micromamba, Python 3.11, GDAL 3.12.3). Credenciales en
`nasa/.env` (Earthdata y FIRMS): nunca se leen ni se versionan.

| Paso | Comando (`make …` desde `nasa/`) | Qué hace |
|---|---|---|
| 00 | `comprobar` | Importa las librerías y dice qué credenciales ve |
| 01 | `listar` | Escenas NISAR GCOV que tocan la caja, por órbita, y recomendación de track → `data/meta/nisar_escenas.csv` |
| 02 | `recortar COLECCION=… TRACK=… DIR=…` | Lee del HDF5 remoto **solo la ventana de la caja** (h5py) y escribe COG float32 en potencia lineal (HHHH, HVHV, mask, numberOfLooks) |
| 03 | `firms` | Focos VIIRS/MODIS de Bolivia desde el 17 jun y recorte a la caja |
| 04 | `sentinel2` | Sentinel-2 L2A antes/después (nir08, swir22, scl) con menos nubes en la caja |
| 05 | `limites` | Departamentos de Bolivia (geoBoundaries ADM1) |
| 06 | `huellas` | Huellas GCOV PROVISIONAL sobre Bolivia |
| 07 | `verificar` | Valida los GeoTIFF (CRS, tipo, % válido, rango) → `data/meta/verificacion.csv` y quicklooks |
| 08 | `docker compose run --rm uraqi python pipeline_beta/scripts/08_publicar_borrador.py` (en el contenedor, desde `pipeline_beta/`: `scripts/08_…`) | **Nuevo.** Análisis exploratorio y carpeta publicada §17.3 (ver §4) |

Reglas que el código ya cumple: nunca descarga el HDF5 entero; PROVISIONAL y VALIDATED en carpetas separadas
(RN-02); un archivo por frame; reprocesos → CRID más alto; límite de 5 GB por zona.

## 3. Zonas y datos descargados

Elegidas con un ranking de focos FIRMS por celdas de ~50 km (desde el 11 ago, el criterio de DP-08) y la cobertura
NISAR con HH+HV. Todas con 0 fallos de descarga.

| Zona (`nasa/zonas/…`) | Caja (O, S, E, N) | Para qué | Órbita | Fechas NISAR (frame principal) | Estado |
|---|---|---|---|---|---|
| `nasa/` (San Ignacio) | −61,20 −16,60 −60,72 −16,14 | Estación original | 060A f169 | 5 buenas (17 ago–16 oct); **las 4 previas al hueco, inservibles** | **Publicada** |
| `chiquitania_este` | −59,69 −17,86 −59,22 −17,39 | Celda con más focos de Bolivia (5.100) | 060A f169 | 5 buenas; las 4 previas, inservibles; +1 VALIDATED (28 oct) | **Publicada** |
| `norte_san_ignacio` | −61,10 −15,98 −60,63 −15,51 | Candidata DP-08 dentro del municipio (2.404 focos) | 060A f170 | 6 pasan valores (30 jun incluido); 3 previas malas | Descargada |
| `chiquitania_oeste` | −62,04 −15,98 −61,57 −15,51 | Probar la órbita 161A | 161A f170 | **8 de 8 pasan valores, incluidas 3 previas al hueco** | Descargada |
| `beni_norte` | −65,80 −12,22 −65,33 −11,75 | Probar la órbita 089A | 089A f172 | **10 de 10 pasan valores, incluidas 4 previas** | Descargada |
| `santa_cruz_norte` | −63,92 −15,98 −63,45 −15,51 | Probar la órbita 068D | 068D f096 | Mezcla; varias fechas con <50 % de cobertura | Descargada |
| `chapare` | −65,66 −17,21 −65,19 −16,74 | «Antes» para inundaciones | 089A f169 | **10 de 10 pasan valores** (época seca) | Descargada |
| `alto_beni_tipuani` | −68,24 −15,79 −67,77 −15,32 | «Antes» para inundaciones | 118A f170 | **9 de 9 pasan valores** (época seca) | Descargada |
| `moxos` | −65,14 −15,07 −64,67 −14,60 | Humedales en época seca | 089A | En curso al escribir esto | Descargando |

«Pasan valores» = control de `07_verificar` (mediana en rango físico, cobertura). **Falta el control de posición**
(ver §3.1) en las zonas nuevas antes de darlas por buenas. En las zonas con dos frames, el que aparece con
«<50 % válido» es el frame que solo roza la caja; se usa el otro.

### 3.1 Hallazgos de calidad

- **Órbita 060A antes del hueco (27 jul–10 ago): inservible en las tres cajas.** 18 jun y 24 jul con valores
  ~30× y ~8× demasiado altos (la vista previa oficial de NASA muestra las mismas bandas); 12 jul vacío (ceros).
- **30 jun (060A, frame 169) está desplazado ~20 km** (20,5 km al norte, 4,4 km al oeste). Pasa todos los controles
  de valores; solo lo delata la correlación con una fecha limpia (0,03 contra 0,98–1,00). El README de `nasa/`
  todavía lo da por «utilizable»: **corregir**.
- **Las órbitas 161A, 089A y 118A sí pasan los valores antes del hueco** → posibles líneas base de verdad.
- Frames 169 y 170 están en UTM distintos (21S y 20S); conviene elegir cajas dentro de un solo frame.
- La capa `mask` marca parte del daño (18 jun 43 %, 12 jul 100 %) pero no el 24 jul ni el 30 jun (DP-03 pendiente).
- Los datos apuntan a la región correcta: el pueblo y su represa aparecen en su sitio en HH, HV y Sentinel-2, y
  radar y óptico se alinean con desplazamiento 0 m.

## 4. Publicación en borrador (`08_publicar_borrador.py`)

Lee `config/aoi.yaml` (incluida la sección `estacion:` con nombre y criterio en es/en), los datos de la zona y
escribe `publicado/<id>/`. Método (exploratorio):

1. Frame con más píxeles válidos; veredicto por fecha = control de valores + **correlación ≥ 0,5 con la fecha más
   coherente** (detecta fechas desplazadas).
2. HV a 60 m (promedio 3×3 en lineal), máscara `mask == 1` en las 5 fechas.
3. Línea base = mediana de ≥3 fechas previas al hueco si existen; si no, las 2 primeras buenas.
4. Cambio de HV en dB contra la línea base, menos la deriva de toda la escena (mediana de la mitad más vegetada,
   sustituto de MC-05).
5. Candidato = caída bajo el umbral **sostenida** en la fecha siguiente; parches ≥ 1 ha (≥ 3 píxeles).
   Umbrales −3 / −2,5 / −2 dB → rango de hectáreas.
6. Clase por parche (RN-05) por orden temporal de focos a ≤ 360 m: *durante* el intervalo de la caída →
   compatible con quema; solo *después* → pérdida previa de estructura; ninguno → ambigua; última fecha o borde
   → datos insuficientes.

| Archivo | Contenido |
|---|---|
| `station.json` | id, `estado: borrador_exploratorio`, aviso es/en, nombre, caja y criterio, órbita, cada fecha con estado, motivo, correlación y rol, hipótesis con fuente, resumen por clase. Relato y preguntas = `null` con motivo |
| `manifest.json` | Gránulos (escena, fecha, órbita, CRID) con **sha256 de cada recorte**, versión del pipeline, Sentinel-2 y FIRMS usados |
| `change.tif` | COG float32: cambio de HV (dB) de la última fecha |
| `views/AAAAMMDD_{hv,hh,ratio}.webp` + `views/index.json` | Vistas de 8 bits (transparente = sin dato) y sus **4 esquinas en lon/lat** |
| `scars.geojson` | Parches (WGS 84) con clase (id + es/en), motivo, fecha de primera detección, ha, caída, focos |
| `hectares.csv` | fecha, hectáreas, rango inferior y superior, confirmada (sí/no), fuente, método |
| `validation.json` | `validacion_limitada: true` con motivo; VC-01 (precisión, exhaustividad, Dice) y VC-02 (focos) |
| `quality.json` | CQ-01 a CQ-06 con resultado; fechas excluidas con motivo; deriva por fecha |
| `footprints.geojson` | Huellas de las escenas de la serie |
| `fires.geojson` | Focos FIRMS de la caja (**no está en §17.3**: propuesta) |
| `atlas/departments.geojson` | Límites departamentales con fuente y licencia |

**Resultados del borrador (no publicables):**

| | San Ignacio | Chiquitanía este |
|---|---|---|
| Caída sostenida de HV al 16 oct | 442 ha (302–590) | 2.266 ha (1.540–3.190) |
| Compatible con quema | 3 ha | 2.609 ha |
| Pérdida previa de estructura | 158 ha | 203 ha |
| Ambigua / insuficiente | 367 / 62 ha | 322 / 57 ha |
| Focos del periodo en o junto a un parche | 17 % | 80 % |
| Dice frente a dNBR (> 0,44) | 0,07 | 0,36 |

El cuaderno daba 51 ha «compatibles con quema» en San Ignacio porque contaba focos desde el inicio de la línea
base (17 ago); el script cuenta desde su última fecha (29 ago). Decisión de método para M-CIENCIA.

Para publicar otra zona: añadir `estacion:` a su `config/aoi.yaml`, copiar el `08` a su `scripts/` y correrlo.

## 5. Endpoint local (`nasa/zonas/servidor_estaciones.py`)

Servidor HTTP de desarrollo, solo biblioteca estándar, en `127.0.0.1:8787`, con CORS. Busca estaciones en
`nasa/publicado/*/` y `nasa/zonas/*/publicado/*/`: las nuevas aparecen solas.

| Ruta | Devuelve |
|---|---|
| `GET /api/estaciones` | Lista: `stationId`, `label` es/en, `estado` |
| `GET /api/estaciones/<id>` | La estación en la forma `PublishedStation` de la web (`web/src/contracts/view-state.ts`), traducida aquí |
| `GET /estaciones/<id>/<archivo>` | Cualquier archivo publicado tal cual (GeoJSON, CSV, WebP, COG…). Rutas fuera de la carpeta → 404 |

Decisiones provisionales de la traducción: `evidenceMode: "DEMO"` (datos reales sin calibrar; conflicto C1
pendiente), `area` = hectáreas de la última fecha con `status: "limited"`, resumen con rango (RN-06), fechas
útiles y excluidas.

**No es la arquitectura final**: §17 prevé archivos estáticos en el hospedaje (DP-06 pendiente). Sirve para
desarrollar mientras se acuerdan C1–C9.

```bash
python3 pipeline_beta/zonas/servidor_estaciones.py                     # endpoint en :8787
cd UraqiVision/web && VITE_PUBLISHED_API=http://127.0.0.1:8787/api npm run dev   # web en :5173
```

En la web (rama local `local/prueba-mapa-chiquitania` de `UraqiVision`, sin subir) hay un prototipo de mapa 2D
(MapLibre 5.24.0) que consume estos archivos: radar por fecha y polarización, parches por clase, focos y gráfico
de hectáreas. El mapa oficial es de M-MAPA (Joaco).

## 6. Cuaderno

`nasa/notebooks/01_explorar_san_ignacio.ipynb` (y `.html` estático): recorrido en español por los datos de San
Ignacio. Ubicación y comprobación de que apuntan al pueblo, cómo leer el radar, la serie y por qué se excluye cada
fecha, `mask`, focos, y el análisis del MVP (cicatrices, quema o desmonte con clasificación honesta, recuperación
como contexto, validación limitada), más una guía de «imágenes raras». Se abre con `make lab` desde `nasa/`.

## 7. Pendientes y decisiones del equipo

| Tema | Quién | Nota |
|---|---|---|
| **DP-08**: recorte oficial | Alex y Tabata | Opciones con datos: norte de San Ignacio (dentro del municipio, sin verificar límites) o Chiquitanía este (cambia el alcance de §8.1) |
| Control de posición en las zonas nuevas | Alex | Antes de usar 161A/089A/118A como línea base |
| Conflictos **C1–C9** del contrato con la web | Mimi y la web | Ver `specs/005-publicacion/contracts/archivos-publicados.md` (rama `docs/70-contrato-publicacion-web`) |
| `fires.geojson` en el contrato | Mimi | RF-10 lo necesita; §17.3 no lo lista |
| CQ-06 completo | Alex | Falta la suma de verificación del gránulo original de ASF |
| Umbrales, zonas de control, línea base ≥3 | Tabata | MC-02, MC-03, MC-05, DP-05 |
| Corregir el README de `nasa/` sobre el 30 jun | Alex | Está desplazado, no «utilizable» |
| Integrar en `UraqiVisionBack` | Alex | Por issue y PR; el paquete `ingesta/` debería tener una config por estación en lugar de copiar carpetas |
| Inundaciones | Equipo | Fuera del MVP (§8.2). Los «antes» de Chapare, Alto Beni y Moxos ya están descargados; las escenas de lluvias se publican semanas después |

Casos revisados y **descartados para radar**: inundaciones de Achumani e Irpavi (marzo de 2026, antes de NISAR;
riadas urbanas demasiado cortas y estrechas) y deslizamientos de Achumani (abril y 11 oct de 2026, ~30–40 m³,
mucho menores que un píxel de 20 m). Sirven como contexto con fuente en la ficha de La Paz.
