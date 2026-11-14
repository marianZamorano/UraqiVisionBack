# Modelo de datos: manifiesto de procedencia (001-base-pipeline)

**Prompt:** P-PROY-03 (issue #63). Propuesta de diseño; el esquema definitivo lo cierra M-INGESTA (Alex) con M-PUBLICACIÓN.

## Manifiesto (`manifest.json`)

| Campo | Tipo | Regla | Fuente |
|---|---|---|---|
| `estacion` | texto | identificador de la estación | §17.3 |
| `granulos` | lista | uno por escena usada | §17.3, CQ-06 |
| `granulos[].nombre` | texto | nombre del gránulo | §17.3 |
| `granulos[].fecha` | fecha UTC | fecha de adquisición | RN-07 |
| `granulos[].orbita` | entero | misma órbita en toda la serie | RN-01, CQ-02 |
| `granulos[].crid` | texto | un solo CRID por serie | RN-02 |
| `granulos[].madurez` | texto | PROVISIONAL o VALIDATED, nunca BETA | RN-02 |
| `granulos[].suma` | texto | suma de verificación del archivo | CQ-06 |
| `version_pipeline` | texto | versión del pipeline que produjo el resultado | CQ-06, RNF-08 |

**Regla**: ningún campo vacío se rellena con 0; un dato ausente se marca como «no reportada» con su motivo (RN-13).
