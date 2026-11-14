# Contrato: salidas de la ingesta

**Fecha**: 2026-11-14 · **Estado**: propuesta de diseño, a conciliar con `specs/001-base-pipeline` y con
`specs/005-publicacion`.

La ingesta no expone ningún servicio. Su interfaz con los otros módulos son archivos. Este contrato dice qué
entrega, a quién y con qué garantías. No cambia la estructura de la estación publicada de §17.3.

## Para M-CIENCIA (Tabata)

| Salida | Formato | Garantías |
|---|---|---|
| Recortes por fecha de HH y HV | COG `float32`, potencia lineal, sin pérdida | Grilla original, sin remuestreo; sin dato como `NaN`; un archivo por frame (FR-007, FR-008, FR-009) |
| Máscara por fecha | COG en su tipo original | Copiada sin interpretar; su significado está pendiente (DP-03) |
| Pila promediada a unos 60 m | COG `float32`, potencia lineal, con fracción de datos válidos | Solo el frame principal; promedio en lineal (FR-011). **Pendiente de la confirmación de Tabata** |
| Serie | Tabla con fechas incluidas, separación entre fechas y fechas excluidas con motivo | Una órbita, una dirección, una madurez y un CRID (FR-002, FR-003, FR-004) |

## Para M-VALIDACIÓN (Tabata, con apoyo de Alex)

| Salida | Formato | Garantías |
|---|---|---|
| Focos de calor del periodo | Tabla con posición, fecha y hora en UTC, fuente y confianza | Cada foco con su fecha y su fuente (FR-017) |
| Observaciones por escena | Campo de la tabla de la serie | La ingesta anota; excluir es decisión de CQ-03 y CQ-05 |

## Para M-PUBLICACIÓN (Mimi) y la web

| Salida | Formato | Garantías |
|---|---|---|
| Datos de procedencia | JSON, una entrada por escena usada | Gránulo, fecha, órbita, CRID, suma del gránulo y de cada recorte, versión del pipeline; ningún campo vacío (FR-013, FR-013a, SC-003) |
| Huellas de las escenas usadas | GeoJSON (`footprints.geojson` de §17.3) | Geometría del catálogo sin modificar; órbita, dirección, fechas y polarizaciones (FR-016, RF-26) |

## Reglas comunes

- Las fechas son las de adquisición, en UTC (RN-07).
- PROVISIONAL y VALIDATED van en carpetas y series separadas (RN-02).
- Ningún archivo contiene credenciales ni rutas a ellas (RNF-06).
- Un archivo incompleto nunca queda con su nombre definitivo (FR-015).
