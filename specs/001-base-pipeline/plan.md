# Plan: base del pipeline (001-base-pipeline)

**Prompt:** P-PROY-03 (issue #63). Ejecutan Tabata y Mimi; revisa Alex.
**Fuentes:** §18 (stack), §19, §22, §23.3 y §28 del documento maestro v1.1; RNF-06, RNF-08, RNF-10, RNF-11, CQ-06, PS-01.

## 1. Stack de §18 y versiones

Versiones tomadas de PyPI el 14 de noviembre de 2026 (solo lectura, `https://pypi.org/pypi/<paquete>/json`). **Son la
versión vigente observada, no una fijación:** la fijación se hace al implementar (P-PROY-06) y queda en el archivo de
dependencias.

| Paquete (§18) | Versión observada | Fuente | Estado |
|---|---|---|---|
| asf_search | 14.1.0 | PyPI, 14 nov 2026 | Observada |
| earthaccess | 0.19.0 | PyPI, 14 nov 2026 | Observada |
| h5py | 3.16.0 | PyPI, 14 nov 2026 | Observada |
| NumPy | 2.5.4 | PyPI, 14 nov 2026 | Observada |
| xarray | 2026.9.0 | PyPI, 14 nov 2026 | Observada |
| rioxarray | 0.24.0 | PyPI, 14 nov 2026 | Observada |
| SciPy | 1.18.1 | PyPI, 14 nov 2026 | Observada |
| GeoPandas | 1.2.0 | PyPI, 14 nov 2026 | Observada |
| rasterio | 1.5.2 | PyPI, 14 nov 2026 | Observada |
| pandas | 3.1.1 | PyPI, 14 nov 2026 | Observada |
| Matplotlib | 3.11.2 | PyPI, 14 nov 2026 | Observada |
| pytest | 9.2.0 | PyPI, 14 nov 2026 | Observada |
| openSEPPO | — | — | **Pendiente**: no verificada |
| GDAL ≥ 3.13 | — | — | **Pendiente**: no verificada; §18 exige 3.13 o superior |

**Discrepancia local:** el pytest instalado en esta máquina es 9.1.1; el más reciente en PyPI es 9.2.0. Lo fija P-PROY-06.

## 2. Estructura del repositorio

Capas de `docs/arquitectura.md`, aplicadas al pipeline. Un paquete por área de §19:

| Paquete | Área (§19) | Responsable |
|---|---|---|
| `ingesta/` | M-INGESTA | Alex |
| `ciencia/` | M-CIENCIA | Tabata |
| `validacion/` | M-VALIDACIÓN | Tabata |
| `publicacion/` | M-PUBLICACIÓN | Mimi |
| `insight/` | M-INSIGHT (ya existe) | Mimi |

Cada paquete sigue la misma regla de dependencias: las interfaces van hacia el dominio.

## 3. Artefactos y pruebas

- **Entorno**: archivo de dependencias con versiones fijadas (P-PROY-06). Instalable desde cero (SC-001).
- **Pruebas**: `pytest` con datos sintéticos (PS-01), en `tests/`. Sin red ni credenciales.
- **Notebook reproducible**: esqueleto que lee el manifiesto y regenera (RNF-08). Forma pendiente (aclaración de la spec).
- **Manifiesto**: esquema con gránulos, CRID, sumas de verificación y versión del pipeline (CQ-06, `data-model.md`).
- **Licencias**: `LICENSE` (MIT) para el código y declaración CC BY 4.0 para textos y datos derivados (RNF-11).
- **Secretos**: `.env` y `.netrc` en `.gitignore`; la revisión del historial es PS-06.

## 4. Dependencias

- P-PROY-01 (constitución, propuesta sin ratificar).
- Alex: el pipeline de ingesta (#29, PR #30 en borrador) consume la base.
- Tabata: el entorno Python (P-PROY-06).

## 5. Riesgos

- **Versiones que cambian**: las versiones observadas hoy pueden cambiar antes de P-PROY-06. Fijarlas el mismo día que se implementan.
- **GDAL y openSEPPO**: sin verificar. Bloquean la ingesta real (§18, §22).
- **Instalar dependencias** exige aprobación de la persona antes de P-PROY-06 (reglas de seguridad de la skill vibecodear).
