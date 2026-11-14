# Contrato propuesto: archivos publicados de una estación (§17.3)

**Estado:** propuesta de diseño, no fijada por el documento maestro (§17.3: «puede ajustarse»). **Sin verificar** contra
los tipos de la web (`UraqiVision`), que no están en la copia local. Cualquier cambio se registra en §17.3 antes de
implementarlo.

| Archivo | Contenido | Reglas que el contrato hace cumplir |
|---|---|---|
| `station.json` | identificador; nombre en es y en; área; órbita usada; fechas en UTC; hipótesis con fuente; relato local; preguntas sugeridas | RNF-03 (es y en); RN-05 (cada hipótesis con fuente); RN-07 (UTC) |
| `manifest.json` | gránulos usados (nombre, fecha, órbita, CRID, suma de verificación); versión del pipeline | CQ-06 (procedencia completa); RN-02 (un solo CRID por serie) |
| `change.tif` | máscara o puntaje de cambio, COG sin pérdida | RNF-09 (valores idénticos); §22 (sin pérdida) |
| `views/AAAAMMDD_hv.webp`, `_hh`, `_ratio` | vistas de 8 bits con sus límites geográficos | §22 (separadas del análisis); RF-08 (HV y cociente deshabilitados si falta HH o HV) |
| `scars.geojson` | polígonos de cicatrices con fecha y clase | RN-05 (clases con su significado) |
| `hectares.csv` | fecha, hectáreas, rango inferior y superior | RN-06 (rango obligatorio); RN-13 (ausente no es cero) |
| `validation.json` | métricas frente a Sentinel-2 y contexto de focos de calor | VC-01 a VC-05; provisional hasta que M-VALIDACIÓN lo fije |
| `quality.json` | resultado de cada control de calidad (§23.2) | CQ-01 a CQ-06; cada control aparece, aunque no se pudo calcular (con motivo) |
| `footprints.geojson` | huellas de las escenas: órbita, dirección, fechas, polarizaciones | RF-26 (coinciden con el catálogo CMR) |
| `atlas/departments.geojson` | límites departamentales con fuente, fecha y versión | común a todo el sitio; fuente pendiente |

## Reglas generales

- Una métrica no calculada aparece como «no reportada» con su motivo, nunca como 0 (RN-13).
- El peso total de las vistas es menor de 40 MB (RNF-02).
- Ninguna carpeta se publica si falta un archivo requerido o no pasa el chequeo de contenido (CQ-06, PS-03).
- Las fechas se guardan en UTC (RN-07).

## Comparación con la web (P-PUBLICACION-03, #70)

Fuente: `specs/001-base-web/contracts/published-data.ts` del repositorio `UraqiVision`, rama `dev`, leída en solo
lectura el 14 nov 2026. Esta sección solo registra diferencias. No cambia el contrato de la web ni se decide por ella:
cada conflicto se acuerda con la web antes de estabilizar el formato.

| Archivo | Coincide | Diferencia | Conflicto |
|---|---|---|---|
| `station.json` | identificador, nombres es/en, área, órbita, hipótesis con fuente, relato, preguntas | La web añade `schemaVersion`, `departmentId`, `evidenceMode` (REAL o DEMO), `periods` con `before`/`after` (aquí «fechas»), `provenance` y el área como valor con estado | C1, C2 |
| `manifest.json` | gránulos (nombre, fecha, órbita, CRID, suma), versión del pipeline | La web añade `schemaVersion`, `publicationId`, `publishedAt`, `polarizations` y `files` (ruta, sha256, tipo, bytes) | C3 |
| `change.tif` | Ruta del COG (`changeCogUrl`) | La web no declara sin pérdida ni el peso | — |
| `views/*.webp` | Lista de vistas (`viewUrls`) | La web no tiene los límites geográficos de cada vista, que sí exige este contrato | C4 |
| `scars.geojson` | Fecha y clase | La web añade `stationId`, `periodId`, `evidenceMode`, `hectares` (con estado) y usa estas cuatro clases: `burn-compatible`, `prior-structure-loss-compatible`, `ambiguous-evidence`, `insufficient-data` | C2, C5 |
| `hectares.csv` | Fecha, hectáreas, rango inferior y superior | La web añade `stationId`, `periodId`, `polarization` (RF-08) y el estado «no reportada» con su motivo (RN-13) | C6 |
| `validation.json` | Métricas frente a Sentinel-2 y contexto de focos | La web solo tiene Dice, mientras VC-01 pide precisión, exhaustividad y Dice. Además la web pone los `controls` aquí, no en `quality.json` | C7, C8 |
| `quality.json` | Resultado de cada control (§23.2) | La web tiene `passed` (booleano) y `limitations` bilingües, sin lista de controles | C8 |
| `footprints.geojson` | Órbita, dirección, fechas, polarizaciones | La web añade `stationId` y `source` (RN-03) | C9 |
| `atlas/departments.geojson` | Límites con fuente, fecha y versión | La web añade `departmentId` y los nombres `nameEs`/`nameEn` (RNF-03) | C9 |

### Conflictos pendientes de acordar con la web

- **C1. `evidenceMode` (REAL o DEMO) no existe aquí.** Hace falta para que ninguna cifra simulada se vea como resultado (RN-04). Prioridad alta.
- **C2. Identificadores de periodo y de estación.** La web exige `periodId`, `stationId` y `departmentId` en varios archivos. Aquí no están.
- **C3. Procedencia del manifiesto.** La web pide `files` con sha256 de cada archivo, `publicationId` y `publishedAt`. Aquí la suma solo aparece por gránulo, sin algoritmo fijado.
- **C4. Límites geográficos de cada vista.** Aquí son obligatorios; la web no tiene campo para ellos.
- **C5. Nombres de clase.** Los cuatro nombres de la web son propuestos. RN-05 fija el significado de cada clase, no los identificadores.
- **C6. Polarización y «no reportada» en `hectares.csv`.** La web los modela; aquí no se describe cómo se representan en CSV.
- **C7. Métricas de validación.** VC-01 pide precisión, exhaustividad y Dice; la web solo tiene Dice. Lo decide M-VALIDACIÓN (Tabata) y se acuerda con la web.
- **C8. Dónde viven los controles.** Aquí están en `quality.json` (uno por control). La web los pone en `validation.json` y en `quality.json` solo tiene `passed`.
- **C9. Fuentes y nombres en atlas y huellas.** La web pide `source` en huellas y nombres bilingües en departamentos.

Ningún archivo publicado se implementa hasta acordar C1 a C9. La prueba de contrato (PS-03) comparará el resultado con
el acuerdo final, no con esta propuesta.
