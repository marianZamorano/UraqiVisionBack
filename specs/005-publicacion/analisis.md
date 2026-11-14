# Análisis de consistencia: publicación de la estación (005-publicacion)

**Estado:** P-PUBLICACION-05 (issue #55). Análisis sin cambios de código ni de contrato. **En espera** de la aprobación
de la persona antes de cerrar la fase. Compara `spec.md`, `plan.md`, `contracts/archivos-publicados.md` y `tasks.md`.

## Coincidencias verificadas

| Requisito | Dónde se verifica | Estado |
|---|---|---|
| RF-08 y CQ-04: HV y cociente se deshabilitan si falta HH o HV | `spec.md` (US2, escenario 2), `contracts/` y `tasks.md` T009 | Coincide |
| RN-13: ausente nunca es cero | `spec.md` (FR-013), `contracts/` (reglas generales) y `tasks.md` T004 | Coincide |
| RN-07: fechas en UTC | `spec.md` (FR-014), `contracts/` y `tasks.md` T005 | Coincide |
| RNF-02: vistas menores de 40 MB | `spec.md` (FR-015), `plan.md` y `tasks.md` T007 | Coincide (no comprobable sin datos) |
| RN-06: hectáreas con rango | `spec.md` (FR-007), `contracts/` (`hectares.csv`) y `tasks.md` T003 | Coincide |
| Ninguna tarea del plan está hecha | `tasks.md` (todas `[ ]`) | Coincide (la implementación empieza en P-PUBLICACION-06) |

## Discrepancias y riesgos

| ID | Origen | Qué | Gravedad | Estado |
|---|---|---|---|---|
| D1 | Prompt P-PUBLICACION-03 | Cita `specs/001-base-pipeline`, que no existe. | Media | **Abierta.** Corregir el prompt o registrarlo como pendiente: lo decide el equipo. |
| D2 | Plan vs web | No se pueden comparar los esquemas con `specs/001-base-web/contracts`: no está en la copia local. | Alta | **Abierta** (T018). |
| D3 | Spec vs web | C3 a C5 (límites de vista, focos, versionado) pendientes de acordar con la web. | Alta | **Abierta** (T019). |
| D4 | Spec | Dos marcas `NEEDS CLARIFICATION` del equipo: límites departamentales y relato local. | Media | **Abierta** (T016, T017). |
| D5 | Contrato | `validation.json` y `quality.json` son provisionales hasta que M-VALIDACIÓN (Tabata) fije sus esquemas. | Media | **Abierta**: depende de P-VALIDACION-06. |
| D6 | Plan vs M-INGESTA | `manifest.json` y `footprints.geojson` dependen de P-INGESTA-02 a 05 (#29, PR #30 en borrador). | Alta | **Abierta**: bloquea T014 y T015. |
| D7 | Fuente de verdad | AGENTS.md ahora apunta al documento **v1.1**. Los identificadores que usa esta spec no cambian entre v1.0 y v1.1, pero la constitución y algunas specs aún citan v1.0. | Baja | **Abierta**: actualizar las referencias (ver §2). |
| D8 | Contrato vs §23 | `quality.json` debe listar cada control de §23.2, incluso los no calculados. Hoy el contrato lo dice, pero sin lista cerrada de controles. | Media | **Abierta**: definir la lista con M-VALIDACIÓN. |

## Revisión de la fuente de verdad (v1.1)

Comparado con v1.0, el documento v1.1 cambia 21 líneas:

- Una regla de la web: el token público de Cesium ion solo con alcance `assets:read` y solo en el entorno de la web.
  No afecta al backend, pero la regla de AGENTS.md (RNF-06) ya lo cubre: ningún token en el repositorio.
- Una decisión cerrada del frontend sobre Cesium ion (14 de noviembre de 2026). No es de esta spec.

No cambian DP-01 a DP-08, ni RF-16 a RF-18, ni RN-09, RN-10, RN-14, ni §17.3 ni §21.1.

## Conclusión

La spec, el plan y las tareas son coherentes entre sí. Las discrepancias que bloquean el avance son externas al módulo:
D2 (web), D3 (acuerdo con la web) y D6 (M-INGESTA). Ninguna tarea se implementa hasta resolverlas o hasta que
las dependencias se completen. **No cambiar código en este análisis.**
