// Guía paso a paso para activar las herramientas de IA que no están activas. Cada comprobación de verificacion.mjs
// tiene sus pasos; el asistente los recorre con la persona uno por uno y vuelve a verificar al final.
// Funciones puras.

const VERIFICAR = 'Vuelve a comprobar: `npm run ai:activar`.';

/** Pasos por comprobación. detalle: el texto de la comprobación fallida. */
export const PASOS = {
  'hooks-git-activos': () => [
    'Activa los hooks de git de este clon: `npm run hooks:activar`.',
    'Comprueba: `git config --get core.hooksPath` debe responder `.githooks`.',
    VERIFICAR,
  ],
  'hooks-git-ejecutables': () => [
    'Git ignora en silencio los hooks sin permiso de ejecución: no basta con `core.hooksPath`.',
    'Da permiso a los que falten (los nombra el detalle) y actualiza el índice: `chmod +x .githooks/<hook>` y `git update-index --chmod=+x .githooks/<hook>`.',
    'Comprueba con `git ls-files -s .githooks`: los seis deben empezar por `100755`.',
    VERIFICAR,
  ],
  'hooks-git-scripts': (d) => [
    `Un hook de \`.githooks/\` llama a un script que no existe (${d}). Actualiza tu rama desde dev: \`git switch dev && git pull\`.`,
    'Si sigue fallando en dev, avisa al equipo con un issue: es un defecto del repositorio.',
    VERIFICAR,
  ],
  commitlint: () => [
    'Instala las dependencias del repositorio desde la raíz: `npm install` (instala paquetes: confírmalo antes).',
    'Comprueba que existe `node_modules/@commitlint/cli`.',
    VERIFICAR,
  ],
  node: () => [
    'Instala Node.js 20 o superior (versión LTS) desde nodejs.org o con tu gestor de versiones.',
    'Abre una terminal nueva y comprueba: `node --version`.',
    'Reinstala las dependencias: `npm install`.',
    VERIFICAR,
  ],
  'hooks-asistentes': () => [
    'Regenera la configuración de los asistentes: `npm run ai:sync`.',
    'Reinicia tu asistente desde la raíz del repositorio para que cargue los hooks: Claude Code (cierra y abre la sesión), Codex CLI (marca el proyecto como de confianza y revisa los hooks con `/hooks`), Gemini CLI (reinicia; lee `.gemini/settings.json`), opencode (reinicia; carga `.opencode/plugins/`).',
    'Si `npm run ai:sync` cambió archivos, commitéalos en la rama de tu issue.',
    VERIFICAR,
  ],
  'ayuda-y-configuracion': () => [
    'Regenera la configuración y la ayuda: `npm run ai:sync`.',
    'Si cambió archivos, commitéalos en la rama de tu issue (el pre-push no deja subir generados sin commitear).',
    VERIFICAR,
  ],
  skills: () => [
    'Copia las skills para Claude Code: `npm run ai:sync` (Gemini, Codex y opencode leen `.agents/skills/` directamente).',
    'Reinicia tu asistente. En Claude Code escribe `/` para ver las skills; en Codex, `$`.',
    VERIFICAR,
  ],
  'spec-kit': (d) => [
    `Faltan comandos de Spec Kit (${d}). Actualiza tu rama desde dev: \`git switch dev && git pull\`; Spec Kit se versiona en el repositorio.`,
    'Si siguen faltando, se reinstala con el CLI `specify` de Spec Kit para el asistente que falte: pídelo al equipo con un issue (la ayuda lo explica en `npm run ayuda -- sdd`).',
    'Reinicia tu asistente: Claude Code `/speckit-*`, Codex `$speckit-*`, Gemini y opencode `/speckit.*`.',
    VERIFICAR,
  ],
  subagentes: () => [
    'Genera los subagentes para los cuatro asistentes: `npm run ai:sync`.',
    'Reinicia tu asistente. En Claude Code los ves con `/agents`; en opencode con `@nombre`.',
    VERIFICAR,
  ],
  'mcp-claude': () => [
    'Solo si usas Claude Code: ejecuta `/mcp` y aprueba los servidores del proyecto (`.mcp.json`).',
    'O bien agrega `"enableAllProjectMcpServers": true` a `.claude/settings.local.json` (archivo personal, no se versiona) y reinicia Claude Code.',
    'Si desactivaste alguno a propósito, quítalo de `disabledMcpjsonServers` cuando lo necesites.',
    VERIFICAR,
  ],
  'servidores-mcp': (d) => [
    `Hay servidores MCP que no responden (${d}).`,
    'Propios (qa-evidence, devops-readiness): ejecútalos a mano para ver el error, por ejemplo `node ai/qa/mcp-servers/qa-evidence/server.mjs` (sale con Ctrl+C).',
    'De npm (context7, playwright): necesitan red la primera vez para que npx descargue la versión fijada en `ai/mcp/launch.mjs`.',
    'Regenera la configuración (`npm run ai:sync`) y reinicia tu asistente; en Claude Code revisa el estado con `/mcp`.',
    VERIFICAR,
  ],
  'guardas-responden': () => [
    'Las guardas no responden como deben. Ejecuta las pruebas para ver el fallo: `npm run test:guardas`.',
    'Comprueba la sintaxis del hook: `node --check ai/hooks/pre-tool.mjs`.',
    'Si falla después de un pull, actualiza tu rama desde dev; si sigue en dev, avisa al equipo con un issue.',
    VERIFICAR,
  ],
  sintaxis: (d) => [
    `Hay scripts con errores de sintaxis (${d}). Abre cada uno y corrígelo, o actualiza tu rama si vienen de un pull.`,
    'Comprueba con `npm run test:guardas`.',
    VERIFICAR,
  ],
  'coherencia-documento': (d) => [
    `Una herramienta cita identificadores o secciones que no existen en el documento maestro (${d}).`,
    'Busca el identificador correcto con la skill `documento-maestro` en `docs/UraqiVisionDocumentoMaestrov1.1.txt` y corrígelo en su archivo.',
    VERIFICAR,
  ],
  referencias: (d) => [
    `El catálogo de referencias no coincide con §31 del documento maestro (${d}).`,
    'Corrige `ai/referencias/catalogo.json` (enlaces idénticos a §31, identificadores y secciones que existan) con la skill `referencias-documento`; si cambió el documento, regenera su copia en texto: `uv run --with pypdf python ai/scripts/extraer_documento.py`.',
    'Revisa con `npm run referencias:revisar` y regenera las secciones de las skills con `npm run ai:sync`.',
    VERIFICAR,
  ],
  pruebas: () => [
    'Ejecuta las pruebas y lee qué falla: `npm run test:guardas`.',
    'Corrige la causa (skill `systematic-debugging`) en la rama de un issue.',
    VERIFICAR,
  ],
  python: () => [
    'Instala Python 3 (python.org o el gestor de tu sistema) y, para regenerar el documento maestro en texto, `uv`.',
    'Abre una terminal nueva y comprueba: `python --version` (o `python3 --version`).',
    VERIFICAR,
  ],
  gh: (d) => [
    /no está instalado/.test(d) ? 'Instala GitHub CLI desde cli.github.com.' : 'GitHub CLI está instalado pero sin sesión.',
    'Inicia sesión: `gh auth login` (elige GitHub.com y el navegador; nunca pegues el token en el chat).',
    'Comprueba: `gh auth status`.',
    VERIFICAR,
  ],
};

