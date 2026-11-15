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

## 0. Decisiones del 14 nov 2026 y estado actual

Tabata (M-CIENCIA) acordó, por medio de Alex, que se decidieran los puntos abiertos. Quedan registradas en cada
`station.json → decisiones` y en `08_publicar_borrador.py → DECISIONES`.

| Punto | Decisión |
|---|---|
| **DP-08** recorte | Caja de ~50 km centrada en (−60,81, −15,92), 52 km al norte del pueblo: la que más focos FIRMS tiene desde el 11 ago (2.576) entre las que están a menos de 60 km del pueblo y caben en un solo frame (060A f170). Zona `zonas/dp08_san_ignacio`, publicada como `sanignacio`. La caja anterior, centrada en el pueblo, quedó archivada en `nasa/publicado_archivo/` |
| **DP-05** zonas de control | 6 bloques de ~1 km por estación: mediana de HV a ±1,5 dB de la que tenía lo que después cayó, sin focos a menos de 2 km, dNBR < 0,27, a más de 1 km de parches y del borde, textura ≤ p75 (descarta parcelas), 5 km entre zonas. Restan la deriva estacional (MC-05) |
| **MC-03** umbrales | Los menos exigentes que dejan marcado como máximo el 2 / 1 / 0,5 % de la superficie donde Sentinel-2 no ve cambio (sensible / central / estricto). Un primer intento con percentiles de las zonas de control marcaba el 16 % de lo que no cambió y se descartó |
| **MC-02** línea base | 2 fechas (17 y 29 ago), desviación declarada: en la órbita 060A no hay 3 fechas sanas antes del evento |
| **VC-01** | Par Sentinel-2 que encierra al radar: 26 ago → 13 oct (San Ignacio) y 26 ago → 20 oct (Chiquitanía este) |
| **CQ-06** | MD5 y tamaño de cada gránulo original desde NASA CMR (`data/meta/cmr_checksums.json`) |
| **Estado** | `publicada_con_limites` (el endpoint la sirve como REAL) solo si hay zonas de control, umbrales calibrados, CQ-06 completo y par óptico que encierra al radar; si no, `borrador_exploratorio` (DEMO). C1 sigue pendiente de confirmar con Mimi |

| | San Ignacio (DP-08) | Chiquitanía este |
|---|---|---|
| Umbrales (sensible / central / estricto) | −2,9 / −3,8 / −4,5 dB | −4,0 / −4,9 / −5,6 dB |
| Caída sostenida de HV al 16 oct | 982 ha (526–1.729) | 333 ha (138–922) |
| Marcado en quema severa / sin cambio óptico | 60 % / 1,9 % | 54 % / 1,9 % |
| Dice frente a dNBR > 0,27 | 0,36 | 0,39 |
| Focos del periodo en o junto a un parche | 600 de 1.258 | 717 de 1.404 |

Límites que siguen declarados en la web: línea base de 2 fechas; lo quemado antes del 17 ago no se ve; producto
PROVISIONAL; el óptico incluye la caída de hojas; falta la revisión visual (VC-05).

### Estaciones al 15 nov 2026

| Estación (`id`) | Departamento | Órbita | Línea base | Caída sostenida de HV (última fecha) | Tramo VALIDATED | Estado |
|---|---|---|---|---|---|---|
| `sanignacio` (DP-08) | Santa Cruz | 060A | 2 fechas | 982 ha (526–1.729) al 16 oct | 28 oct | `publicada_con_limites` |
| `chiquitaniaeste` | Santa Cruz | 060A | 2 fechas | 333 ha (138–922) al 16 oct | 28 oct | `publicada_con_limites` |
| `chiquitania-oeste` | Santa Cruz | 161A | 3 fechas (cumple MC-02) | 4.432 ha (2.065–8.660) al 11 oct | 23 oct | `publicada_con_limites` |
| `beni-norte` | Beni | 089A | 4 fechas (cumple MC-02) | 21.406 ha (15.177–29.465) al 18 oct | 30 oct | `publicada_con_limites` |
| `alto-beni` | La Paz | 118A | 3 fechas | 435 ha (267–786) al 20 oct | 1 nov | `borrador_exploratorio` (1 sola zona de control) |

**Tramo VALIDATED (RN-02):** `08` publica las fechas VALIDATED de la misma órbita y frame como vistas aparte
(`views/val_AAAAMMDD_{hv,hh,ratio}.webp`, con `coleccion: "validated"`, su CRID y **sus propias esquinas**, porque la
grilla puede diferir) y las lista en `station.json → tramo_validated`. Nunca entran a la línea base, al cambio ni a
las hectáreas; la web las muestra en un bloque propio.

### Calidad por órbita (control de valores y de posición, 14 nov)

| Zona | Órbita | Fechas sanas antes del hueco | Después | Uso |
|---|---|---|---|---|
| San Ignacio (DP-08), Chiquitanía este | 060A | 0 | 5 | Publicadas con línea base de 2 fechas |
| Chiquitanía oeste | 161A | 3 | 5 | Estación: cumple MC-02 |
| Beni norte | 089A | 4 | 6 | Estación: cumple MC-02 |
| Chapare, Moxos | 089A | 4 | 6 | Mapa de agua de época seca |
| Alto Beni / Tipuani | 118A | 3 | 6 | Mapa de agua de época seca |
| Norte de Santa Cruz | 068D | 2 | 3 (la mitad de las fechas en otra grilla) | **Descartada** como estación |

Los datos dañados antes del hueco son un problema de la órbita 060A, no de NISAR en general. `norte_san_ignacio` se
borró: la reemplaza la caja de DP-08.

### Mapas de agua de época seca (`10_mapa_agua.py`, exploratorio, fuera del MVP)

