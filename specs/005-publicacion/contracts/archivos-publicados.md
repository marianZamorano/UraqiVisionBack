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
