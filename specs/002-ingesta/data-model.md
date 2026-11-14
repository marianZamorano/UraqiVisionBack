# Data Model: Ingesta de escenas NISAR (002-ingesta)

**Fecha**: 2026-11-14 · **Prompt SDD**: P-INGESTA-03

Los nombres de campos y de archivos son una **propuesta de diseño**; se concilian con el esquema de
`specs/001-base-pipeline` cuando exista. Las fechas van siempre en UTC (RN-07).

## ConfiguracionEstacion

Lo que la ingesta lee y nunca lleva escrito en el código.

| Campo | Descripción | Regla |
|---|---|---|
| `estacion` | Identificador de la estación | — |
| `area` | Caja del recorte en longitud y latitud | **Pendiente (DP-08)**; FR-012 |
| `periodo` | Inicio y fin de la búsqueda | — |
| `hueco` | Inicio y fin del hueco del instrumento (27 jul – 10 ago 2026, §10.1) | Se registra, no es un fallo |
| `orbita`, `direccion` | Órbita y dirección de la serie (060, ascendente) | FR-002a |
| `colecciones` | Colección PROVISIONAL y colección VALIDATED | RN-02; nunca BETA |
| `capas` | `HHHH`, `HVHV`, `mask` | FR-006, FR-010 |
| `bloque_promedio` | Tamaño del bloque del promedio a unos 60 m | FR-011 |
| `reintentos`, `limite_por_escena` | Parámetros de descarga | FR-015 |

## Escena

Un gránulo del catálogo. Se identifica por su nombre.

| Campo | Origen | Regla |
|---|---|---|
| `granulo` | Nombre del gránulo en el catálogo | Único |
| `adquisicion_inicio`, `adquisicion_fin` | Catálogo | UTC (RN-07) |
| `orbita`, `direccion`, `frame` | Atributos del catálogo | CQ-02 |
| `polarizaciones` | Atributos del catálogo | CQ-04 |
| `madurez` | Colección de origen: PROVISIONAL o VALIDATED | RN-02 |
| `crid` | Nombre del gránulo | RN-02 |
| `suma_granulo` | Suma y algoritmo publicados por el catálogo, o «no reportada» con motivo | FR-013, RN-13 |
| `huella` | Polígono del catálogo, sin modificar | RF-26 |
| `cobertura_area_pct` | Porcentaje del área que cubre la huella | FR-008 |

## Serie

Las escenas de una órbita, una dirección, una madurez y un CRID sobre el área (RN-01, RN-02).

| Campo | Descripción |
|---|---|
| `orbita`, `direccion`, `madurez`, `crid` | Iguales en todas sus escenas (SC-001) |
| `frame_principal` | El frame que cubre la mayor parte del área (FR-008) |
| `fechas` | Fechas incluidas, con la separación entre fechas consecutivas (FR-003) |
| `fechas_excluidas` | Fecha y motivo: sin HV, no obtenida, sin solape (FR-004, SC-005) |

Reglas:

- Una escena de otra órbita, dirección, madurez o CRID no entra en la serie.
- Si una adquisición aparece con más de una versión de procesamiento, entra una sola y el CRID de la serie
  sigue siendo único.
- El tramo VALIDATED es otra `Serie`, guardada aparte (FR-018).

## Recorte

Un archivo por escena y por capa, en la grilla original del producto.

| Campo | Descripción | Regla |
|---|---|---|
| `granulo` | Escena de origen | — |
| `capa` | `HHHH`, `HVHV` o `mask` | — |
| `crs`, `transformacion`, `tamano_px` | Geometría, igual a la del producto | FR-008, CQ-01 |
| `unidades` | Potencia lineal para HH y HV; tipo original para la máscara | FR-007 |
| `sin_dato` | `NaN` en HH y HV | FR-009, RN-13 |
| `suma_recorte` | SHA-256 del archivo | FR-013a |
| `observaciones` | Notas de la ingesta, por ejemplo «todo en cero» o «valores fuera de rango» | La exclusión la decide CQ-03 |
| `estado` | `ok`, `sin_solape` o `no_obtenida`, con su motivo | FR-015 |

Nombre propuesto: `<estacion>_<AAAAMMDD>_T<orbita><direccion>_F<frame>_<capa>.tif`. PROVISIONAL y VALIDATED
van en carpetas distintas.

## PilaPromediada

La salida de MC-01 para M-CIENCIA. **Pendiente de la confirmación de Tabata.**

| Campo | Descripción | Regla |
|---|---|---|
| `serie` | Serie de origen; solo su frame principal | RN-01 |
| `capa` | `HHHH` o `HVHV` | — |
| `bloque` | Tamaño del bloque en píxeles y resolución resultante | FR-011 |
| `valores` | Media en potencia lineal de los píxeles válidos del bloque, `float32` | §12 |
| `datos_validos` | Fracción de píxeles válidos de cada bloque | MC-01, CQ-05 |

## RegistroDeProcedencia

Los datos que la ingesta entrega para el manifiesto (CQ-06, §17.3). Una entrada por escena usada.

| Campo | Origen |
|---|---|
| `granulo`, `fecha`, `orbita`, `direccion`, `frame`, `madurez`, `crid` | `Escena` |
| `suma_granulo` | `Escena` |
| `recortes` | Ruta y `suma_recorte` de cada `Recorte` |
| `version_pipeline` | La que defina `specs/001-base-pipeline` (**hipótesis**) |
| `generado` | Fecha y hora de generación, en UTC |

## Huella

Un elemento GeoJSON por escena usada: la geometría del catálogo y las propiedades `orbita`, `direccion`,
`frame`, `fecha` y `polarizaciones` (RF-26, §17.3).

## FocoDeCalor

| Campo | Descripción |
|---|---|
| `latitud`, `longitud` | Posición del foco |
| `fecha_hora` | Adquisición, en UTC |
| `fuente` | Sensor y producto (por ejemplo VIIRS S-NPP estándar o de tiempo casi real) |
| `confianza` | La que publica FIRMS, sin reinterpretar |

## Estados de una escena en la ingesta

```text
encontrada → en la serie → recortada (ok)
           ↘ excluida (sin HV · otra órbita · otra versión de procesamiento)
en la serie → sin_solape (la huella toca el área, la grilla no)
            → no_obtenida (agotó los reintentos; se reintenta al relanzar)
```