Referencia para medir inundaciones cuando se publiquen las escenas de lluvias. Agua abierta = HH y HV muy oscuros;
frecuencia de agua en las fechas sanas (≥ 0,8 permanente; 0,2–0,8 ocasional); doble rebote fuerte solo como contexto
(puede ser bosque inundado o techos). En las tres zonas el umbral de Otsu cayó en el tope (−14 dB): el histograma no
separa limpio agua y tierra, así que manda el límite físico; revisar con imágenes ópticas antes de usarlo.

| Zona | Agua permanente | Salida |
|---|---|---|
| Moxos | ~9.970 ha (meandros, lagos en herradura, lagunas) | `zonas/moxos/publicado/moxos_agua/` |
| Alto Beni / Tipuani | ~590 ha | `zonas/alto_beni_tipuani/publicado/altobenitipuani_agua/` |
| Chapare | ~550 ha (río principal) | `zonas/chapare/publicado/chapare_agua/` |

### Avisos (`09_enviar_avisos.py`, RF-40, Futuro)

Integrado con el servidor de alertas del equipo (`server/`, fuera de git): `POST /notificar` con `tipo: "AVISO"`,
`categoria: "PERDIDA_VEGETACION"` y los datos de la detección; nunca `ALERTA` de emergencia (RN-10), porque el dato de
NISAR llega días o semanas después. Probado de punta a punta en local. `zonas/actualizar_y_avisar.sh` lo corre para
todas las estaciones; no está programado en el sistema.

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
| `dp08_san_ignacio` | −61,045 −16,153 −60,575 −15,693 | Caja DP-08 (2.576 focos) | 060A f170 | 5 buenas; las previas, inservibles; +1 VALIDATED (28 oct) | **Publicada** (`sanignacio`) |
| `chiquitania_oeste` | −62,04 −15,98 −61,57 −15,51 | Probar la órbita 161A | 161A f170 | **8 de 8 pasan valores, incluidas 3 previas al hueco** | **Publicada** |
| `beni_norte` | −65,80 −12,22 −65,33 −11,75 | Probar la órbita 089A | 089A f172 | **10 de 10 pasan valores, incluidas 4 previas** | **Publicada** |
| `santa_cruz_norte` | −63,92 −15,98 −63,45 −15,51 | Probar la órbita 068D | 068D f096 | Mezcla; varias fechas con <50 % de cobertura | Descargada |
| `chapare` | −65,66 −17,21 −65,19 −16,74 | «Antes» para inundaciones | 089A f169 | **10 de 10 pasan valores** (época seca) | Descargada |
| `alto_beni_tipuani` | −68,24 −15,79 −67,77 −15,32 | «Antes» para inundaciones y estación de La Paz | 118A f170 | **9 de 9 pasan valores** (época seca) | Mapa de agua + estación en borrador (`alto-beni`) |
| `moxos` | −65,14 −15,07 −64,67 −14,60 | Humedales en época seca | 089A | Pasan valores | Mapa de agua |

**Zonas nuevas en descarga (15 nov, `zonas/cola.txt`):** `chiquitania_oeste_sur` (161A), `beni_sur`, `beni_centro`,
`beni_este` (089A), `beni_noreste` (161A), `pando` y `la_paz_amazonia` (017A, calidad sin probar) y `oruro_poopo`
(solo mapa de agua). Al terminar cada una: control de posición, sección `estacion:` y par Sentinel-2 que encierre
al radar en su `config/aoi.yaml`, y correr `04` y `08` (`10` en Poopó). `norte_san_ignacio` se borró (la reemplaza
DP-08).

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
| `footprints.geojson` | Huellas de las escenas de la serie (órbita, dirección, frame, fecha, polarización y uso en la serie: RF-26) |
| `views/val_*.webp` + `station.json → tramo_validated` | Tramo VALIDATED aparte, con sus propias esquinas (RN-02) |
| `fires.geojson` | Focos FIRMS de la caja (**no está en §17.3**: propuesta) |
| `atlas/departments.geojson` | Límites departamentales con fuente y licencia |

**Resultados del primer borrador (13 nov, caja anterior y umbrales fijos; solo historial, los vigentes están en §0):**

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
| `GET /api/agua` | Mapas de agua de época seca (exploratorios): id, nombre es/en, esquinas, imagen y hectáreas |
| `GET /agua/<id>/<archivo>` | Archivos de un mapa de agua (`agua_capa.webp`: solo las clases de agua, el resto transparente) |

Decisiones provisionales de la traducción: `evidenceMode: "REAL"` solo si la estación está `publicada_con_limites`
(si no, `DEMO`; conflicto C1 pendiente con Mimi), `departamento` y `departmentId` para agrupar, `area` = hectáreas
de la última fecha con `status: "limited"`, resumen con rango (RN-06), fechas útiles y excluidas.

**No es la arquitectura final**: §17 prevé archivos estáticos en el hospedaje (DP-06 pendiente). Sirve para
desarrollar mientras se acuerdan C1–C9.

```bash
python3 pipeline_beta/zonas/servidor_estaciones.py                     # endpoint en :8787
cd UraqiVision/web && VITE_PUBLISHED_API=http://127.0.0.1:8787/api npm run dev   # web en :5173
```

La web (`UraqiVision`, ya en `dev` por la PR #119) consume estos archivos en el mapa 2D de cada estación (MapLibre
5.24.0): radar por fecha y polarización, parches por clase, focos, zonas de control y la respuesta paso a paso. Las
capas de huellas, agua de referencia y tramo VALIDATED están en una rama local del frontend, sin subir. El mapa
oficial es de M-MAPA (Joaco).

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