/** Pasos de una comprobación fallida (genéricos si no hay pasos definidos). */
export function pasosDe(fallo) {
  const f = PASOS[fallo.id];
  return f ? f(fallo.detalle ?? '') : [`Lee el detalle (${fallo.detalle}) y pide ayuda con la skill \`ayuda\` (\`npm run ayuda -- hooks\`).`, VERIFICAR];
}

/** Guía para el asistente: qué no está activo y cómo activarlo, paso a paso, primero lo que bloquea. */
export function textoGuia(fallos, { titulo = '[UraqiVision] Hay herramientas de IA que no están activas' } = {}) {
  const ordenados = [...fallos].sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'error' ? -1 : 1));
  const lineas = [
    `${titulo}. Ayuda a la persona a activarlas PASO A PASO: una por una, explica para qué sirve, pide confirmación antes de ejecutar un comando con efectos (instalar, regenerar, commitear) y comprueba al final.`,
  ];
  ordenados.forEach((f, i) => {
    lineas.push('', `${i + 1}. ${f.nivel === 'error' ? '✘' : '⚠'} ${f.id}: ${f.detalle}`);
    pasosDe(f).forEach((p, j) => lineas.push(`   ${String.fromCharCode(97 + j)}. ${p}`));
  });
  return lineas.join('\n');
}
