# Herramientas de IA de UraqiVision · backend (ayuda)

Instalación, funcionamiento y ejemplos de las herramientas de este repositorio, con el catálogo de cada skill,
subagente, servidor MCP, hook, guarda, workflow y script, y el SDD con Spec Kit.

**El repositorio**: pipeline en Python (ingesta, ciencia, validación y publicación de estaciones) y función Insight de
**UraqiVision**, la web bilingüe que traduce datos del radar NISAR en mapas, cifras e historias (NASA Space Apps
2026, *Dancing with the SARs*). La web vive en [`UraqiVision`](https://github.com/marianZamorano/UraqiVision) y
consume lo que este repositorio publica: los archivos de cada estación (§17.3) y `POST /api/insight` (§21.1).

- Reglas del proyecto para personas y asistentes de IA: [`AGENTS.md`](../AGENTS.md).
- Fuente de verdad: [`docs/UraqiVisionDocumentoMaestrov1.0.pdf`](../docs/UraqiVisionDocumentoMaestrov1.0.pdf)
  (copia para buscar: `docs/UraqiVisionDocumentoMaestrov1.0.txt`).

> **Esta ayuda está siempre al día**: `ai/sync.mjs` genera este archivo a partir de
> `ai/docs/README.plantilla.md` y de las fuentes de cada skill, subagente, servidor MCP, hook, workflow y script.
> Desde la terminal: `npm run ayuda` (índice) o `npm run ayuda -- <tema>`. Desde un asistente: skill `ayuda`.

## En resumen

<!-- @@resumen -->

## Instalación (primera vez)

1. **Requisitos**: git, Node 20 o superior (los hooks, el sync y los servidores MCP propios son Node sin
   dependencias; el CI usa Node 22) y, opcional pero recomendado, [GitHub CLI](https://cli.github.com/) (`gh`)
   con sesión iniciada para issues, PR y avisos de aprobación. El pipeline en Python tendrá sus propias
   dependencias cuando exista (§18).
2. **Clona y prepara el repositorio** (desde la raíz):

   ```bash
   git clone https://github.com/marianZamorano/UraqiVisionBack.git
   cd UraqiVisionBack
   npm install                 # instala commitlint (validación de los mensajes de commit)
   npm run hooks:activar       # activa los hooks de git de .githooks/
   npm run env:sync            # crea tu .env desde .env.example sin mostrar valores
   npm run env:check           # revisa que la estructura coincida
   ```

3. **Comprueba que todo está bien**:

   ```bash
   npm run ai:check            # archivos generados y esta ayuda al día
   npm run test:guardas        # pruebas de las guardas y automatizaciones
   ```

4. **Abre tu asistente desde la raíz del repositorio**:
   - **Claude Code**: acepta los servidores de `.mcp.json` la primera vez; skills con `/nombre`.
   - **Codex CLI**: marca el proyecto como de confianza y revisa los hooks con `/hooks`; skills con `$nombre`.
   - **Gemini CLI**: lee `AGENTS.md` gracias a `.gemini/settings.json`; Spec Kit con `/speckit.*`.
   - **opencode**: carga `opencode.json` y el plugin de guardas solo; subagentes con `@nombre`.
5. **Opcional**: `CONTEXT7_API_KEY` en tu entorno para subir el límite de uso del MCP `context7`. Las
   credenciales de Earthdata van en tu `.netrc`, nunca en el repositorio (RNF-06).

## Cómo funciona

### Una sola fuente para cuatro asistentes

Todo se define una vez y `npm run ai:sync` lo genera para Claude Code, Gemini CLI, Codex CLI y opencode:

| Se edita a mano (fuente) | Se genera con `npm run ai:sync` |
|---|---|
| `.agents/skills/` (una carpeta por skill con su `SKILL.md`) | `.claude/skills/` (Gemini, Codex y opencode leen `.agents/skills/` directamente) |
| `ai/agents/` (un `.md` por subagente) | `.claude/agents/`, `.gemini/agents/`, `.codex/agents/`, `.opencode/agents/` |
| `ai/hooks/` | `.claude/settings.json`, `.gemini/settings.json`, `.codex/hooks.json`, `.opencode/plugins/uraqi-guardas.js` |
| `ai/mcp/servers.json` (versiones en `ai/mcp/launch.mjs`) | `.mcp.json`, `.gemini/settings.json`, `.codex/config.toml`, `opencode.json` |
| `ai/docs/README.plantilla.md` + todas las fuentes anteriores | `ai/README.md` (esta ayuda) |

Los archivos generados llevan la marca «Generado por ai/sync.mjs»: si los editas a mano, el siguiente sync los
pisa. Tu configuración personal de Claude va en .claude/settings.local.json (ignorado por git). Las skills
`speckit-*` las instala y actualiza `specify` (Spec Kit), no el sync.

### Flujo de trabajo

Issue → rama `tipo/N-descripcion` desde `dev` → commits `tipo(alcance): descripción #N` → PR a `dev` con
`Closes #N` → promoción `dev → qa` (preproducción) → `qa → main` (producción). Nunca se hace commit, push ni
merge directo en `dev`, `qa` o `main`, y las ramas nunca se borran. Hacia `dev` el autor fusiona su propia PR;
hacia `qa` y `main` aprueban todos los colaboradores menos el autor. Detalle: skill `flujo-issues-y-pr` y
`AGENTS.md` §6.

Tres capas lo vigilan: las **guardas** de los asistentes (antes de cada herramienta), los **hooks de git** (en
tu máquina) y los **workflows de GitHub** (en cada PR). Están todos descritos más abajo.

### El coordinador `vibecodear`

Engineering Manager técnico: diagnostica el proyecto frente al documento maestro, activa solo los roles
necesarios y, para cada uno, sabe qué skills cargar, qué subagentes usar y quién es responsable
(`.agents/skills/vibecodear/references/roles.md`). Trabaja por Sprints con puntos de control y los documenta
en la carpeta .vibecodear/sprints/.

## Ejemplos de ejecución

```bash
# Ayuda
npm run ayuda                       # índice de esta ayuda
npm run ayuda -- hooks              # secciones sobre un tema (skills, mcp, sdd, guardas, scripts…)

# Trabajo diario
gh issue create                     # 1. issue (plantillas Tarea y Defecto)
git switch -c feat/12-deslizador    # 2. rama desde dev (se sube sola a origin)
git commit -m "feat(publicacion): vistas webp por fecha (RF-27) #12"
npm run commits:plan                # muchos cambios: propuesta de commits por tema, sin tocar nada
npm run commits:dividir             # la aplica tras preguntar
gh pr create --base dev --fill      # 3. PR a dev con "Closes #12"
npm run pr:pendientes               # PR que esperan tu aprobación o están listas
npm run pr:estado -- 12             # checks y aprobaciones de la PR 12
npm run pr:fusionar -- 12           # fusiona con merge commit (pide confirmación)
node ai/scripts/issues-de-promocion.mjs dev qa   # lista "Refs #N" de una promoción

# Herramientas de IA
npm run ai:sync                     # regenera configuraciones y esta ayuda tras editar una fuente
npm run ai:check                    # falla si algo quedó desactualizado
npm run test:guardas                # pruebas de guardas, flujo y README
node .agents/skills/microauditoria/scripts/evidencia.mjs --dias 7   # evidencia de los últimos cambios

# Variables de entorno (nunca se leen ni se muestran valores)
npm run env:check
npm run env:sync
npm run env:compartir               # copia tu .env a Descargas para compartirlo con el equipo
```

Desde un asistente (Claude Code; en Codex usa `$nombre`, en opencode `@nombre` para subagentes):

```text
/ayuda ¿cómo instalo el proyecto?
/microauditoria ponme al día de la última semana
/sdd-uraqivision estado
/speckit-specify <descripción de la feature>
usa el subagente revisor-cientifico para revisar ai/… antes de publicar
```

## Skills

Instrucciones empaquetadas que el asistente carga cuando la tarea coincide con su descripción, o cuando la
persona las pide (`/nombre` en Claude Code, `$nombre` en Codex CLI). Fuente: `.agents/skills/`.

<!-- @@skills -->

## SDD: Spec-Driven Development con Spec Kit

Primero la especificación, después el código. El documento maestro ya es una especificación aprobada: el SDD la
**descompone** en specs pequeñas (`specs/NNN-nombre/`) con su plan y sus tareas. La skill `sdd-uraqivision`
guía las fases y dice cuál sigue (`/sdd-uraqivision estado`):

| Fase | Qué se hace | Skill de Spec Kit |
|---|---|---|
| 0 | Contexto: leer el documento maestro (skill `documento-maestro`) | — |
| 1 | Constitución: principios derivados del documento | `speckit-constitution` |
| 2 | Spec de una feature, con sus identificadores RF/RNF/RN | `speckit-specify` |
| 3 | Aclarar lo ambiguo | `speckit-clarify` |
| 4 | Plan técnico (aquí sí se nombran librerías) | `speckit-plan` |
| 5 | Tareas ordenadas, y opcionalmente issues | `speckit-tasks`, `speckit-taskstoissues` |
| 6 | Análisis cruzado antes de implementar | `speckit-analyze` |
| 7 | Implementar con TDD | `speckit-implement` |
| 8 | Verificar y cerrar brechas | `speckit-converge`, `speckit-checklist` |

Estado actual:

<!-- @@sdd-estado -->

Skills de Spec Kit instaladas:

<!-- @@speckit -->

## Subagentes

Asistentes especializados con su propio contexto. Los de solo lectura revisan y reportan; los que escriben lo
hacen solo con aprobación. Cómo invocarlos: en Claude Code, «usa el subagente revisor-qa»; en opencode,
`@revisor-qa`; en Codex y Gemini, pídelo por su nombre. Fuente: `ai/agents/`.

<!-- @@subagentes -->

## Servidores MCP

Herramientas externas que los asistentes pueden llamar. Las versiones de npm están fijadas en
`ai/mcp/launch.mjs`; los servidores propios son de solo lectura. Fuente: `ai/mcp/servers.json`.

<!-- @@mcp -->

Scripts de apoyo (Node sin dependencias, los usan las skills de QA y DevSecOps): `ai/qa/scripts/` y
`ai/devops/scripts/`.

## Hooks

### De los asistentes de IA

Se ejecutan en cada sesión, mensaje o herramienta del asistente. Una sola lógica para las cuatro plataformas.

<!-- @@hooks-asistentes -->

### Guardas

Reglas que bloquean (o avisan) antes de que el asistente actúe. Los mensajes llevan la marca
`[uraqi-guard:<regla>]`. La lógica común está en `ai/hooks/lib/guard.mjs`.

<!-- @@guardas -->

### De git

Se activan con `npm run hooks:activar` y corren en tu máquina en cada commit, push, checkout o pull.

<!-- @@githooks -->

## Automatización en GitHub

Workflows que corren en GitHub. Los de eventos de issues (crear rama y PR, proteger estados) se ejecutan
desde la rama por defecto (`main`): hasta que los workflows lleguen a `main` por promoción, no corren.

<!-- @@workflows -->

## Scripts npm

<!-- @@scripts -->

## Cómo se mantiene al día esta ayuda

- **Generada, no escrita a mano**: `npm run ai:sync` arma este README desde `ai/docs/README.plantilla.md` y las
  fuentes. Una skill, un subagente, un servidor MCP, un hook, un workflow o un script nuevos aparecen solos.
- **Validada**: el sync falla si la plantilla cita un `npm run`, un `node ai/…` o una ruta que no existen, o si
  un script de `package.json` no tiene su descripción en `uraqi.scripts`.
- **Hook pre-commit**: si el commit toca una fuente y la ayuda o los generados quedaron viejos, lo bloquea
  (`[uraqi-guard:ayuda-desactualizada]`) y pide `npm run ai:sync`. Si ya están regenerados pero sin agregar,
  avisa (así se pueden dividir los commits por tema).
- **Hook pre-push**: bloquea el push mientras queden archivos generados sin commitear.
- **Hook de los asistentes tras editar** (`ai/hooks/post-edit.mjs`): avisa al asistente si edita este README a
  mano, porque el siguiente sync lo pisa.
- **CI**: el workflow Buenas prácticas de PR ejecuta `node ai/sync.mjs --check` en cada PR; las pruebas de
  `npm run test:guardas` comprueban el generador.

## Añadir algo

- **Skill**: crea `.agents/skills/<nombre>/SKILL.md` con `name` y `description` en el frontmatter (la
  descripción dice para qué sirve y, desde «Usar…», cuándo usarla) y ejecuta `npm run ai:sync`.
- **Subagente**: crea `ai/agents/<nombre>.md` (frontmatter `name`, `description`, `skills`, `mcp`, `access`,
  `web`, `color`) y ejecuta el sync.
- **Servidor MCP**: añádelo a `ai/mcp/servers.json` y, si es de npm, a `SERVERS` en `ai/mcp/launch.mjs` con
  versión fijada; ejecuta el sync.
- **Regla de guarda**: edítala en `ai/hooks/lib/guard.mjs`, añade su prueba y ejecuta `npm run test:guardas`.
- **Script npm**: agrégalo a `scripts` y su descripción a `uraqi.scripts` en `package.json`.
- **Texto de esta ayuda**: edita `ai/docs/README.plantilla.md` (nunca `ai/README.md`) y ejecuta el sync.

## Procedencia

Estructura y patrones tomados de **chapterCoreIEEE** (fuente única con sync multiplataforma, guardas
compartidas, subagentes revisores de solo lectura, lanzador de MCP sin shell, skills de QA y DevSecOps),
**sdd-horario-productividad** (constitución y prompts de Spec Kit en orden), **MichiCode** (puntos de control con
aprobación antes de modificar) y **obra/superpowers** (MIT: `test-driven-development`, `systematic-debugging`,
`verification-before-completion`).
