# Herramientas de IA de UraqiVision

Skills, subagentes, hooks y servidores MCP para **Claude Code, Gemini CLI, Codex CLI y opencode**, definidos
una sola vez y generados para cada plataforma. Este repositorio es el **backend** (pipeline e Insight): las
skills y subagentes de la web están en [`UraqiVision`](https://github.com/marianZamorano/UraqiVision). Las reglas del proyecto están en [`AGENTS.md`](../AGENTS.md);
la fuente de verdad es [`docs/UraqiVisionDocumentoMaestrov1.0.pdf`](../docs/UraqiVisionDocumentoMaestrov1.0.pdf).

## Qué se edita y qué se genera

| Se edita a mano (fuente) | Se genera con `node ai/sync.mjs` |
|---|---|
| `.agents/skills/<skill>/` | `.claude/skills/<skill>/` (Gemini, Codex y opencode leen `.agents/skills/` directamente) |
| `ai/agents/<agente>.md` | `.claude/agents/`, `.gemini/agents/`, `.codex/agents/*.toml`, `.opencode/agents/` |
| `ai/hooks/` | `.claude/settings.json`, `.gemini/settings.json`, `.codex/hooks.json`, `.opencode/plugins/uraqi-guardas.js` |
| `ai/mcp/servers.json` (versiones en `ai/mcp/launch.mjs`) | `.mcp.json`, `.gemini/settings.json`, `.codex/config.toml`, `opencode.json` |

Los archivos generados llevan la marca «Generado por ai/sync.mjs». Si los editas a mano, el siguiente sync
los pisa. Tu configuración personal de Claude va en `.claude/settings.local.json` (ignorado por git).
Las skills `speckit-*` y los comandos de Spec Kit los mantiene `specify`, no este script.

```bash
node ai/sync.mjs           # genera o actualiza
node ai/sync.mjs --check   # código 1 si algo quedó desactualizado (útil en CI)
node --test ai/hooks/test/guard.test.mjs   # pruebas de las guardas
```

## Primera vez en tu máquina

1. Node 20 o superior (los hooks y el lanzador de MCP usan Node, sin dependencias).
2. Activa los hooks de git (escaneo de secretos y avisos sobre el mensaje del commit):
   `git config core.hooksPath .githooks`
3. Según tu asistente:
   - **Claude Code**: acepta los servidores de `.mcp.json` la primera vez que abras el proyecto.
   - **Codex CLI**: marca el proyecto como de confianza y revisa los hooks con `/hooks`.
   - **Gemini CLI**: lee `AGENTS.md` gracias a `.gemini/settings.json`.
   - **opencode**: carga `opencode.json` y el plugin de guardas automáticamente.
4. Opcional: `CONTEXT7_API_KEY` en tu entorno para subir el límite de uso de `context7`.

## El coordinador: `vibecodear`

Engineering Manager técnico (adaptado de MichiCode). Diagnostica el proyecto frente al documento maestro,
activa solo los roles necesarios y, para cada uno, sabe qué skills cargar, qué subagentes usar y qué persona
del equipo es responsable ([roles.md](../.agents/skills/vibecodear/references/roles.md)). Trabaja por Sprints
con dos puntos de control (plan y feedback) y documenta en `.vibecodear/sprints/`.

## Skills por rol importadas de chapterCoreIEEE

| Rol | Skills | Cómo se trajeron |
|---|---|---|
| QA | `qa-project-discovery`, `qa-test-strategy`, `qa-test-design`, `qa-automation`, `qa-regression-analysis`, `qa-quality-gates`, `qa-test-reporting`, `qa-defect-analysis`, `qa-security-testing` | Rutas cambiadas a `ai/qa/scripts/`; scripts y fixtures incluidos |
| QA (MIT, obra/superpowers) | `test-driven-development`, `systematic-debugging`, `verification-before-completion` | Copia idéntica, con `LICENSE` y `PROVENANCE.md` (SHA-256 verificado) |
| DevSecOps | `devops-secrets-management`, `devops-dependency-security`, `devops-git-workflow`, `devops-release-readiness`, `devops-free-tier-audit`, `devops-supervised-execution` | Rutas cambiadas a `ai/devops/scripts/` |

No se trajeron, por no aplicar a UraqiVision: las skills de NestJS y PostgreSQL, `dynamic-json-forms`,
`devops-container-audit`, `devops-iac-review`, `terraform-style-guide`, `devops-observability`,
`devops-incident-analysis`, `devops-ci-cd-review`, `devops-vercel-deployment` (hospedaje pendiente, DP-06) y
las de API, contratos, integración con base de datos y carga.

## Skills propias de UraqiVision (`.agents/skills/`)

| Skill | Para qué | Módulos |
|---|---|---|
| `documento-maestro` | Encontrar requisitos por identificador, comprobar el alcance, clasificar hechos e hipótesis | Todos |
| `sdd-uraqivision` | Flujo de Spec Kit adaptado al documento y al hackathon, con prompts listos | Todos |
| `ciencia-radar-nisar` | MC-01–MC-09, CQ, VC, unidades lineal/dB, sin dato ≠ 0 | M-INGESTA, M-CIENCIA, M-VALIDACIÓN |
| `publicacion-estacion` | Contrato de la carpeta publicada (§17.3), COG sin pérdida, peso | M-PUBLICACIÓN |
| `insight-lector-radar` | Contrato, adaptador, plantillas, límites y seguridad de la clave | M-INSIGHT |
| `rigor-y-fuentes` | Citas, APA 7, hechos frente a hipótesis, nada inventado | M-ATLAS, contenidos |
| `entrega-hackathon` | Estado frente al plan (§25), demo de 7 láminas, checklist de entrega | Todo el equipo |
| `ingesta-nisar-asf` | Buscar GCOV con asf_search/earthaccess, recortar con GDAL ≥ 3.13, manifiesto y huellas (RF-26) | M-INGESTA |
| `python-geoespacial` | COG float32 sin pérdida, NaN en lugar de 0, lineal → dB, pytest con rásters sintéticos | M-CIENCIA, M-PUBLICACIÓN |
| `validacion-optica-firms` | dNBR de Sentinel-2, focos FIRMS, precisión, exhaustividad y Dice (VC-01 a VC-05) | M-VALIDACIÓN |
| `notebook-reproducible` | Regenerar resultados desde el manifiesto, revisión visual y figuras de control (RNF-08) | M-CIENCIA |
| `verification-before-completion` | Evidencia antes de afirmar que algo funciona (MIT, de obra/superpowers) | Todos |

## Subagentes (`ai/agents/`)

El campo `access` del frontmatter decide si pueden escribir (`write`, siempre con aprobación) o no (`read`, por
defecto); `web: true` les da búsqueda web.

### Por rol, importados de chapterCoreIEEE y adaptados

| Subagente | Rol | Acceso |
|---|---|---|
| `qa-architect` | Estrategia de pruebas basada en riesgo (PS, VC, CQ) | Escribe documentos de QA con aprobación |
| `automation-qa-engineer` | Suites pytest, Vitest y Playwright con TDD; pruebas flaky | Escribe pruebas con aprobación |
| `security-qa-engineer` | Seguridad defensiva, claves, Insight, OWASP | Solo lectura |
| `test-evidence-analyst` | Interpreta resultados y redacta defectos | Solo lectura |
| `devsecops-engineer` | Secretos, dependencias, controles de los agentes | Solo lectura |
| `free-tier-architect` | Planes gratuitos (RNF-10), evidencia para DP-06 | Solo lectura, con web |
| `release-readiness-reviewer` | Go/no-go antes de desplegar | Solo lectura |

### Propios de UraqiVision (solo lectura)

| Subagente | Cuándo usarlo |
|---|---|
| `guardian-alcance` | Antes de aprobar un plan, tareas o una rama: alcance, DP pendientes, trazabilidad |
| `revisor-cientifico` | Al terminar una parte del pipeline o antes de publicar cifras |
| `auditor-publicacion` | Antes de publicar o desplegar una estación |
| `revisor-insight` | Al terminar o cambiar Insight, antes de desplegarlo |
| `revisor-qa` | Antes de marcar una tarea como hecha o integrar una rama |

Cómo invocarlos: en Claude Code, «usa el subagente revisor-qa» o `@agent-revisor-qa`; en opencode,
`@revisor-qa`; en Codex y Gemini, pídelo por su nombre.

## Guardas (hooks)

Una sola lógica (`ai/hooks/lib/guard.mjs`) para las cuatro plataformas. **Bloquean**:

- secretos en comandos, archivos, mensajes y argumentos (claves de Anthropic, OpenAI, Google, GitHub y AWS,
  claves privadas, JWT como los tokens de Earthdata, entradas de `.netrc`);
- leer o escribir `.env*` (salvo `.env.example`), `.netrc`, `*.pem` y `*.key`; escribir en `.git/` o en el PDF
  del documento maestro;
- `git push --force`, `git reset --hard`, `git clean -f`, `--no-verify`, `rm -rf /`, `curl … | sh`,
  `npm publish` e intentos de desactivar permisos.

**Avisan sin bloquear** tras cada edición: JSON o GeoJSON inválido y claves distintas entre `es.json` y
`en.json` (RNF-03). Al iniciar la sesión inyectan un resumen de las reglas clave.

**Flujo de git** (skill `flujo-issues-y-pr`): las guardas de los asistentes bloquean push o merge directo a
`dev`, `qa` y `main` (también `git push` sin destino estando en ellas). Los permisos nativos piden confirmación
para `git push` y `vercel` (Claude y opencode).

## Hooks de git (`.githooks/`, activar con `npm run hooks:activar`)

| Hook | Qué hace |
|---|---|
| `pre-commit` | Bloquea commits en `dev`, `qa` o `main`, archivos o líneas con secretos (RNF-06), archivos `.env*` no permitidos y `.env` ≠ `.env.example` en estructura; si cambia la estructura de una plantilla, **pausa** para comunicarlo (copia el `.env` a Descargas) |
| `prepare-commit-msg` | En ramas `tipo/N-descripcion` agrega `Refs #N` al mensaje |
| `commit-msg` | Bloquea commits sin issue (`#N`) y valida Conventional Commits con commitlint (`commitlint.config.mjs`); detecta commits que mezclan temas (3+ grupos, o 2 grupos con 8+ archivos), muestra la división propuesta y **pregunta** (en terminal `[s/N]`; sin terminal se detiene hasta que la persona decida); avisa si falta un identificador o hay `Co-Authored-By` de IA |
| `pre-push` | Bloquea el push a `dev`, `qa` o `main` y los commits sin issue; avisa si la rama no sigue `tipo/N-descripcion` |
| `post-checkout` | Sube toda rama nueva a origin; si cambió `.env.example`, agrega al `.env` las claves nuevas vacías |
| `post-merge` | Tras un pull o merge, si cambió `.env.example`, agrega al `.env` las claves nuevas vacías y avisa qué pedir |

Requisitos: `npm install` en la raíz (instala commitlint 21.2.4) y `npm run hooks:activar`.

**Dividir commits grandes** (`ai/scripts/dividir-commits.mjs`, reglas en `ai/hooks/lib/commit-groups.mjs`):
`npm run commits:plan` muestra la propuesta sin cambiar nada; `npm run commits:dividir` la muestra y pregunta
(aplicar / editar mensajes / cancelar) antes de crear un commit por tema. Los agentes usan `--json`, preguntan
a la persona y solo entonces aplican con `--aplicar --si`. Un solo commit grande se aprueba con
`URAQI_UN_COMMIT=1` o con la línea `Commit-grande: aprobado` en el mensaje (útil desde el IDE).

## GitHub

- **Ramas y entornos**: `main` = producción (despliegue propio), `qa` = preproducción (despliegue propio y
  separado), `dev` = integración. No existe `master`. Toda rama entra por PR a `dev`, luego PR `dev → qa` y
  PR `qa → main`. El proveedor de los despliegues depende de DP-06.
- Workflow `.github/workflows/trazabilidad.yml`, en **toda** PR a `dev`, `qa` o `main`, sin excepciones:
  cada commit cita su issue; cada issue citado aparece en la descripción de la PR; las PR a `dev` cierran al
  menos un issue; a `qa` solo se llega desde `dev` y a `main` solo desde `qa`; formato con commitlint.
- `node ai/scripts/issues-de-promocion.mjs dev qa` (o `qa main`) genera la lista `Refs #N` de una promoción.
- **Aprobaciones** (`.github/workflows/aprobaciones.yml`, reglas en `ai/hooks/lib/aprobaciones.mjs`): hacia
  `dev` el autor puede fusionar su propia PR tras confirmar; hacia `qa` y `main` deben aprobar todos los
  colaboradores excepto el autor, sobre el último commit. Al abrir la PR pide revisión a quienes faltan.
- **Estado de issues** (`.github/workflows/estado-issues.yml`, reglas en `ai/hooks/lib/estado-issues.mjs`):
  PR en borrador → `en progreso`; lista → `en revisión`; aceptada en `dev` → `en dev` y se cierra; fusionada
  en `qa`/`main` con aprobación completa → `en preproducción`/`en producción` y se cierra su issue de promoción
  (creado al abrir la PR). Sin aprobación completa no cambia ningún estado. Simular: `npm run issues:estado -- --pr N --simular`.
- **Buenas prácticas de PR** (`.github/workflows/buenas-practicas-pr.yml`, reglas en
  `ai/hooks/lib/buenas-practicas-pr.mjs`): título, rama, descripción, referencias, conflictos, secretos, archivos
  generados y pruebas; etiquetas de tipo y tamaño, autor asignado y comentario de resumen. Las ramas **nunca** se
  borran al fusionar: son parte de la trazabilidad. Simular: `node ai/scripts/buenas-practicas-pr.mjs --pr N --simular`.
- **Ramas**: toda rama nueva se sube sola (hook `post-checkout`); las guardas impiden a los asistentes borrar ramas
  locales o remotas. Solo una persona decide borrar una rama, si crea confusión o su código ya no sirve.
- **Entorno** (`ai/scripts/entorno.mjs`, reglas en `ai/hooks/lib/entorno.mjs`): solo `.env` (local) y
  `.env.example` (versionado, misma estructura, claves sensibles vacías); otros `.env.<x>` solo si son
  imprescindibles, declarados en `package.json` → `uraqi.envPermitidos` con su `.example`.
  - `npm run env:check` revisa archivos y estructura; `npm run env:sync` crea o alinea el `.env` sin leer ni
    mostrar valores (es la forma en que los asistentes lo generan); `npm run env:compartir` copia el `.env` a
    Descargas para compartirlo.
  - Si un commit cambia la estructura de una plantilla: **pausa** obligatoria para comunicarlo al equipo (el
    `.env` se copia a Descargas); tras comunicarlo, `URAQI_ENV_COMUNICADO=1 git commit …`.
  - Workflow `Entorno`: en la PR menciona a los colaboradores con las claves nuevas y eliminadas. Al hacer pull
    o cambiar de rama (hooks `post-merge` y `post-checkout`), el `.env` local recibe las claves nuevas vacías.
- **Issue a PR** (`.github/workflows/issue-a-pr.yml`, `ai/scripts/issue-a-pr.mjs`): al crear un issue de trabajo
  crea la rama `tipo/N-titulo` desde `dev` y una PR en borrador hacia `dev` con `Closes #N`.
- **Protección de issues** (`.github/workflows/proteger-issues.yml`, `ai/scripts/proteger-issues.mjs`): revierte
  etiquetas `estado:` manuales, cierres sin aprobación o con PR en curso y reaperturas de issues aceptados.
- Los workflows de eventos de issues corren desde `main`, y `Issue a PR` requiere activar en Settings → Actions →
  General «Allow GitHub Actions to create and approve pull requests».
- **Revisar desde el asistente o la terminal** (`ai/scripts/prs.mjs`): `npm run pr:pendientes`,
  `npm run pr:estado -- N`, `npm run pr:aprobar -- N`, `npm run pr:fusionar -- N` (merge commit). Aprobar y
  fusionar siempre piden confirmación; Claude y opencode además piden permiso antes de ejecutarlos.
- **Aviso automático**: el hook de inicio de sesión y, cada 10 minutos, el de cada mensaje consultan GitHub
  (con `gh`) y avisan al asistente de PR nuevas por aprobar o propias listas para fusionar. Caché en
  `.git/uraqi-prs.json`; sin red o sin `gh` no hacen nada.
- Plantillas de issue (`tarea`, `defecto`) con identificadores del documento, módulo y prioridad, y plantilla de PR
  con `Closes #`, verificación y checklist.

## Servidores MCP

| Servidor | Uso | Efectos |
|---|---|---|
| `context7` (`@upstash/context7-mcp@4.4.4`) | Documentación vigente de CesiumJS, MapLibre, react-i18next, rasterio… | No |
| `qa-evidence` (propio, `ai/qa/mcp-servers/`) | 9 herramientas: resultados JUnit, cobertura, esquemas JSON, quality gates, informe de evidencias | No |
| `devops-readiness` (propio, `ai/devops/mcp-servers/`) | 11 herramientas: stack, secretos por nombre, `.env.example`, planes gratuitos, preparación del despliegue, política de aprobación | No |

### Scripts de apoyo

`ai/qa/scripts/` (risk-matrix, design-cases, quality-gate, contract-diff, regression-select, defect-report,
flaky-detect, security-baseline, scan-secrets, report-build, stack-inspect) y `ai/devops/scripts/` (secret-scan,
env-check, dependency-audit, free-tier-check, detect-stack, deploy-readiness, check-approval-policy). Son Node
sin dependencias; los ejemplos de cada skill usan los fixtures de `ai/qa/tests/fixtures/`. `check-approval-policy`
está adaptado a las guardas de `ai/hooks/`. `secret-scan` marca un token falso a propósito en
`ai/qa/tests/fixtures/sample-project` (es un fixture de prueba).

## Añadir algo

- **Skill**: crea `.agents/skills/<nombre>/SKILL.md` con `name` y `description` en el frontmatter y ejecuta el sync.
- **Subagente**: crea `ai/agents/<nombre>.md` (frontmatter `name`, `description`, `skills`, `mcp`, `color`) y ejecuta el sync.
- **MCP**: añádelo a `ai/mcp/servers.json` y a `SERVERS` en `ai/mcp/launch.mjs` con versión fijada; ejecuta el sync.
- **Regla de guarda**: edítala en `ai/hooks/lib/guard.mjs`, añade su prueba y ejecuta las pruebas.

## Procedencia

Estructura y patrones tomados de tres repositorios: **chapterCoreIEEE** (fuente única con sync multiplataforma,
guardas compartidas, subagentes revisores de solo lectura, lanzador de MCP sin shell, skill de accesibilidad,
`verification-before-completion`), **sdd-horario-productividad** (constitución y prompts de Spec Kit en orden)
y **MichiCode** (puntos de control con aprobación antes de modificar).
