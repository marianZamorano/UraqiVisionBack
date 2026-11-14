# Plan: publicación de la estación (005-publicacion)

**Prompt:** P-PUBLICACION-03 (issue #47). **Sin código:** la implementación (P-PUBLICACION-06) depende de M-CIENCIA y
M-VALIDACIÓN de Tabata (P-CIENCIA-07, P-VALIDACION-06) y de P-PROY-07.

**Fuentes:** documento maestro §17.3 (propuesta de diseño), §18, §20.2, §22, §23.3; RF-05 a RF-09, RF-22, RF-27;
RNF-02, RNF-03, RNF-09, RNF-11; RN-03 a RN-07, RN-13; CQ-06; PS-02, PS-03. Spec: `specs/005-publicacion/spec.md`.

## 1. Discrepancias del prompt, registradas

- **`specs/001-base-pipeline` no existe.** El prompt dice «reutiliza la base». Se usa `docs/arquitectura.md` (capas)
  como base. Corregir el prompt o registrarlo como pendiente (lo decide el equipo; no se cambia ahora).
- **`specs/001-base-web/contracts` (repositorio UraqiVision) no existe** en la copia local. No se puede comparar con
  los tipos de la web: queda como **conflicto por verificar** (ver §5).

## 2. Arquitectura

Mismas capas que Insight (`docs/arquitectura.md`), propuestas para el pipeline:

| Capa | Responsabilidad en publicación |
|---|---|
| Dominio | Reglas de publicación: sin dato nunca cero (RN-13), fechas en UTC (RN-07), hectáreas con rango (RN-06), textos en es y en (RNF-03), no publicar sin procedencia (CQ-06). |
| Aplicación | Ensamblar la carpeta: escribir cada archivo y verificar que estén todos. |
| Infraestructura | Escritura de COG (rasterio), WebP (Pillow/imagen), GeoJSON (GeoPandas) y CSV (pandas). |
| Interfaz | Comando de publicación de una estación. |

## 3. Orden de implementación (cuando las dependencias estén)

1. Esquemas y validación de la carpeta (sin datos reales): `contracts/` y pruebas con datos sintéticos (PS-01).
2. `change.tif` y prueba de integridad: los valores del COG publicado igualan los del análisis (PS-02, RNF-09).
3. Vistas WebP de 8 bits con sus límites geográficos; peso total menor de 40 MB (RNF-02).
4. `station.json`, `manifest.json`, `quality.json`, `hectares.csv`, `scars.geojson`, `footprints.geojson` y
   `atlas/departments.geojson`.
5. Chequeo de contenido: todos los archivos y textos en es y en (PS-03).

## 4. Dependencias por archivo

| Archivo | Viene de | Estado de la dependencia |
|---|---|---|
| `manifest.json`, `footprints.geojson` | M-INGESTA (Alex) | P-INGESTA-02 a 05 en curso (#29, PR #30) |
| `change.tif`, vistas, `scars.geojson`, `hectares.csv` | M-CIENCIA (Tabata) | No iniciado (P-CIENCIA-01) |
| `validation.json`, parte de `quality.json` | M-VALIDACIÓN (Tabata) | No iniciado (P-VALIDACION-01) |
| `station.json` (textos) | Redacción del relato local | Pendiente: decidir quién lo redacta (spec, aclaración del equipo) |
| `atlas/departments.geojson` | Fuente y versión | Pendiente: decidir la fuente (spec, aclaración del equipo) |

## 5. Pendientes

- Comparar los esquemas con la web (`UraqiVision`) cuando exista su contrato. Si difieren, se registra como conflicto
  para acordarlo entre los dos repositorios.
- C3 a C5 de la spec (límites de vista, focos, versionado) pendientes de acordar con la web.
- Dos marcas `NEEDS CLARIFICATION` del equipo (límites departamentales y relato local).

## 6. Verificación prevista

- Pruebas con datos sintéticos (PS-01) y de integridad (PS-02) antes de cualquier dato real.
- Chequeo de contenido bilingüe (PS-03).
- Ninguna métrica ausente aparece como cero (RN-13).
