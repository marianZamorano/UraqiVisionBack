<!-- Generado por ai/sync.mjs desde ai/docs/README.plantilla.md y las fuentes (skills, subagentes, MCP, hooks, workflows y package.json). No lo edites a mano: edita la plantilla o la fuente y ejecuta `npm run ai:sync`. -->

# Herramientas de IA de UraqiVision · backend (ayuda)

Instalación, funcionamiento y ejemplos de las herramientas de este repositorio, con el catálogo de cada skill,
subagente, servidor MCP, hook, guarda, workflow y script, y el SDD con Spec Kit.

**El repositorio**: pipeline en Python (ingesta, ciencia, validación y publicación de estaciones) y función Insight de
**UraqiVision**, la web bilingüe que traduce datos del radar NISAR en mapas, cifras e historias (NASA Space Apps
2026, *Dancing with the SARs*). La web vive en [`UraqiVision`](https://github.com/marianZamorano/UraqiVision) y
consume lo que este repositorio publica: los archivos de cada estación (§17.3) y `POST /api/insight` (§21.1).

- Reglas del proyecto para personas y asistentes de IA: [`AGENTS.md`](../AGENTS.md).
- Fuente de verdad: [`docs/UraqiVisionDocumentoMaestrov1.1.pdf`](../docs/UraqiVisionDocumentoMaestrov1.1.pdf)
  (copia para buscar: `docs/UraqiVisionDocumentoMaestrov1.1.txt`).

> **Esta ayuda está siempre al día**: `ai/sync.mjs` genera este archivo a partir de
> `ai/docs/README.plantilla.md` y de las fuentes de cada skill, subagente, servidor MCP, hook, workflow y script.
> Desde la terminal: `npm run ayuda` (índice) o `npm run ayuda -- <tema>`. Desde un asistente: skill `ayuda`.

## En resumen

| Pieza | Cantidad | Fuente |
|---|---|---|
| Skills propias | 36 | `.agents/skills/` |
| Skills de Spec Kit (SDD) | 10 | `.agents/skills/speckit-*` |
| Subagentes | 13 | `ai/agents/` |
| Servidores MCP | 3 | `ai/mcp/servers.json` |
| Hooks de los asistentes | 5 | `ai/hooks/*.mjs` |
| Reglas de las guardas | 34 | `ai/hooks/lib/` |
| Hooks de git | 6 | `.githooks/` |
| Workflows de GitHub | 9 | `.github/workflows/` |
| Scripts npm | 36 | `package.json` |

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
npm run ai:verificar                # ¿funcionan y están activas todas las herramientas?
npm run ai:activar                  # guía paso a paso para activar lo que falte
npm run ai:cambios                  # qué herramientas cambian frente a origin/dev y si son coherentes
npm run codigo:revisar              # código roto, muerto o desconectado + CI/CD por rama, con plan
npm run codigo:cicd                 # solo el estado del CI/CD de dev, qa y main
npm run referencias:para -- MC-03   # referencias de §31 que aplican a un requisito
npm run referencias:revisar         # ¿la implementación cita sus referencias?

# SDD: orden de prompts e historial
npm run sdd:estado                  # avance por área, conflictos y tu siguiente prompt
npm run sdd:siguiente -- --yo       # tu siguiente prompt, listo para copiar y pegar
npm run sdd:historial               # decisiones y resultados de cada prompt

# Equipo (§19): quién eres y qué te corresponde
npm run equipo:modulos              # módulos, responsables, apoyo y revisores
npm run equipo:soy -- Marian        # registra quién eres en este clon (vibecodear lo pregunta)
npm run equipo:alcance -- RF-05     # ¿es tuyo o apoyas el rol de otra persona?
uv run --with pypdf python ai/scripts/extraer_documento.py   # regenera la copia .txt del documento maestro
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

| Skill | Para qué | Cuándo usarla | Archivos de apoyo |
|---|---|---|---|
| `ayuda` | Ayuda de UraqiVision que explica cómo se instala y cómo funciona el repositorio, con ejemplos de ejecución, a partir de ai/README.md (generado por ai/sync.mjs y siempre al día). Cubre cada skill, subagente, servidor MCP, hook, guarda, workflow y script npm, y el SDD con Spec Kit. | Usar cuando se pida «ayuda», «help», «cómo se instala», «cómo funciona», «cómo uso…», «qué skills, subagentes, MCP o hooks hay», «para qué sirve…», «dame un ejemplo de…» o «qué comando…», o cuando alguien empieza en el proyecto. | — |
| `ciencia-radar-nisar` | Reglas científicas para el pipeline de UraqiVision con NISAR L2 GCOV en banda L (HH, HV), métodos MC-01 a MC-09, controles de calidad CQ-01 a CQ-06 y validación VC-01 a VC-05. | Usar al escribir o revisar código Python de ingesta, línea base, cociente de HV, parches, fenología, clases de parche, hectáreas o validación con Sentinel-2 y FIRMS. | — |
| `codigo-vivo` | Revisor de código vivo de UraqiVision que detecta código que no funciona o que no está conectado aunque dé la impresión de funcionar (imports rotos, paquetes sin declarar, referencias a archivos inexistentes, código muerto o que solo usan las pruebas, trabajo sin terminar, datos simulados, pruebas desactivadas), da un plan de solución, revisa que cada rama tenga su CI/CD (conflictos, código vivo, pruebas, build y arranque) y comprueba que el proyecto vuelva a levantar. | Usar al pedir una PR hacia qa o main (promoción), cuando se pregunte «hay código muerto», «esto está conectado», «funciona de verdad», «está listo el CI/CD», antes de dar por terminada una funcionalidad o al implementar el CI/CD. | — |
| `devops-dependency-security` | Evalúa la seguridad de la cadena de suministro de dependencias — vulnerabilidades conocidas (npm audit), lockfiles reproducibles, scripts de instalación, versiones fijadas, paquetes abandonados o typosquatting — y propone actualizaciones mínimas verificadas. Úsala antes de releases, al añadir dependencias o tras avisos de seguridad. | Solo la invoca la persona (`/devops-dependency-security [ruta-del-paquete]`). | — |
| `devops-free-tier-audit` | Evalúa si una arquitectura puede ejecutarse con planes gratuitos reales (Vercel Hobby, Neon, Supabase, GitHub Actions u otros), compara consumo previsto o real con las cuotas documentadas, detecta riesgos de cargos, suspensión o uso comercial prohibido y propone alternativas gratuitas compatibles. Úsala antes de elegir proveedores o cuando el consumo se acerque a los límites. | Solo la invoca la persona (`/devops-free-tier-audit [proveedor\|all] [archivo-de-consumo.json]`). | — |
| `devops-git-workflow` | Aplica un flujo Git seguro para trabajo DevOps — inspección del estado, ramas de trabajo derivadas de la rama correcta, commits atómicos y descriptivos, preview por rama, protección de la rama de producción y push sin force — preservando siempre el trabajo ajeno. Úsala al empezar una tarea, antes de commitear o al preparar un PR. | Solo la invoca la persona (`/devops-git-workflow [start <rama>\|commit\|pr]`). | — |
| `devops-release-readiness` | Decide con evidencia si un cambio está listo para desplegarse — Git limpio, build/lint/typecheck/tests en verde, configuración y secretos auditados, variables por entorno, dependencias, plan de rollback y verificación posterior — y emite un veredicto NOT_READY / CONFIG_PREPARED / BUILD_VERIFIED. Úsala antes de la PR dev → qa (preproducción) y de la PR qa → main (producción). | Solo la invoca la persona (`/devops-release-readiness [ruta-app] [preproduccion\|produccion]`). | — |
| `devops-secrets-management` | Detecta secretos expuestos, define dónde debe vivir cada secreto (variables del proveedor por entorno, secretos de CI, gestores de secretos), valida variables requeridas sin mostrar valores y guía la rotación tras una filtración. Úsala antes de commits/despliegues, al añadir integraciones o ante una sospecha de exposición. | Solo la invoca la persona (`/devops-secrets-management [scan\|plan\|rotate] [ruta]`). | — |
| `devops-supervised-execution` | Protocolo obligatorio de supervisión humana para ejecutar herramientas, skills o agentes DevOps sobre un proyecto — inspección de solo lectura, plan con alcance/archivos/comandos/sistemas externos/riesgos, aprobación explícita y acotada por operación, ejecución limitada a lo aprobado, verificación con evidencias y parada si cambia el alcance. Úsala al inicio de cualquier operación DevOps con efectos. | Solo la invoca la persona (`/devops-supervised-execution [objetivo de la operación]`). | — |
| `documento-maestro` | Navega el documento maestro de UraqiVision (fuente de verdad) para encontrar requisitos y reglas por identificador (RF, RNF, MC, RN, CQ, VC, PS, CU, HU, DP), comprobar si una función está en el alcance del MVP y clasificar una afirmación como hecho, propuesta, hipótesis o pendiente. | Usar antes de diseñar o implementar algo, cuando se cite un identificador o cuando haya dudas de alcance. | — |
| `entrega-hackathon` | Seguimiento del plan del hackathon de UraqiVision (§25), checklist de la demo de 7 láminas (§26) y de la entrega en NASA Space Apps 2026, incluida la declaración de uso de IA y las decisiones pendientes DP-01 y DP-02. | Usar para saber cómo va el equipo frente al plan, preparar la demo o revisar la entrega antes de enviarla. | — |
| `flujo-issues-y-pr` | Flujo obligatorio de trabajo con git en UraqiVision, que cubre issue, rama tipo/N-descripcion desde dev, commits en formato Conventional Commits que citan su issue, push de la rama, PR a dev con Closes #N y promoción dev → qa → main por PR. | Usar SIEMPRE antes de hacer un commit, un push, una rama o una PR, y al convertir tareas de Spec Kit en issues. | — |
| `ingesta-nisar-asf` | Procedimiento de ingesta de NISAR L2 GCOV para UraqiVision (M-INGESTA, MC-01, RF-26, CQ-02, CQ-06). Cubre buscar gránulos con asf_search o earthaccess, autenticarse con Earthdata Login sin exponer credenciales, recortar HHHH y HVHV desde la nube con GDAL ≥ 3.13, guardar COG sin pérdida, registrar el manifiesto con CRID y sumas de verificación y generar las huellas de escenas. | Usar al buscar, descargar o recortar escenas NISAR, o al escribir el código de ingesta. | — |
| `insight-lector-radar` | Reglas para Insight, el lector de radar bilingüe de UraqiVision (RF-16 a RF-18, RN-09, RN-10, RN-14, RNF-06, RNF-07). Contrato POST /api/insight, adaptador de proveedor, prompt acotado a la estación abierta, citas, plantillas de respaldo, límites de uso y seguridad de la clave. | Usar al implementar, probar o revisar la función Insight o su interfaz. | — |
| `microauditoria` | Microauditoría de UraqiVision que explica las últimas decisiones del equipo y los últimos cambios de código con evidencia (commits, PR, issues, AGENTS.md, specs y documento maestro), comprueba trazabilidad, archivos generados, referencias colgantes y pruebas, y señala qué afecta al otro repositorio (backend UraqiVisionBack o frontend UraqiVision). Solo lectura. | Usar cuando se pida «qué se decidió», «qué cambió últimamente», «ponme al día», «microauditoría», «auditoría rápida», al retomar el trabajo, antes de una promoción dev → qa o después de fusionar varias PR. | `scripts/` |
| `notebook-reproducible` | Cómo construir el notebook reproducible de UraqiVision, que regenera los resultados de una estación desde manifest.json con el pipeline, registra la revisión visual (VC-05) y produce las figuras de control (OE6, RNF-08, §8.1). | Usar al crear o revisar el notebook, al preparar la reproducibilidad para la entrega o al documentar decisiones de umbrales. | — |
| `publicacion-estacion` | Contrato de la carpeta publicada de una estación de UraqiVision (station.json, manifest.json, change.tif, vistas, scars.geojson, hectares.csv, validation.json, quality.json, footprints.geojson) y reglas de almacenamiento sin pérdida, peso y textos bilingües. | Usar al generar, modificar o revisar archivos publicados o el código que los produce o los lee. | — |
| `python-geoespacial` | Prácticas de código Python geoespacial para el pipeline de UraqiVision con rasterio, xarray, rioxarray, NumPy, SciPy y GeoPandas, incluidos COG float32 sin pérdida, CRS y grilla, manejo de sin dato con NaN, conversión lineal a dB, área de píxel en UTM y pruebas pytest con rásters sintéticos (MC-01 a MC-07, RNF-09, PS-01, PS-02). | Usar al escribir o revisar código Python del pipeline o sus pruebas. | — |
| `qa-automation` | Diseña, implementa y mantiene automatización de pruebas (unitarias, integración, API, E2E/UI y headless) con el framework del proyecto, incluyendo estructura de suites, fixtures y mocks, page objects, estabilidad y detección de pruebas flaky. | Usar cuando se pida automatizar pruebas, crear o refactorizar una suite, configurar Jest/Vitest/Playwright/Cypress/pytest/JUnit o investigar pruebas inestables. | `references/` |
| `qa-defect-analysis` | Reproduce, diagnostica y documenta defectos - aísla el fallo, analiza logs y trazas, identifica la causa raíz con método sistemático, clasifica severidad/prioridad y redacta reportes de defecto con pasos, evidencia redactada, hechos e hipótesis separados. | Usar cuando una prueba falla, se reporta un bug, hay un comportamiento inesperado o se pide un reporte de defecto o análisis de logs. | `templates/` |
| `qa-project-discovery` | Descubre el contexto de QA de un proyecto (lenguajes, frameworks, dependencias, pruebas existentes, contratos de API, CI/CD, bases de datos, mensajería, autenticación) con evidencias y distinguiendo lo implementado de lo planificado. | Usar al empezar a trabajar en QA sobre un repositorio, cuando se pida "analiza el proyecto", "qué stack tiene", "qué pruebas existen" o antes de definir una estrategia. | — |
| `qa-quality-gates` | Define y evalúa quality gates objetivos (pruebas sin fallos, tasa de éxito, cobertura, latencia p95, tasa de error, cambios incompatibles de contrato, secretos) para uso local y en pipelines CI/CD, fallando cuando falta evidencia. | Usar cuando se pida configurar quality gates, criterios de salida, controles de calidad en CI, o decidir si un cambio está listo para merge o release. | `templates/` |
| `qa-regression-analysis` | Selecciona las pruebas de regresión según el impacto de los cambios (git diff entre ramas o commits, archivos modificados) con un mapa área→rutas→suites, prioriza por riesgo y detecta cuándo se necesita regresión completa. | Usar al revisar un PR o una rama, preparar una release, o cuando se pregunte qué pruebas ejecutar tras un cambio. | `templates/` |
| `qa-security-testing` | Realiza pruebas de seguridad DEFENSIVAS dentro de un alcance autorizado - baseline estático de patrones inseguros (CWE), detección de secretos, revisión de autenticación/autorización, validación de entradas, cabeceras, dependencias vulnerables y checklist OWASP Top 10 / API Top 10. | Usar cuando se pida revisar la seguridad de una aplicación o API, buscar secretos o vulnerabilidades, o validar controles de acceso. | `references/` |
| `qa-test-design` | Diseña casos de prueba con técnicas de caja negra - particiones de equivalencia, valores límite, tablas de decisión, pairwise y transición de estados - incluyendo datos de prueba y criterios de aceptación Given/When/Then. | Usar cuando se pidan casos de prueba, escenarios, datos de prueba o criterios de aceptación para una funcionalidad, formulario, endpoint o regla de negocio. | `templates/` |
| `qa-test-reporting` | Genera informes de pruebas basados en evidencia - resultados de ejecución (JUnit, Jest/Vitest), rendimiento (k6), quality gates, métricas, defectos y pruebas no ejecutadas - separando hechos verificados, hipótesis y recomendaciones, sin afirmar éxitos no demostrados. | Usar cuando se pida un informe, resumen de resultados, estado de calidad, métricas de pruebas o evidencias para una release. | — |
| `qa-test-strategy` | Define la estrategia de pruebas de un proyecto o funcionalidad - alcance, niveles (unitario, integración, sistema, aceptación, E2E), tipos funcionales y no funcionales, análisis de riesgos con matriz probabilidad×impacto, priorización, entornos, datos, criterios de entrada/salida y trazabilidad. | Usar cuando se pida una estrategia o plan de pruebas, priorizar qué probar o evaluar riesgos de calidad. | `templates/` |
| `referencias-documento` | Especialista en las referencias de §31 del documento maestro de UraqiVision (guías de NISAR y ASF, GDAL, CesiumJS, artículos científicos como Belenguer-Plomer et al. 2019, fuentes bolivianas como ABT, SENAMHI, FAN y MapBiomas, y noticias). Sabe qué enlace respalda cada requisito, método, módulo y skill, dónde las cita el documento y cómo deben notarse en el código, las specs, las fichas, la página de método y Acerca de, y verifica que la implementación las tenga en cuenta sin inventar referencias. | Usar al implementar o revisar algo que se apoya en una fuente, al redactar método, Acerca de, fichas o hipótesis, al citar datos, cuando se pregunte «qué referencia uso para…», «de dónde sale…» o «está bien citado…», o antes de una promoción. | — |
| `rigor-y-fuentes` | Reglas de rigor para los contenidos de UraqiVision (fichas del atlas, hipótesis, relato local, página de método, Acerca de, láminas y textos de Insight). Fuentes con fecha de consulta, citas APA 7, cita de datos NISAR y FIRMS, hechos frente a hipótesis, sin cifras ni referencias inventadas y sin marcas de la NASA en contenido generado con IA. | Usar al redactar o revisar cualquier texto con datos, cifras, fuentes o referencias. | — |
| `sdd-prompts` | Ejecuta los prompts del SDD por área de UraqiVision (sdd/*.md) uno a uno, confirmando antes con la persona que va a ejecutarlo (opción múltiple: ejecutar tal cual, modificar o posponer), comprobando que le corresponde según §19, registrando cada decisión y resultado en el historial (sdd/historial/) y entregando al final el siguiente prompt listo para copiar y pegar. También detecta cambios y conflictos entre prompts. | Usar cuando un mensaje traiga «[SDD P-…]», cuando se pida «siguiente prompt», «qué sigue en el SDD», «estado del SDD», «historial de prompts», o al cambiar un prompt del SDD. | — |
| `sdd-uraqivision` | Guía el Spec-Driven Development de UraqiVision con Spec Kit, del documento maestro a la constitución, las specs por módulo, el plan, las tareas, la implementación y la verificación, con una ruta rápida para el hackathon (14 y 15 de noviembre de 2026). | Usar con "fase N", "ruta rápida" o "estado" para saber qué sigue, o cuando se vaya a empezar una feature nueva. Solo la invoca la persona (`/sdd-uraqivision estado \| fase N (0-8) \| ruta rápida \| feature <nombre>`). | — |
| `systematic-debugging` | — | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes | `CREATION-LOG.md`, `LICENSE`, `PROVENANCE.md`, `condition-based-waiting-example.ts`, `condition-based-waiting.md`, `defense-in-depth.md`, `find-polluter.sh`, `root-cause-tracing.md`, `test-academic.md`, `test-pressure-1.md`, `test-pressure-2.md`, `test-pressure-3.md` |
| `test-driven-development` | — | Use when implementing any feature or bugfix, before writing implementation code | `LICENSE`, `PROVENANCE.md`, `writing-good-tests.md` |
| `validacion-optica-firms` | Procedimiento de validación de UraqiVision (M-VALIDACIÓN). Cubre dNBR de Sentinel-2 como referencia principal, focos de calor FIRMS para fechar y clasificar parches, zonas de control, sensibilidad del umbral, revisión visual y cálculo de precisión, exhaustividad y Dice (VC-01 a VC-05, RF-10, RF-11, MC-04, MC-05). | Usar al validar resultados, al descargar focos FIRMS o imágenes Sentinel-2, o al escribir validation.json. | — |
| `verification-before-completion` | — | Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always | `LICENSE`, `PROVENANCE.md` |
| `vibecodear` | Engineering Manager técnico del backend de UraqiVision que coordina todas las skills y subagentes del repositorio. Analiza el estado del proyecto frente al documento maestro, elige los roles necesarios (EM, Scrum Master, PO, Arquitecto, Datos e ingesta, Ciencia radar, Publicación, Insight, QA, DevSecOps; el trabajo de la web se deriva a UraqiVision), asigna a cada rol sus skills y subagentes, define un objetivo medible y ejecuta un Sprint completo con puntos de control: implementar, probar, ejecutar localmente, validar con la persona y documentar en .vibecodear/sprints/. | Usar cuando se pida 'vibecodear', 'hacer un sprint', 'qué le falta al proyecto', 'qué sigue' o avanzar por objetivos. No usar para una pregunta puntual ni para un cambio de una línea. | `.gitignore`, `README.md`, `assets/`, `docs/`, `references/`, `scripts/`, `tests/` |

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

- **Constitución** (`.specify/memory/constitution.md`): versión 1.0.0 (propuesta).
- **Specs** (`specs/`): `001-base-pipeline` (spec.md, plan.md, tasks.md), `002-ingesta` (spec.md), `005-publicacion` (spec.md, plan.md, tasks.md), `006-insight` (spec.md, plan.md, tasks.md).
- **Plantillas** (`.specify/templates/`): `checklist-template.md`, `constitution-template.md`, `plan-template.md`, `spec-template.md`, `tasks-template.md`.

Skills de Spec Kit instaladas:

| Skill | Qué hace |
|---|---|
| `speckit-analyze` | Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation. |
| `speckit-checklist` | Generate a custom checklist for the current feature based on user requirements. |
| `speckit-clarify` | Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec. |
| `speckit-constitution` | Create or update the project constitution from interactive or provided principle inputs. |
| `speckit-converge` | Assess the current codebase against the feature's spec, plan, and tasks, then append any remaining unbuilt work as new tasks to tasks.md so implement can complete it. |
| `speckit-implement` | Execute the implementation plan by processing and executing all tasks defined in tasks.md |
| `speckit-plan` | Execute the implementation planning workflow using the plan template to generate design artifacts. |
| `speckit-specify` | Create or update the feature specification from a natural language feature description. |
| `speckit-tasks` | Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts. |
| `speckit-taskstoissues` | Convert existing tasks into actionable, dependency-ordered GitHub issues for the feature based on available design artifacts. |

## Subagentes

Asistentes especializados con su propio contexto. Los de solo lectura revisan y reportan; los que escriben lo
hacen solo con aprobación. Cómo invocarlos: en Claude Code, «usa el subagente revisor-qa»; en opencode,
`@revisor-qa`; en Codex y Gemini, pídelo por su nombre. Fuente: `ai/agents/`.

| Subagente | Acceso | Para qué | Skills que carga | MCP |
|---|---|---|---|---|
| `auditor-publicacion` | Solo lectura | Auditor de la carpeta publicada de una estación de UraqiVision (M-PUBLICACIÓN). Verifica que estén todos los archivos de §17.3, que manifest.json y quality.json sean coherentes, que los COG sean sin pérdida, que las vistas pesen menos de 40 MB, que los textos estén en español e inglés y que ninguna métrica ausente aparezca como cero. No modifica archivos. Usar antes de publicar o desplegar una estación. | `publicacion-estacion`, `verification-before-completion` | — |
| `automation-qa-engineer` | Escribe con aprobación | Ingeniero/a de automatización de QA del backend. Diseña, implementa y mantiene suites automatizadas (pytest para el pipeline e Insight) con TDD, estabiliza pruebas inestables y selecciona regresión por impacto. Usar para automatizar casos, crear o refactorizar suites, investigar pruebas flaky o preparar la regresión de un cambio. | `qa-automation`, `test-driven-development`, `qa-regression-analysis`, `verification-before-completion` | `qa-evidence` |
| `devsecops-engineer` | Solo lectura | Ingeniero DevSecOps. Detecta secretos expuestos (clave del proveedor de IA, credenciales de Earthdata), revisa la gestión de secretos por entorno, audita dependencias vulnerables de Python y Node, valida los controles de supervisión de los agentes (hooks y permisos) y planifica rotaciones. No muestra valores de secretos ni modifica secretos remotos. | `devops-secrets-management`, `devops-dependency-security`, `devops-supervised-execution` | `devops-readiness` |
| `free-tier-architect` | Solo lectura, con web | Analista de planes gratuitos. Compara proveedores gratuitos compatibles con la arquitectura estática de UraqiVision (hospedaje del sitio, función Insight, descargas de datos), estima consumo frente a cuotas y detecta riesgos de cargos, suspensión o uso no permitido (RNF-10). Insumo para la decisión pendiente DP-06 (GitHub Pages o Vercel). Nunca activa servicios ni métodos de pago. | `devops-free-tier-audit`, `documento-maestro` | `devops-readiness` |
| `guardian-alcance` | Solo lectura | Guardián del alcance y la trazabilidad de UraqiVision. Revisa un plan, una spec, una lista de tareas o un diff contra el documento maestro (alcance de §8, reglas de §16 y §28, decisiones pendientes de §29) y comprueba que cada cambio cite sus identificadores. No modifica archivos. Usar antes de aprobar un plan o tareas de Spec Kit, antes de integrar una rama, o cuando una propuesta parezca salirse del MVP. | `documento-maestro`, `rigor-y-fuentes` | — |
| `qa-architect` | Escribe con aprobación | Arquitecto/a de QA. Analiza el proyecto con evidencias y define la estrategia de pruebas basada en riesgo, los niveles y tipos de prueba, los casos prioritarios y los criterios de salida, trazados a PS-01 a PS-09, VC-01 a VC-05 y CQ-01 a CQ-06 del documento maestro. Usar al iniciar QA en una feature, para planificar pruebas de una spec o de la entrega, o cuando se pida una estrategia o plan de pruebas. | `qa-project-discovery`, `qa-test-strategy`, `qa-test-design`, `documento-maestro`, `verification-before-completion` | `qa-evidence` |
| `release-readiness-reviewer` | Solo lectura | Revisor de go/no-go. Antes de desplegar el sitio o la función Insight, emite un veredicto con evidencias (Git, build, lint, pruebas, configuración, secretos, dependencias, variables, peso de las estaciones, rollback) en niveles NOT_READY / CONFIG_PREPARED / BUILD_VERIFIED. No despliega. | `devops-release-readiness`, `devops-git-workflow`, `entrega-hackathon` | `devops-readiness` |
| `revisor-cientifico` | Solo lectura | Revisor científico del pipeline de UraqiVision (M-INGESTA, M-CIENCIA, M-VALIDACIÓN). Revisa código Python, notebooks y resultados contra los métodos MC-01 a MC-09, las reglas RN-01, RN-02, RN-05, RN-06 y RN-13, los controles CQ-01 a CQ-06 y la validación VC-01 a VC-05. No modifica archivos. Usar al terminar una parte del pipeline, antes de publicar una estación o cuando una cifra de hectáreas o un umbral parezcan dudosos. | `ciencia-radar-nisar`, `python-geoespacial`, `validacion-optica-firms`, `verification-before-completion` | — |
| `revisor-codigo-vivo` | Solo lectura | Revisor de código vivo y CI/CD de UraqiVision. Comprueba que no haya código que no funciona o que no está conectado (imports rotos, código muerto o que solo usan las pruebas, trabajo sin terminar, datos simulados, comandos documentados que no existen), que cada rama tenga su CI/CD con conflictos, código vivo, pruebas, build y arranque, y entrega un plan de solución. No modifica archivos. Usar cuando se pida de forma explícita una PR hacia qa o main, antes de una promoción o al implementar el CI/CD. | `codigo-vivo`, `verification-before-completion`, `documento-maestro` | — |
| `revisor-insight` | Solo lectura | Revisor de seguridad y comportamiento de Insight, el lector de radar de UraqiVision (M-INSIGHT). Verifica el contrato POST /api/insight, que la clave del proveedor nunca llegue al navegador ni al repositorio, los límites de uso, las plantillas de respaldo y que las respuestas se ciñan a la estación abierta sin pronosticar ni confirmar causas. No modifica archivos. Usar al terminar la función Insight, al cambiar su prompt o antes de desplegarla. | `insight-lector-radar`, `verification-before-completion` | — |
| `revisor-qa` | Solo lectura | Revisor de calidad de UraqiVision. Revisa un diff, una rama o una tarea terminada y comprueba que lo que cambia esté probado según PS-01 a PS-09, que las pruebas sean buenas y que haya evidencia ejecutada de que pasan. No modifica archivos. Usar antes de marcar una tarea como completada, antes de integrar una rama o para validar lo que reporta otro agente. | `verification-before-completion`, `documento-maestro` | — |
| `security-qa-engineer` | Solo lectura | Ingeniero/a de QA de seguridad DEFENSIVA. Dentro de un alcance autorizado, busca secretos (claves del proveedor de IA, credenciales de Earthdata), patrones inseguros (CWE), validación de entradas de Insight, configuración y cabeceras, y reporta hallazgos con evidencia y recomendación sin aplicar cambios (RNF-06, RNF-07, PS-06). Usar para revisiones de seguridad, auditoría de secretos o checklist OWASP. | `qa-security-testing`, `verification-before-completion` | `qa-evidence` |
| `test-evidence-analyst` | Solo lectura | Analista de evidencias de prueba. Analiza resultados de ejecución (JUnit de pytest, Vitest, Playwright, cobertura), diagnostica fallos, redacta borradores de defectos y genera informes que separan hechos, hipótesis y recomendaciones. Solo lectura, nunca ejecuta pruebas ni acciones correctivas. Usar para interpretar resultados, preparar informes de calidad o reportes de defectos. | `qa-test-reporting`, `qa-defect-analysis`, `qa-quality-gates`, `systematic-debugging`, `verification-before-completion` | `qa-evidence` |

## Servidores MCP

Herramientas externas que los asistentes pueden llamar. Las versiones de npm están fijadas en
`ai/mcp/launch.mjs`; los servidores propios son de solo lectura. Fuente: `ai/mcp/servers.json`.

| Servidor | Para qué | Origen y versión | Efectos | Variables opcionales |
|---|---|---|---|---|
| `context7` | Documentación vigente de librerías (rasterio, xarray, GDAL, asf_search, earthaccess, GeoPandas...) para no inventar APIs. Solo lectura. CONTEXT7_API_KEY es opcional (sube el límite de uso). | npm: `@upstash/context7-mcp@4.4.4` | No (solo lectura) | CONTEXT7_API_KEY |
| `qa-evidence` | Servidor propio de solo lectura (de chapterCoreIEEE): analiza resultados de pruebas JUnit, cobertura, esquemas JSON, contratos y quality gates dentro del repositorio. No ejecuta pruebas ni escribe archivos. | propio: `ai/qa/mcp-servers/qa-evidence/server.mjs` | No (solo lectura) | — |
| `devops-readiness` | Servidor propio de solo lectura (de chapterCoreIEEE): detecta el stack, revisa secretos por nombre, variables de entorno, planes gratuitos, preparación del despliegue y la política de aprobación de los agentes. No despliega ni modifica nada. | propio: `ai/devops/mcp-servers/devops-readiness/server.mjs` | No (solo lectura) | — |

Scripts de apoyo (Node sin dependencias, los usan las skills de QA y DevSecOps): `ai/qa/scripts/` y
`ai/devops/scripts/`.

## Hooks

### De los asistentes de IA

Se ejecutan en cada sesión, mensaje o herramienta del asistente. Una sola lógica para las cuatro plataformas.

| Script | Qué hace | Claude Code | Codex CLI | Gemini CLI | opencode |
|---|---|---|---|---|---|
| `ai/hooks/fin-turno.mjs` | Hook de fin de turno (Stop en Claude y Codex, AfterAgent en Gemini). Si un prompt del SDD se ejecutó en esta sesión y no quedó en el historial, pide al asistente que lo registre y que muestre a la persona el siguiente prompt listo para copiar y pegar. No insiste dos veces seguidas ni interrumpe si se espera una respuesta de la persona. | Stop | Stop | AfterAgent | — |
| `ai/hooks/post-edit.mjs` | Hook posterior a cada edición (PostToolUse en Claude y Codex, AfterTool en Gemini). No bloquea: avisa al agente si un JSON/GeoJSON quedó inválido, si es.json y en.json tienen claves distintas (RNF-03) o si editó a mano ai/README.md, que es generado. Si editó una herramienta de IA (skill, subagente, MCP, hook, workflow, script o la plantilla de la ayuda), regenera sola la ayuda y la configuración (ai/sync.mjs) y revisa que el cambio sea coherente con el documento maestro (identificadores y secciones que existen, decisiones pendientes). Si lo editado cita requisitos del módulo de otra persona (§19), avisa que es apoyo a su rol. Si cita requisitos respaldados por referencias de §31, entrega sus enlaces para tenerlas en cuenta y citarlas. | PostToolUse (Write\|Edit\|MultiEdit) | PostToolUse (^apply_patch$) | AfterTool (write_file\|replace) | — |
| `ai/hooks/pre-tool.mjs` | Hook previo a cada herramienta (PreToolUse en Claude y Codex, BeforeTool en Gemini). Bloquea secretos, rutas protegidas, comandos destructivos y push o merge directo a main. Al crear una PR hacia qa o main (promoción pedida de forma explícita) activa el revisor de código vivo: si hay código roto o muerto, o el CI/CD exigible está incompleto, bloquea y muestra el plan de solución. vibecodear no se carga sin saber qué colaborador es la persona en esta sesión (§19): bloquea y pide preguntarlo con opción múltiple; al registrarla (node ai/scripts/equipo.mjs soy <Nombre>) anota la sesión. | PreToolUse (Bash\|PowerShell\|Write\|Edit\|MultiEdit\|NotebookEdit\|Read\|Skill) | PreToolUse (^(Bash\|apply_patch)$) | BeforeTool (run_shell_command\|write_file\|replace\|read_file) | plugin: tool.execute.before |
| `ai/hooks/prompt-guard.mjs` | Hook del mensaje del usuario (UserPromptSubmit en Claude y Codex, BeforeAgent en Gemini). 1) Si el mensaje contiene un secreto, no se envía al modelo. 2) Cada 10 minutos como máximo, revisa en GitHub si hay PR nuevas que esperan la aprobación de la persona y, si hay novedades, se las indica al asistente para que avise (sin red o sin gh, no hace nada). 3) Si el mensaje pide vibecodear y nadie se identificó en esta sesión, recuerda preguntar con opción múltiple qué colaborador es (§19) antes de empezar. 4) Si el mensaje trae un prompt del SDD («[SDD P-…]»), pide confirmarlo con la persona (opción múltiple), avisa de dependencias, cambios, re-ejecuciones y de quién lo ejecuta, y recuerda registrar el resultado al terminar. 5) Vigilancia en segundo plano: como máximo cada 5 minutos lanza la verificación completa de las herramientas en un proceso aparte; si algo no está activo, entrega al asistente la guía paso a paso (una vez por problema y sesión). | UserPromptSubmit | UserPromptSubmit | BeforeAgent | plugin: chat.message |
| `ai/hooks/session-context.mjs` | Hook de inicio de sesión: recuerda al agente la fuente de verdad y las reglas clave, y avisa de las PR que esperan la aprobación de la persona (consulta GitHub con gh; si no hay red o sesión, lo omite). También avisa de las herramientas de IA que cambiaron desde la última sesión (con la ayuda regenerada si hacía falta y la coherencia con el documento maestro) y de cualquier herramienta que haya dejado de funcionar o de estar activa, con la guía paso a paso para activarla, y lanza la vigilancia completa en segundo plano. Nunca bloquea. | SessionStart | SessionStart | SessionStart | — |

### Guardas

Reglas que bloquean (o avisan) antes de que el asistente actúe. Los mensajes llevan la marca
`[uraqi-guard:<regla>]`. La lógica común está en `ai/hooks/lib/guard.mjs`.

| Regla | Qué bloquea o avisa | Dónde |
|---|---|---|
| `ayuda-desactualizada` | Commit bloqueado: no se pudo regenerar ai/README.md (la ayuda) ni la configuración generada. | `ai/hooks/git-pre-commit.mjs` |
| `borrar-rama` | Borrar ramas está prohibido: son parte de la trazabilidad entre issues, commits y PR. Solo una persona puede decidirlo, si la rama crea confusión o su código ya no sirve | `ai/hooks/lib/guard.mjs` |
| `codigo-no-vivo` | PR hacia … detenida: el revisor de código vivo encontró código que no funciona o que no está conectado. | `ai/hooks/lib/promocion.mjs` |
| `colaborador-sin-identificar` | … | `ai/hooks/lib/equipo.mjs` |
| `commit-en-main` | No se commitea directamente en … | `ai/hooks/git-pre-commit.mjs` |
| `commit-grande` | Este commit mezcla varios temas. | `ai/hooks/git-commit-msg.mjs` |
| `commit-sin-issue` | Commit bloqueado: cada commit debe citar su issue para que haya trazabilidad. | `ai/hooks/git-commit-msg.mjs` |
| `disable-guards` | Intento de desactivar los permisos o las guardas | `ai/hooks/lib/guard.mjs` |
| `entorno` | No se escribe … a mano. | `ai/hooks/lib/guard.mjs` |
| `entorno-pausa` | ⏸ PAUSA: cambiaste la estructura del .env. | `ai/hooks/lib/entorno.mjs` |
| `env-exfiltration` | Envía variables de entorno a la red | `ai/hooks/lib/guard.mjs` |
| `git-destructive` | Descarta trabajo sin confirmar o reescribe el historial | `ai/hooks/lib/guard.mjs` |
| `git-force-push` | Push forzado: reescribe el historial compartido | `ai/hooks/lib/guard.mjs` |
| `git-no-verify` | Salta los hooks de git (escaneo de secretos) | `ai/hooks/lib/guard.mjs` |
| `incoherente-con-documento` | Commit bloqueado: las herramientas de IA del commit no son coherentes con el documento maestro. | `ai/hooks/git-pre-commit.mjs` |
| `merge-into-protected` | Merge local en …: los merges a dev, qa y main se hacen en GitHub al aprobar la PR (skill flujo-issues-y-pr). | `ai/hooks/lib/guard.mjs` |
| `post-edit` | Revisa antes de seguir: | `ai/hooks/post-edit.mjs` |
| `pr-aprobar-directo` | Aprobar una PR solo con `npm run pr:aprobar -- <N>`, que muestra el resumen y pide confirmación | `ai/hooks/lib/guard.mjs` |
| `pr-destino` | … Flujo: tipo/N → dev, dev → qa, qa → main (skill flujo-issues-y-pr). | `ai/hooks/lib/guard.mjs` |
| `pr-merge-directo` | Fusionar una PR solo con `npm run pr:fusionar -- <N>`: comprueba las aprobaciones (todos los colaboradores en qa y main) y pide confirmación | `ai/hooks/lib/guard.mjs` |
| `pre-commit` | Commit bloqueado (RNF-06): | `ai/hooks/git-pre-commit.mjs` |
| `pre-push` | Push bloqueado: | `ai/hooks/git-pre-push.mjs` |
| `protected-path` | No se escribe en …: … | `ai/hooks/lib/guard.mjs` |
| `publish-package` | Publicación de paquetes o releases (fuera del alcance de un agente) | `ai/hooks/lib/guard.mjs` |
| `push-from-protected` | Estás en … y este push la subiría directamente: crea una rama con \ | `ai/hooks/lib/guard.mjs` |
| `push-to-protected` | Push directo a dev, qa o main: crea una rama (tipo/N-descripcion) desde dev, haz push de la rama y abre una PR hacia dev que cierre el issue (skill flujo-issues-y-pr). | `ai/hooks/lib/guard.mjs` |
| `remote-code-exec` | Descarga y ejecuta código remoto | `ai/hooks/lib/guard.mjs` |
| `remove-item-root` | Borrado recursivo de la raíz o del home | `ai/hooks/lib/guard.mjs` |
| `rm-root` | Borrado recursivo de la raíz, del home o con comodín | `ai/hooks/lib/guard.mjs` |
| `sdd-invalido` | Commit bloqueado: los SDD de sdd/ no siguen la estructura común (sdd/00-estructura.md). | `ai/hooks/git-pre-commit.mjs` |
| `secret-file-read` | Lee o copia un archivo con secretos (.env, .netrc, claves) | `ai/hooks/lib/guard.mjs` |
| `secret-in-command` | El comando contiene un posible secreto (${secrets.join( | `ai/hooks/lib/guard.mjs` |
| `secret-in-content` | El contenido a escribir en … contiene un posible secreto (${secrets.join( | `ai/hooks/lib/guard.mjs` |
| `secret-in-prompt` | El mensaje parece contener un secreto (${secrets.join( | `ai/hooks/lib/guard.mjs` |

Secretos que detectan (en comandos, archivos, mensajes y commits): `anthropic-key`, `aws-access-key`, `github-token`, `google-api-key`, `jwt`, `netrc-password`, `openai-key`, `private-key`.

### De git

Se activan con `npm run hooks:activar` y corren en tu máquina en cada commit, push, checkout o pull.

| Hook | Qué hace | Script |
|---|---|---|
| `commit-msg` | trazabilidad commit → issue. - BLOQUEA si el mensaje no cita su issue (#12, GH-12 o la URL del issue). Exentos: merges, reverts, fixup!/squash!/amend!. En ramas tipo/N-descripcion, prepare-commit-msg ya agregó "Refs #N". - AVISA si no cita un identificador del documento maestro (§1, §28) o si trae Co-Authored-By de IA. - AVISA si cita requisitos del módulo de otra persona según §19 (apoyo a su rol), con la identidad del clon. - Commits grandes (varios temas mezclados): muestra la división propuesta y termina con código 3 para que el wrapper .githooks/commit-msg PREGUNTE en la terminal. Sin terminal (agentes, IDE) bloquea y pide preguntar. Se acepta un solo commit con URAQI_UN_COMMIT=1 o con la línea "Commit-grande: aprobado" en el mensaje. | `ai/hooks/git-commit-msg.mjs` |
| `post-checkout` | 1) Toda rama nueva se sube: si la rama actual no tiene upstream, hace `git push -u origin <rama>` (o solo enlaza el upstream si la rama ya existe en origin). No actúa en dev, qa, main ni con HEAD desacoplado. 2) Variables de entorno: si .env.example cambió entre los dos commits, agrega al .env local las claves nuevas vacías y avisa qué valores pedir al equipo (ver ai/scripts/entorno.mjs). 3) Herramientas de IA: si al cambiar de rama cambian skills, subagentes, MCP, hooks, workflows, scripts o la ayuda, avisa qué cambió, regenera la ayuda si hace falta y verifica que todo siga funcionando y activo. Nunca bloquea: si no hay red, avisa para subir la rama después. URAQI_SIN_PUSH=1 desactiva el push. | `ai/hooks/git-post-checkout.mjs` |
| `post-merge` | Nunca bloquea ni muestra valores. 1) Si cambió .env.example, agrega al .env local las claves nuevas vacías y avisa qué valores pedir al equipo. 2) Si cambiaron herramientas de IA (skills, subagentes, MCP, hooks, workflows, scripts o la ayuda), avisa qué cambió, regenera la ayuda y la configuración si hace falta, revisa la coherencia con el documento maestro y verifica que todo siga funcionando y activo. | `ai/hooks/git-post-merge.mjs` |
| `pre-commit` | impide versionar archivos con secretos o líneas con claves. También impide commitear directamente en dev, qa o main: el trabajo va en una rama tipo/N-descripcion y llega a esas ramas por PR. Variables de entorno: solo se versionan las plantillas permitidas (.env.example y las declaradas), sin valores sensibles; no puede haber archivos .env* no permitidos; .env y .env.example deben tener la misma estructura; y si el commit cambia la estructura de una plantilla, hay una PAUSA obligatoria para comunicarlo al equipo (el .env se copia a Descargas). Tras comunicarlo: URAQI_ENV_COMUNICADO=1 git commit … Ayuda al día: si el commit toca una fuente de las herramientas, ai/README.md y la configuración generada se regeneran solas; y las herramientas del commit deben ser coherentes con el documento maestro. SDD: si el commit toca sdd/*.md, los SDD deben seguir la estructura común (sdd/00-estructura.md). | `ai/hooks/git-pre-commit.mjs` |
| `pre-push` | nada llega a dev, qa ni main sin PR, todo commit que se sube cita su issue y no quedan archivos generados por ai/sync.mjs (incluida la ayuda ai/README.md) sin commitear. | `ai/hooks/git-pre-push.mjs` |
| `prepare-commit-msg` | en ramas tipo/N-descripcion (feat/12-deslizador), agrega "Refs #N" al mensaje si todavía no cita ningún issue. Así cada commit queda enlazado a su issue sin escribirlo a mano. | `ai/hooks/git-prepare-commit-msg.mjs` |

## Automatización en GitHub

Workflows que corren en GitHub. Los de eventos de issues (crear rama y PR, proteger estados) se ejecutan
desde la rama por defecto (`main`): hasta que los workflows lleguen a `main` por promoción, no corren.

| Workflow | Cuándo corre | Qué hace | Archivo |
|---|---|---|---|
| Aprobaciones | pull_request, pull_request_review | Aprobaciones de PR (reglas en ai/hooks/lib/aprobaciones.mjs): - Hacia dev: el autor puede fusionar su propia PR tras confirmar; no se exige la aprobación de otros. - Hacia qa y main: deben aprobar TODOS los colaboradores excepto el autor, sobre el último commit. Al abrir una PR hacia qa o main pide revisión automáticamente a quienes faltan (GitHub les notifica). El check falla mientras falten aprobaciones o haya cambios solicitados; se reevalúa con cada revisión. | `.github/workflows/aprobaciones.yml` |
| Buenas prácticas de PR | pull_request | Buenas prácticas de PR hacia dev, qa y main (reglas en ai/hooks/lib/buenas-practicas-pr.mjs): título (Conventional Commits o "Promoción dev → qa"), rama tipo/N que cierra su issue, descripción completa (salvo borrador), issues válidos, sin conflictos ni secretos, archivos generados al día y pruebas en verde. Pone etiquetas de tipo y tamaño, asigna al autor y comenta un resumen. Las ramas NUNCA se borran al fusionar: son parte de la trazabilidad. | `.github/workflows/buenas-practicas-pr.yml` |
| Código vivo | pull_request | Revisor de código vivo en las PR hacia qa y main (las promociones, que solo se abren cuando se piden de forma explícita): detecta código que no funciona o que no está conectado (imports rotos, paquetes sin declarar, referencias a archivos inexistentes, código muerto o que solo usan las pruebas, trabajo sin terminar, datos simulados, pruebas desactivadas), revisa que cada rama tenga su CI/CD (conflictos, código vivo, pruebas, build y arranque) y construye y levanta el proyecto si ya existe. Comenta los hallazgos con su plan de solución y falla si hay errores. Lógica en ai/scripts/codigo-vivo.mjs y ai/hooks/lib/codigo-vivo.mjs. | `.github/workflows/codigo-vivo.yml` |
| Entorno | pull_request | Variables de entorno (ai/scripts/aviso-entorno.mjs): cuando una PR cambia la estructura de .env.example (o de un .env.<x>.example permitido), comenta mencionando a todos los colaboradores excepto el autor con las claves nuevas y eliminadas, sin valores. Falla si una plantilla trae valores en claves sensibles. | `.github/workflows/entorno.yml` |
| Estado de issues | pull_request, workflow_dispatch | Estado de los issues según sus PR (reglas en ai/hooks/lib/estado-issues.mjs): PR hacia dev: borrador → "en progreso"; lista → "en revisión"; fusionada (aceptada) → "en dev" y se cierra; cerrada sin fusionar → se quitan "en progreso"/"en revisión". PR hacia qa o main: al abrirla se crea su issue de promoción; al fusionarla, SOLO con la aprobación completa (todos los colaboradores excepto el autor, sobre el último commit), los issues pasan a "en preproducción" o "en producción" y se cierra el issue de promoción. Sin aprobación completa no cambia ningún estado. Para aplicar a mano una PR ya fusionada: gh workflow run estado-issues.yml --ref dev -f pr=<N> | `.github/workflows/estado-issues.yml` |
| Herramientas de IA | pull_request | Herramientas de IA (skills, subagentes, servidores MCP, hooks, guardas, workflows, scripts y ayuda): - En cada PR hacia dev, qa o main que cambie alguna: verifica que sigan funcionando y activas (ayuda y configuración generadas al día, scripts sin errores, guardas que responden, MCP propios que arrancan y pruebas) y que el cambio sea coherente con el documento maestro (identificadores y secciones que existen, decisiones pendientes señaladas, frontmatter y MCP válidos). Resume el resultado en la PR y falla si algo no cumple. - Al fusionarse en dev: avisa a los demás colaboradores con un comentario nuevo que los menciona (GitHub les notifica) y les dice qué cambió y qué hacer. Lógica en ai/scripts/herramientas.mjs. | `.github/workflows/herramientas.yml` |
| Issue a PR | issues | Al crear un issue de trabajo: rama tipo/N-titulo desde dev, PR en borrador hacia dev con "Closes #N", etiqueta "estado: en progreso" y comentario con los pasos (ai/scripts/issue-a-pr.mjs). Los eventos de issues corren con el workflow de la rama por defecto (main). Requiere en Settings → Actions → General: "Allow GitHub Actions to create and approve pull requests". | `.github/workflows/issue-a-pr.yml` |
| Protección de issues | issues | Protección del estado de los issues (ai/scripts/proteger-issues.mjs). Revierte cambios manuales: - etiquetas "estado: …" puestas o quitadas a mano; - cerrar un issue de promoción sin que su PR se haya fusionado con la aprobación completa; - cerrar un issue con PR en curso (se cierra solo al aceptarla); - reabrir un issue cuya PR ya fue aceptada. Los eventos de issues corren con el workflow de la rama por defecto (main). Los cambios hechos por la automatización con GITHUB_TOKEN no disparan este workflow. | `.github/workflows/proteger-issues.yml` |
| Trazabilidad | pull_request | Trazabilidad commit ↔ issue ↔ PR en TODA PR hacia dev, qa o main (sin excepciones). Falla si: 1. algún commit de la PR no cita su issue (#N, GH-N o la URL del issue); 2. algún issue citado por los commits no aparece en el título o la descripción de la PR (así cada issue enlaza todas las PR por las que pasó: → dev, dev → qa, qa → main); 3. una PR de trabajo hacia dev no cierra al menos un issue (Closes/Fixes/Resolves #N); las PR de promoción dev → qa y qa → main listan sus issues con "Refs #N"; 4. algún commit no cumple Conventional Commits (commitlint.config.mjs). Es el control que no depende de que cada persona tenga activados los hooks locales (.githooks). Lee el título y la descripción ACTUALES de la PR (no los del evento), así que tras corregir la descripción basta con volver a ejecutar la corrida. | `.github/workflows/trazabilidad.yml` |

## Scripts npm

| Comando | Qué hace | Ejecuta |
|---|---|---|
| `npm run commitlint` | Valida un mensaje de commit con Conventional Commits (lo usa el hook commit-msg). | `commitlint --edit` |
| `npm run pr:pendientes` | Lista las PR que esperan tu aprobación y las tuyas listas para fusionar. | `node ai/scripts/prs.mjs` |
| `npm run pr:estado` | Checks, aprobaciones y reglas de una PR: npm run pr:estado -- <N>. | `node ai/scripts/prs.mjs estado` |
| `npm run pr:aprobar` | Aprueba una PR tras mostrar su resumen y pedir confirmación: npm run pr:aprobar -- <N>. | `node ai/scripts/prs.mjs aprobar` |
| `npm run pr:fusionar` | Fusiona una PR con merge commit si cumple las reglas, tras confirmar: npm run pr:fusionar -- <N>. | `node ai/scripts/prs.mjs fusionar` |
| `npm run issues:estado` | Actualiza el estado de los issues de una PR (lo usa el CI); simular con -- --pr <N> --simular. | `node ai/scripts/estado-issues.mjs` |
| `npm run commits:plan` | Propone dividir los cambios en commits por tema, sin tocar nada. | `node ai/scripts/dividir-commits.mjs` |
| `npm run commits:dividir` | Muestra la división propuesta, pregunta y crea un commit por tema. | `node ai/scripts/dividir-commits.mjs --aplicar` |
| `npm run ai:sync` | Genera la configuración de los cuatro asistentes y ai/README.md desde las fuentes. | `node ai/sync.mjs` |
| `npm run ai:check` | Falla si la configuración generada o ai/README.md están desactualizados (no escribe nada). | `node ai/sync.mjs --check` |
| `npm run ai:verificar` | Verifica que las herramientas de IA funcionan y están activas: hooks, guardas, MCP, ayuda al día, coherencia con el documento maestro y pruebas. | `node ai/scripts/herramientas.mjs verificar --pruebas` |
| `npm run ai:activar` | Guía paso a paso para activar las skills, Spec Kit, subagentes, MCP, hooks y su entorno que no estén activos (la vigilancia en segundo plano la entrega sola). | `node ai/scripts/herramientas.mjs activar` |
| `npm run ai:cambios` | Resume qué herramientas de IA cambian frente a origin/dev y si son coherentes con el documento maestro (-- --desde <ref> --hasta <ref>). | `node ai/scripts/herramientas.mjs cambios` |
| `npm run codigo:revisar` | Revisor de código vivo: código roto, muerto o desconectado, con plan de solución, y estado del CI/CD por rama (falla si hay errores). | `node ai/scripts/codigo-vivo.mjs revisar` |
| `npm run codigo:cicd` | Estado del CI/CD de dev, qa y main: conflictos, código vivo, pruebas, build y arranque. | `node ai/scripts/codigo-vivo.mjs cicd` |
| `npm run codigo:levantar` | Instala, construye y arranca cada aplicación del repositorio y comprueba que responde (instala dependencias: pide aprobación). | `node ai/scripts/codigo-vivo.mjs levantar` |
| `npm run referencias:revisar` | Referencias de §31: catálogo frente al documento, citas donde se implementan sus requisitos y DOI que §31 no recoge. | `node ai/scripts/referencias.mjs revisar` |
| `npm run referencias:para` | Referencias de §31 que aplican a unos requisitos o módulos: npm run referencias:para -- MC-03 M-GLOBO. | `node ai/scripts/referencias.mjs para` |
| `npm run referencias:lista` | Lista de referencias de §31 con su enlace, dónde las cita el documento y cómo considerarlas (-- --modulo M-… o --skill nombre). | `node ai/scripts/referencias.mjs lista` |
| `npm run equipo:modulos` | Tabla de §19: módulos, responsables, apoyo, revisores y requisitos (marca los de este repositorio). | `node ai/scripts/equipo.mjs modulos` |
| `npm run equipo:soy` | Registra qué colaborador eres en este clon (npm run equipo:soy -- <Nombre>); vibecodear lo pregunta con opción múltiple. | `node ai/scripts/equipo.mjs soy` |
| `npm run equipo:quien` | Muestra quién está registrado en este clon y sus módulos aquí y en el otro repositorio. | `node ai/scripts/equipo.mjs quien` |
| `npm run equipo:alcance` | ¿El trabajo es tuyo o apoyas el rol de otra persona? (npm run equipo:alcance -- RF-05 RF-06 o M-MAPA). | `node ai/scripts/equipo.mjs alcance` |
| `npm run sdd:estado` | Progreso de cada SDD de sdd/, conflictos del historial y tu siguiente prompt. | `node ai/scripts/sdd.mjs estado` |
| `npm run sdd:siguiente` | Siguiente prompt del SDD listo para copiar (-- --yo, --despues <ID>, --asistente codex\|gemini\|opencode). | `node ai/scripts/sdd.mjs siguiente` |
| `npm run sdd:ver` | Muestra un prompt del SDD con su contexto: npm run sdd:ver -- <ID>. | `node ai/scripts/sdd.mjs ver` |
| `npm run sdd:historial` | Historial de los prompts del SDD: decisiones, resultados, cambios y conflictos (-- --id <ID>). | `node ai/scripts/sdd.mjs historial` |
| `npm run sdd:validar` | Comprueba que todos los SDD de sdd/ sigan la estructura común (sdd/00-estructura.md). | `node ai/scripts/sdd.mjs validar` |
| `npm run test:guardas` | Pruebas de las guardas, el flujo de git, el entorno, las herramientas de IA y el generador del README. | `node --test ai/hooks/test/guard.test.mjs ai/hooks/test/commit-groups.test.mjs ai/hooks/test/aprobaciones.test.mjs ai/hooks/test/estado-issues.test.mjs ai/hooks/test/buenas-practicas-pr.test.mjs ai/hooks/test/entorno.test.mjs ai/hooks/test/readme.test.mjs ai/hooks/test/herramientas.test.mjs ai/hooks/test/codigo-vivo.test.mjs ai/hooks/test/equipo.test.mjs ai/hooks/test/sdd.test.mjs ai/hooks/test/vigilancia.test.mjs ai/hooks/test/referencias.test.mjs` |
| `npm run env:check` | Revisa los archivos .env y que .env y .env.example tengan la misma estructura (sin mostrar valores). | `node ai/scripts/entorno.mjs check` |
| `npm run env:sync` | Crea o alinea tu .env con .env.example sin leer ni mostrar valores. | `node ai/scripts/entorno.mjs sync` |
| `npm run env:compartir` | Copia tu .env a Descargas para compartirlo con el equipo por un canal seguro. | `node ai/scripts/entorno.mjs compartir` |
| `npm run hooks:activar` | Activa los hooks de git de .githooks/ en tu clon. | `git config core.hooksPath .githooks` |
| `npm run ayuda` | Muestra esta ayuda en la terminal: índice, o las secciones de un tema (npm run ayuda -- <tema>). | `node ai/docs/ayuda.mjs` |
| `npm run insight:local` | Ejecuta Insight en local: lee una solicitud JSON por stdin con la estación (npm run insight:local -- <estacion.json>); usa INSIGHT_PROVIDER_API_KEY y los límites del entorno. | `python3 scripts/insight_local.py` |
| `npm run pipeline:validar-manifiesto` | Valida el manifiesto de procedencia de una estación (CQ-06, RN-02, RN-07, RN-13): npm run pipeline:validar-manifiesto -- <manifest.json>. | `python3 scripts/validar_manifiesto.py` |

## Cómo se mantiene al día esta ayuda

- **Generada, no escrita a mano**: `npm run ai:sync` arma este README desde `ai/docs/README.plantilla.md` y las
  fuentes. Una skill, un subagente, un servidor MCP, un hook, un workflow o un script nuevos aparecen solos.
- **Validada**: el sync falla si la plantilla cita un `npm run`, un `node ai/…` o una ruta que no existen, o si
  un script de `package.json` no tiene su descripción en `uraqi.scripts`.
- **Regeneración automática**: al editar una fuente con un asistente (`ai/hooks/post-edit.mjs`), al commitear
  (hook pre-commit) y tras un `git pull` o un cambio de rama (hooks post-merge y post-checkout), la ayuda y la
  configuración se regeneran solas. El pre-commit solo bloquea (`[uraqi-guard:ayuda-desactualizada]`) si el
  sync falla porque una fuente es inválida. Si lo regenerado queda sin agregar, avisa (así se pueden dividir los
  commits por tema).
- **Hook pre-push**: bloquea el push mientras queden archivos generados sin commitear.
- **Hook de los asistentes tras editar**: además avisa al asistente si edita este README a mano, porque el
  siguiente sync lo pisa.
- **CI**: el workflow Buenas prácticas de PR ejecuta `node ai/sync.mjs --check` en cada PR; las pruebas de
  `npm run test:guardas` comprueban el generador.

## Cuando cambian las herramientas: aviso, coherencia y verificación

Una herramienta de IA es cualquier skill, subagente, servidor MCP, hook, guarda, workflow, script, la plantilla
de esta ayuda o `AGENTS.md`. Cuando una cambia:

| Momento | Qué pasa |
|---|---|
| El asistente edita una herramienta | `ai/hooks/post-edit.mjs` regenera la ayuda y revisa la coherencia con el documento maestro en el momento. |
| `git commit` | El pre-commit regenera la ayuda y **bloquea** (`[uraqi-guard:incoherente-con-documento]`) si una herramienta cita un identificador (RF, RNF, MC, RN, CQ, VC, PS, DP, CU, HU) o una sección (§N) que no existe en el documento, si el `name` de una skill o un subagente no coincide con su archivo o si un servidor MCP no declara `description` y `effects`. Avisa si se mencionan decisiones pendientes (§29). |
| PR hacia `dev`, `qa` o `main` | El workflow Herramientas de IA verifica que todo funcione y la coherencia, lo resume en la PR y falla si algo no cumple. |
| PR fusionada en `dev` | El mismo workflow comenta en la PR **mencionando a los demás colaboradores** (GitHub les notifica): qué cambió, si es coherente y qué hacer. |
| `git pull` o cambio de rama | Los hooks post-merge y post-checkout avisan qué cambió, regeneran la ayuda si hace falta y verifican que todo siga activo. |
| Inicio de sesión de un asistente | Avisa qué herramientas cambiaron desde la última sesión y cualquier cosa que haya dejado de funcionar. |

`npm run ai:verificar` comprueba, en cualquier momento, que todo funciona y está activo:

- hooks de git activos (`core.hooksPath`) y sus scripts presentes, con commitlint instalado;
- hooks de Claude, Codex y Gemini apuntando a scripts que existen, y el plugin de opencode;
- ayuda y configuración generadas al día;
- guardas que responden: una prueba de humo bloquea un push forzado y deja pasar `git status`;
- coherencia de todas las herramientas con el documento maestro;
- scripts sin errores de sintaxis, servidores MCP propios que arrancan (handshake `initialize`) y servidores de npm
  con versión fijada;
- pruebas de `npm run test:guardas`.

`npm run ai:cambios` muestra qué herramientas cambian en tu rama frente a `origin/dev` y si son coherentes, antes de
abrir la PR.

### Vigilancia en segundo plano y guía para activar

Ningún asistente tiene un hook con temporizador, así que la vigilancia se apoya en los eventos: al iniciar sesión y
con cada mensaje (como máximo cada 5 minutos) se lanza la verificación completa **en un proceso aparte** que no
hace esperar al asistente; el resultado queda en `.git/uraqi-vigilancia.json`. Si algo no está activo, el siguiente
mensaje entrega al asistente una **guía paso a paso** para ayudar a la persona a activarlo (una vez por problema y
sesión) y, cuando todo vuelve a estar activo, también lo avisa. Además de lo anterior, comprueba:

- skills en cada asistente (copia en `.claude/skills/` para Claude Code) y los comandos de Spec Kit en los cuatro;
- subagentes generados para Claude Code, Gemini CLI, Codex CLI y opencode;
- servidores MCP aprobados en Claude Code (aviso; los demás asistentes no lo necesitan);
- Node 20 o superior, dependencias (`npm install`), Python (aviso) y sesión de GitHub CLI (aviso).

`npm run ai:activar` muestra la misma guía cuando quieras.

## SDD por área: orden de prompts e historial

El proyecto se implementa desde cero con Spec Kit siguiendo **`sdd/`**: un SDD por área de §19 (más proyecto e
integración), todos con la misma estructura (`sdd/00-estructura.md`), y en `sdd/README.md` el **orden global de
los prompts** según el plan del hackathon (§25), con el comando de Spec Kit, quién lo ejecuta y qué herramientas
intervienen.

- **Siguiente prompt**: `npm run sdd:siguiente -- --yo` lo imprime listo para copiar (`--asistente
  codex|gemini|opencode` adapta los comandos).
- **Al pegarlo** (empieza con `[SDD P-…]`), el hook del mensaje hace que el asistente **confirme contigo** antes de
  ejecutarlo (opción múltiple: ejecutar, modificar o posponer) y avisa de dependencias, cambios, re-ejecuciones y
  si es apoyo a otro rol. Skill `sdd-prompts`.
- **Al terminar**, el hook de fin de turno (Stop en Claude y Codex, AfterAgent en Gemini) exige registrar el
  resultado en el historial y **mostrar el siguiente prompt** listo para copiar.
- **Historial** (`sdd/historial/`, un JSON por entrada para no generar conflictos de merge): `npm run
  sdd:historial`; `npm run sdd:estado` marca prompts cambiados después de ejecutarse y dependencias re-ejecutadas.
- **Estructura**: `npm run sdd:validar`; el pre-commit bloquea un SDD que la rompa (`[uraqi-guard:sdd-invalido]`) y
  `npm run ai:sync` regenera la tabla de orden de `sdd/README.md`.
- `vibecodear` toma el siguiente prompt de los módulos de la persona como objetivo del Sprint.

## Referencias del documento maestro (§31)

Las referencias de §31 (guías de NISAR y ASF, GDAL, CesiumJS, artículos, fuentes bolivianas y noticias) están en
`ai/referencias/catalogo.json`, validado contra §31: mismas referencias, enlaces idénticos, y para cada una dónde la
cita el documento (evidencia) y a qué requisitos, módulos y skills aplica (propuesta del equipo cuando el cuerpo
no la cita por nombre).

- **Las skills y los SDD conocen sus enlaces**: `npm run ai:sync` genera en cada skill y en cada SDD de área la
  sección «Referencias del documento maestro (§31)» con las que le aplican. La skill `referencias-documento` las
  tiene todas y explica cómo citarlas.
- **Al implementar**: al editar código del producto que cita un requisito con referencias, y al ejecutar un prompt
  del SDD, el asistente recibe los enlaces que aplican.
- **Verificación**: `npm run referencias:revisar` (también en `npm run ai:verificar` y en el revisor de código
  vivo de las promociones) avisa si se implementa un requisito sin citar su referencia y de DOI que §31 no recoge.
- `npm run referencias:para -- MC-03` dice qué referencias aplican a unos requisitos o módulos.

## Equipo: quién eres y qué te corresponde (§19)

Cada módulo tiene un responsable, a veces apoyo, y un revisor (§19 del documento maestro; se lee de la copia
en texto, no se escribe a mano). Los módulos de este repositorio están en `package.json` → `uraqi.modulos`.

- **vibecodear empieza preguntando «¿Qué colaborador eres?»** con opción múltiple: las personas con rol en este
  repositorio y la descripción de sus módulos (`node ai/scripts/equipo.mjs opciones --json`). La respuesta se
  registra solo en el clon (`.git/uraqi-colaborador.json`, nunca se versiona) y vale para esa sesión.
- **Guarda** `[uraqi-guard:colaborador-sin-identificar]`: no deja cargar vibecodear mientras nadie se haya
  identificado en la sesión. El hook del mensaje lo recuerda si se pide vibecodear.
- **Apoyo a otro rol**: si el objetivo, lo editado o un commit citan requisitos del módulo de otra persona,
  vibecodear, el hook tras editar y el hook commit-msg **avisan** («vas a apoyar el rol de <responsable>»), para
  que se le avise y se anote en el issue y la PR. Si el módulo vive en el otro repositorio, se deriva.
- El inicio de sesión muestra quién se registró por última vez en el clon.

## Revisor de código vivo y CI/CD

Evita que llegue a `qa` o a `main` código que da la idea de funcionar sin funcionar. Se activa solo cuando se pide
una promoción (PR hacia `qa` o `main`, que solo se abre si la persona lo pide de forma explícita):

- **Guarda de los asistentes** (`[uraqi-guard:codigo-no-vivo]`): `gh pr create --base qa|main` se detiene si hay
  errores, y el asistente muestra los hallazgos con su plan de solución.
- **Workflow Código vivo**: comenta en la PR los hallazgos con el plan, el estado del CI/CD por rama y el
  resultado del build y el arranque; falla si hay errores.
- **Subagente `revisor-codigo-vivo`** (skill `codigo-vivo`): añade la revisión de sentido que el análisis
  estático no ve (controles sin acción, endpoints inexistentes, errores silenciados) y da el dictamen.

| Hallazgo | Nivel |
|---|---|
| Import roto, paquete sin declarar, referencia a un archivo inexistente, código muerto, prueba con `.only` | error |
| Código o exportación que solo usan las pruebas o nadie usa, trabajo sin terminar, datos simulados (RN-04), prueba desactivada, documentación que cita un comando inexistente | aviso |

Cada hallazgo trae su acción: **conectar** (con su RF/RNF), **eliminar** en una rama con su issue, **declarar
como pendiente** o, si es intencional, marcar el archivo con `uraqi: vivo — <motivo>`.

**CI/CD por rama.** Cuando se implemente, cada rama (`dev`, `qa`, `main`) debe verificar cinco etapas:
conflictos con la rama destino, código vivo, pruebas, build y que el proyecto vuelva a levantar
(`npm run codigo:levantar` construye y arranca cada aplicación y espera a que responda). Mientras no haya web,
pipeline ni despliegue (hospedaje pendiente, DP-06), lo que falta sale como pendiente; desde que existan, es
error. La skill `codigo-vivo` trae los pasos listos para el pipeline.

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
