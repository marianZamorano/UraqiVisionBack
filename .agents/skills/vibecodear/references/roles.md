# Roles de Vibecodear en UraqiVision

Activa un rol **solo** si aparece alguna de sus señales en el diagnóstico. Cada rol indica qué **skills** cargar,
qué **subagentes** usar (los de solo lectura revisan; los marcados ✎ pueden escribir con aprobación) y qué
**persona del equipo** es responsable según §19 del documento maestro.

## Cómo adquirir el conocimiento de un rol

1. La base mínima es el **checklist** del rol y sus **skills** del repositorio: funcionan sin conexión.
2. Para el dominio del proyecto (radar, NISAR, métodos, alcance) la fuente es el **documento maestro**, nunca un
   roadmap genérico.
3. Si la tarea requiere más profundidad técnica, abre el **roadmap de referencia** con WebFetch y consulta solo
   los temas relacionados. Úsalo como mapa de temas, no copies su contenido; cita el enlace si una decisión se
   apoyó en él.
4. Para APIs de librerías (rasterio, xarray, GDAL, asf_search, earthaccess) usa el MCP `context7` o la
   documentación oficial; no escribas APIs de memoria.

**Roadmap transversal:** [Vibe Coding](https://roadmap.sh/vibe-coding): cambios pequeños y verificables, revisar
lo generado, probar antes de aceptar y no confiar en código que no entiendes.

## Roles

| Rol | Responsable (§19) | Señales que lo activan | Skills | Subagentes | Checklist | Fuente de conocimiento |
| --- | --- | --- | --- | --- | --- | --- |
| **Engineering Manager** | Quien ejecuta el Sprint | Siempre (coordina) | `documento-maestro`, `entrega-hackathon` | `guardian-alcance` | Priorizar por el plan de §25, limitar alcance a §8, explicar trade-offs | [engineering-manager](https://roadmap.sh/engineering-manager) |
| **Scrum Master** | Equipo | Varias tareas o Sprints previos; bloque de §25 en riesgo | `entrega-hackathon`, `sdd-uraqivision`, `flujo-issues-y-pr` | — | Sprint corto, tareas pequeñas, impedimentos visibles, hito del sábado 13:00 | [engineering-manager](https://roadmap.sh/engineering-manager) |
| **Product Owner** | Angie y Marian | Objetivo ambiguo, duda de alcance, función Plus pedida | `documento-maestro`, `sdd-uraqivision` | `guardian-alcance` | Valor para el gestor de área protegida, criterio medible, qué queda fuera (§8.2) | [product-design](https://roadmap.sh/product-design) |
| **Arquitecto/a** | Equipo (consulta obligatoria, §28) | Cambio de arquitectura, formato de archivo o contrato | `documento-maestro`, `publicacion-estacion` | `guardian-alcance` | Arquitectura estática (§17): el backend publica los archivos de §17.3 y expone Insight (§21.1); un cambio de contrato se acuerda con `UraqiVision` | [software-architect](https://roadmap.sh/software-architect) |
| **Datos e ingesta** | Alex (revisa Tabata) | Búsqueda o descarga de escenas, recorte, manifiesto, huellas (RF-26) | `ingesta-nisar-asf`, `python-geoespacial`, `ciencia-radar-nisar` | `revisor-cientifico` | Misma órbita y grilla, CRID y sumas de verificación, credenciales solo por nombre | Documento maestro §10, §17.2 · [python](https://roadmap.sh/python) |
| **Ciencia radar** | Tabata (revisa Alex) | Pipeline MC-01 a MC-09, umbrales, clases, hectáreas, validación | `ciencia-radar-nisar`, `python-geoespacial`, `validacion-optica-firms`, `notebook-reproducible`, `test-driven-development`, `systematic-debugging` | `revisor-cientifico`, `automation-qa-engineer` ✎ | Lineal antes de dB, sin dato ≠ 0, cuatro clases, rango de hectáreas, VC-01 | Documento maestro §9, §11, §12, §23 |
| **Publicación** | Mimi (revisa Tabata) | Vistas, GeoJSON, CSV, COG, textos de la estación | `publicacion-estacion`, `python-geoespacial` | `auditor-publicacion` | §17.3 completo, COG sin pérdida, < 40 MB, es/en, CQ-06 | Documento maestro §17.3, §22 |
| **Insight** | Mimi (revisa Marian) | Función serverless, prompt, plantillas, límites | `insight-lector-radar` | `revisor-insight`, `security-qa-engineer` | Clave solo en servidor, RN-09/10/14, plantillas en ambos idiomas | Documento maestro §21 · [ai-engineer](https://roadmap.sh/ai-engineer) |
| **QA** | Revisor de cada módulo | Sin pruebas, pruebas fallando, antes de integrar | `qa-test-strategy`, `qa-test-design`, `qa-automation`, `qa-regression-analysis`, `qa-quality-gates`, `qa-test-reporting`, `qa-defect-analysis`, `codigo-vivo`, `verification-before-completion` | `qa-architect` ✎, `automation-qa-engineer` ✎, `test-evidence-analyst`, `revisor-qa`, `revisor-codigo-vivo` | Caso feliz, inválido y límite; PS-01 a PS-09; evidencia ejecutada | [qa](https://roadmap.sh/qa) |
| **DevSecOps** | Mimi (repositorio y hospedaje) | Secretos, dependencias, despliegue, planes gratuitos | `flujo-issues-y-pr`, `devops-secrets-management`, `devops-dependency-security`, `devops-git-workflow`, `devops-release-readiness`, `devops-free-tier-audit`, `devops-supervised-execution`, `qa-security-testing` | `devsecops-engineer`, `release-readiness-reviewer`, `free-tier-architect`, `security-qa-engineer` | Ninguna clave en bundle ni historial, todo gratis salvo la IA (RNF-10), DP-06 sin decidir por el agente | [devops](https://roadmap.sh/devops) |

## Especialidades de stack

Se activan junto al rol que corresponda cuando la tecnología aparece en el diagnóstico.

| Tecnología | Señales | Revisar | Fuente |
| --- | --- | --- | --- |
| **Python geoespacial** (rasterio, xarray, GeoPandas, h5py) | `requirements*.txt`, `pyproject.toml`, notebooks | COG float32 sin pérdida, CRS y grilla, `NaN` preservado, pruebas con datos sintéticos | [python](https://roadmap.sh/python) · `context7` |
| **Función serverless** | carpeta `api/` o equivalente | Clave en variables del servidor, límites, plantillas | Documentación del proveedor elegido en DP-06 |

> Si aparece una tecnología que no está aquí, busca su roadmap en [roadmap.sh](https://roadmap.sh) y aplica el
> mismo procedimiento; si contradice el stack de §18, es una decisión del equipo.

> **Roles de frontend** (Frontend, Globo y mapa, UX y accesibilidad, Contenidos; responsables Joaco, Angie y
> Marian) trabajan en el repositorio [`UraqiVision`](https://github.com/marianZamorano/UraqiVision). Si el
> diagnóstico detecta trabajo de la web, indícalo y no lo hagas aquí.
