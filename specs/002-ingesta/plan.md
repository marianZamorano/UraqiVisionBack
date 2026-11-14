# Implementation Plan: Ingesta de escenas NISAR de la estación San Ignacio de Velasco

**Branch**: `docs/29-aclarar-planificar-tareas-y-analizar-la-ingesta` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-ingesta/spec.md`

**Módulo (§19)**: M-INGESTA, con Alex como responsable y Tabata como revisora · **Issue**: #29 ·
**Prompt SDD**: P-INGESTA-03

> El documento maestro manda. Lo que el documento no fija se marca como **propuesta** o **hipótesis**, y lo que
> depende de §29 como **pendiente (DP-xx)**. Este plan no decide DP-08 ni DP-03.

## Summary

La ingesta busca en el catálogo las escenas NISAR L2 GCOV de la órbita 060 ascendente sobre San Ignacio de
Velasco, recorta desde la nube solo el área y guarda HH, HV y la máscara de cada fecha como COG en potencia
lineal, `float32` y sin pérdida, sin conservar los originales. Además entrega la pila promediada a unos 60 m
(MC-01), los datos de procedencia para el manifiesto (CQ-06), las huellas de las escenas (RF-26), los focos
FIRMS del periodo y el tramo VALIDATED aparte (RN-02).

Enfoque técnico ([research.md](research.md)): búsqueda en CMR con `earthaccess`; recorte con GDAL 3.13 o
superior por `/vsicurl/` y `gdal_translate -projwin`, sin remuestreo; escritura con `rasterio` y el driver
COG; credenciales por `.netrc`. Todo lo que depende de `specs/001-base-pipeline`, que todavía no existe, queda
como hipótesis.

## Technical Context

**Language/Version**: Python. La versión la fija `specs/001-base-pipeline` (**hipótesis**: 3.11, la de la
prueba de Alex).

**Primary Dependencies**: `earthaccess` y `asf_search` (búsqueda), GDAL ≥ 3.13 (lectura y recorte desde la
nube), `h5py` (variables del GCOV), `rasterio` (COG), NumPy (promedio), GeoPandas y Shapely (huellas y focos),
pandas (tablas). Todas están en §18. `openSEPPO` queda descartado por ahora (research R2).

**Storage**: archivos en una carpeta de datos local que no se versiona: COG por fecha, GeoJSON, CSV y JSON.
Sin bases de datos (§8.2).

**Testing**: `pytest` con rásters sintéticos (PS-01) y prueba de integridad de los COG (PS-02). Las pruebas no
usan la red ni credenciales.

**Target Platform**: Linux, en el entorno reproducible que defina la base del pipeline (**hipótesis**: un
contenedor, como en la prueba de Alex).

**Project Type**: herramienta de línea de comandos dentro del pipeline en Python.

**Performance Goals**: unos 3 minutos por escena según la prueba de Alex (**observación**, por reproducir). La
serie de la órbita 060A son 18 escenas (9 fechas × 2 frames); el primer par antes/después debe estar a la hora
de §25 (SC-008).

**Constraints**: no se descarga ningún gránulo entero (unos 2 GB cada uno); no se remuestrea el análisis
(§22); no se escriben valores en dB; solo servicios gratuitos (RNF-10); ninguna credencial en el repositorio
ni en las salidas (RNF-06).

**Scale/Scope**: una estación, una órbita principal, 9 fechas con HH y HV, más el tramo VALIDATED y los focos
del periodo.

## Constitution Check

*GATE: se evalúa antes de la investigación y de nuevo después del diseño.* Constitución: versión 1.0.0
(propuesta), fusionada en `dev` con la PR #26.

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Documento maestro primero | Solo MC-01, RF-26 y lo que §25 agenda a Alex. DP-08 y DP-03 quedan como parámetro y como capa sin interpretar. | ✔ |
| II. Rigor científico | Una órbita, una dirección, una madurez y un CRID por serie (RN-01, RN-02); potencia lineal, nunca dB (§12); sin dato como `NaN` (RN-13); fechas en UTC (RN-07). | ✔ |
| III. Integridad y reproducibilidad | COG `float32` sin pérdida y prueba PS-02; suma del gránulo y de cada recorte; repetir desde el manifiesto da lo mismo (RNF-08, CQ-06). | ✔ |
| IV. Arquitectura estática primero | La ingesta solo produce archivos; no hay servicio. No cambia ningún contrato de §17.3. | ✔ |
| V. Seguridad y costo | Credenciales por `.netrc`, nunca leídas ni impresas; servicios gratuitos. La clave de FIRMS exige avisar al equipo antes de tocar `.env.example`. | ✔, con aviso |
| VI. Honestidad | Las escenas anómalas se entregan con su observación, no se corrigen ni se rellenan; nada simulado sale como resultado (RN-04). | ✔ |
| VII. Trazabilidad | Cada tarea y cada commit citan su identificador y el issue #29; una tarea a la vez con su prueba. | ✔ |

Reevaluación tras el diseño: sin violaciones. Hay un **riesgo abierto**, no una violación: si GDAL 3.13 no se
puede instalar, el respaldo con `h5py` (research R2) se aparta de la herramienta que §18 fija para recortar y
necesita el acuerdo del equipo antes de usarse.

## Project Structure

### Documentation (this feature)

```text
specs/002-ingesta/
├── spec.md
├── plan.md              # este archivo
├── research.md          # decisiones, hechos verificados e hipótesis
├── data-model.md        # entidades y estados
├── quickstart.md        # cómo comprobar la ingesta
├── contracts/
│   └── salidas-ingesta.md   # qué archivos entrega a los otros módulos
├── checklists/requirements.md
└── tasks.md             # lo crea /speckit-tasks (P-INGESTA-04)
```

### Source Code (repository root)

**Hipótesis**: la estructura real la define `specs/001-base-pipeline`. Propuesta para conciliar con ella:

```text
pipeline/
├── config/
│   └── san_ignacio.yaml          # área (DP-08), periodo, hueco, órbita, colecciones
├── src/uraqi/ingesta/
│   ├── config.py                 # lee y valida la configuración
│   ├── descarga.py               # reintentos, tiempo límite y escritura atómica
│   ├── catalogo.py               # búsqueda en CMR y metadatos de cada escena
│   ├── serie.py                  # reglas RN-01, RN-02, CQ-02, CQ-04 y fechas excluidas
│   ├── recorte.py                # ventana sobre la grilla y lectura desde la nube
│   ├── cog.py                    # escritura sin pérdida y suma de verificación
│   ├── promedio.py               # pila a unos 60 m en potencia lineal
│   ├── procedencia.py            # datos para el manifiesto
│   ├── huellas.py                # footprints.geojson
│   ├── firms.py                  # focos del periodo
│   └── cli.py                    # comandos: listar, recortar, promediar, huellas, focos
└── tests/ingesta/
    ├── test_config.py            # PS-01
    ├── test_descarga.py          # PS-01: reintentos y escritura atómica
    ├── test_serie.py             # PS-01
    ├── test_recorte.py           # PS-01: ventana sin remuestreo
    ├── test_cog.py               # PS-02: valores idénticos
    ├── test_promedio.py          # PS-01: lineal, NaN, datos válidos
    ├── test_procedencia.py       # CQ-06: ningún campo vacío
    ├── test_huellas.py           # RF-26
    └── test_firms.py             # PS-01
