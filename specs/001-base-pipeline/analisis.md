# Análisis de coherencia: base del pipeline (001-base-pipeline)

**Prompt:** P-PROY-05 (issue #65). **En espera de la aprobación de la persona («apruebo») antes de cerrar la fase.**
Compara `spec.md`, `plan.md`, `data-model.md`, `research.md` y `tasks.md`. Sin cambios de código ni de dependencias.

## Coincidencias

| Requisito | Dónde se cumple | Estado |
|---|---|---|
| RNF-10: entorno gratuito | `spec.md` (FR-008), `tasks.md` T010 | Coincide |
| RNF-11: licencias | `spec.md` (FR-006), `tasks.md` T005 | Coincide |
| RNF-06 / PS-06: secretos fuera del repositorio | `spec.md` (FR-007), `tasks.md` T006, T007 | Coincide |
| CQ-06 y RN-13: procedencia y ausencia no es cero | `data-model.md`, `tasks.md` T008 | Coincide |
| RNF-08: notebook reproducible | `spec.md` (FR-004), `tasks.md` T009 | Coincide, con forma pendiente |
| PS-01: pruebas con datos sintéticos | `spec.md` (FR-003), `tasks.md` T004 | Coincide |

## Discrepancias y riesgos

| ID | Origen | Qué | Gravedad | Estado |
|---|---|---|---|---|
| D1 | Plan | openSEPPO y GDAL ≥ 3.13 sin verificar. §18 los exige para recortar y exportar. | Alta | **Abierta** (T002). |
| D2 | Plan vs entorno | El pytest local (9.1.1) no coincide con el más reciente en PyPI (9.2.0). | Baja | **Abierta**: lo fija P-PROY-06. |
| D3 | Spec | Dos `NEEDS CLARIFICATION`: versiones exactas y forma del notebook. | Media | **Abierta**. |
| D4 | Plan vs spec | La spec dice «sin librerías», pero el plan las lista. La regla es para la spec; el plan es donde van, así que no es contradicción. | Ninguna | Verificado. |
| D5 | Constitución | La constitución y algunas specs citan el documento **v1.0**; AGENTS.md ahora apunta a **v1.1**. Los identificadores que usa esta base no cambian entre versiones. | Baja | **Abierta**: actualizar las referencias. |
| D6 | Estado | No existe archivo de dependencias ni `pyproject.toml`. Es lo esperado antes de P-PROY-06. | Ninguna | Verificado. |
| D7 | Prompt P-PROY-02 | El prompt pide «ejecutar P-PROY-02» con Tabata y Mimi, pero el borrador lo escribió Mimi. Tabata debe revisarlo. | Media | **Abierta**: revisión de Tabata. |

## Conclusión

La spec, el plan y las tareas son coherentes entre sí y con el documento. Lo que bloquea el avance es externo: la
verificación de openSEPPO y GDAL (D1), la revisión de Tabata (D7) y la decisión sobre las dos aclaraciones (D3).
**No instalar dependencias ni crear el paquete hasta la aprobación de la persona (P-PROY-06).**