```

**Structure Decision**: un solo paquete de ingesta dentro del pipeline, con un módulo por responsabilidad y
una prueba por módulo. La lógica que no necesita la red (reglas de la serie, ventana, escritura, promedio,
procedencia) se separa de la que sí la necesita (catálogo, lectura remota, FIRMS), para poder probarla con
datos sintéticos.

El código de la prueba de recorte de Alex, que hoy está fuera del repositorio, es el punto de partida de
`catalogo.py`, `recorte.py`, `cog.py`, `huellas.py` y `firms.py`. Entra en la fase de implementación
(P-INGESTA-06 y P-INGESTA-07), tarea por tarea y con su prueba, no como un bloque.

## Fases de implementación (para /speckit-tasks)

Orden de §25. Cada fase termina con sus pruebas en verde.

1. **Entorno y configuración**: comprobar que el entorno trae GDAL ≥ 3.13 (o activar el respaldo acordado);
   archivo de configuración con el área como parámetro.
2. **Búsqueda y serie** (historia 1): listado del catálogo, reglas de la serie y fechas excluidas con motivo.
3. **Recorte y COG** (historia 1): ventana sin remuestreo, un archivo por frame, sin dato como `NaN`,
   reintentos por escena. Meta de §25: primer par antes/después.
4. **Procedencia** (historia 2): suma del gránulo y de cada recorte; datos para el manifiesto.
5. **Promedio a unos 60 m** (historia 1, MC-01): solo después de la confirmación de Tabata.
6. **Huellas** (historia 3) y **focos FIRMS** (historia 4).
7. **Tramo VALIDATED** (historia 5), en carpeta y serie aparte.

## Dependencias con otras áreas

| De quién | Qué | Cuándo |
|---|---|---|
| Tabata y Mimi (`001-base-pipeline`) | Estructura del proyecto, versión de Python, esquema del manifiesto | Antes de P-INGESTA-06 |
| Tabata (M-CIENCIA) | Confirmar que la ingesta entrega la pila a unos 60 m; acordar la línea base | Antes de P-INGESTA-04 |
| Alex y Tabata (DP-08) | Área definitiva del recorte | Antes de la descarga definitiva |
| Tabata (DP-03) | Significado de los valores de la máscara | No bloquea la ingesta |
| Equipo | Aviso del cambio de estructura del entorno por la clave de FIRMS | Antes de tocar `.env.example` |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
