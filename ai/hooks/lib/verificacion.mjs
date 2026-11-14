// Verifica que las herramientas de IA funcionan y están activas (con efectos de lectura: ejecuta git y node).
// Cada comprobación devuelve { id, ok, nivel: 'error'|'aviso', detalle }. La usan ai/scripts/herramientas.mjs,
// los hooks de git post-merge y post-checkout, el inicio de sesión de los asistentes y el workflow Herramientas de IA.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { cargarDocumento, coherencia, revisable } from './herramientas.mjs';
import { cargarCatalogo, validarCatalogo, leerDocumento, CATALOGO } from './referencias.mjs';
import { cargarEquipo } from './equipo.mjs';

const node = (root, args, opts = {}) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 60000, ...opts });
const listar = (root, rel, re) => (fs.existsSync(path.join(root, rel)) ? fs.readdirSync(path.join(root, rel)).filter((f) => re.test(f)).map((f) => `${rel}/${f}`) : []);
const resultado = (id, ok, detalle, nivel = 'error') => ({ id, ok, nivel, detalle });

/** core.hooksPath apunta a .githooks (sin esto ningún hook de git corre). */
export function hooksDeGitActivos(root) {
  let valor = '';
  try {
    valor = execFileSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    valor = '';
  }
  return resultado('hooks-git-activos', valor.replace(/\/$/, '') === '.githooks',
    valor ? `core.hooksPath=${valor}` : 'core.hooksPath sin configurar → npm run hooks:activar');
}

/**
 * Todo archivo de .githooks debe ser ejecutable: git ignora en silencio los que no lo son, así que
 * core.hooksPath=.githooks no basta. El modo del índice viaja en el clon; en POSIX se comprueba también el disco.
 */
export function hooksDeGitEjecutables(root) {
  const dir = path.join(root, '.githooks');
  if (!fs.existsSync(dir)) return resultado('hooks-git-ejecutables', false, '.githooks no existe → npm run hooks:activar');
  const archivos = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile() && !/^readme/i.test(f));
  const modos = new Map();
  try {
    for (const linea of execFileSync('git', ['ls-files', '-s', '--', '.githooks'], { cwd: root, encoding: 'utf8' }).split('\n')) {
      const m = /^(\d+)\s+\S+\s+\d+\t(.+)$/.exec(linea);
      if (m) modos.set(m[2].replace(/^\.githooks\//, ''), m[1]);
    }
  } catch {
    // Sin git se comprueba solo el permiso del disco.
  }
  const fallos = [];
  for (const f of archivos) {
    const modo = modos.get(f);
    const ruta = `.githooks/${f}`;
    const arreglo = `chmod +x ${ruta} y git update-index --chmod=+x ${ruta}`;
    if (modo && modo !== '100755') fallos.push(`${ruta} (índice ${modo}; ${arreglo})`);
    else if (process.platform !== 'win32' && (fs.statSync(path.join(dir, f)).mode & 0o111) === 0) fallos.push(`${ruta} (sin permiso en el disco; ${arreglo})`);
  }
  return resultado('hooks-git-ejecutables', !fallos.length,
    fallos.length ? `git no ejecuta: ${fallos.join(' | ')}` : `${archivos.length} hooks de git ejecutables`);
}

/** Cada hook de .githooks llama a scripts que existen; commitlint instalado (aviso). */
export function hooksDeGitCompletos(root) {
  const faltan = [];
  for (const f of listar(root, '.githooks', /.*/)) {
    for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/ai\/hooks\/[\w-]+\.mjs/g)) {
      if (!fs.existsSync(path.join(root, m[0]))) faltan.push(`${f} → ${m[0]}`);
    }
  }
  const out = [resultado('hooks-git-scripts', !faltan.length, faltan.length ? `faltan: ${faltan.join(', ')}` : 'todos los scripts existen')];
  const commitlint = fs.existsSync(path.join(root, 'node_modules/@commitlint/cli/cli.js'));
  out.push(resultado('commitlint', commitlint, commitlint ? 'instalado' : 'falta: ejecuta npm install (el hook commit-msg lo necesita)', 'aviso'));
  return out;
}

/** Los hooks configurados para Claude, Codex y Gemini apuntan a scripts que existen; el plugin de opencode existe. */
export function hooksDeAsistentes(root) {
  const faltan = [];
  let total = 0;
  for (const rel of ['.claude/settings.json', '.codex/hooks.json', '.gemini/settings.json']) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) { faltan.push(`${rel} no existe`); continue; }
    for (const entradas of Object.values(JSON.parse(fs.readFileSync(abs, 'utf8')).hooks ?? {})) {
      for (const e of entradas) {
        for (const h of e.hooks ?? []) {
          const script = /ai\/hooks\/[\w-]+\.mjs/.exec(h.command ?? '')?.[0];
          total += 1;
          if (!script || !fs.existsSync(path.join(root, script))) faltan.push(`${rel}: ${h.command}`);
        }
      }
    }
  }
  if (!fs.existsSync(path.join(root, '.opencode/plugins/uraqi-guardas.js'))) faltan.push('.opencode/plugins/uraqi-guardas.js no existe');
  return resultado('hooks-asistentes', !faltan.length, faltan.length ? faltan.join(' | ') : `${total} hooks configurados en 3 asistentes + plugin de opencode`);
}

/** Sin errores de sintaxis en los scripts de las herramientas (node --check). */
export function sintaxis(root) {
  const archivos = [
    'ai/sync.mjs',
    ...listar(root, 'ai/hooks', /\.mjs$/), ...listar(root, 'ai/hooks/lib', /\.mjs$/), ...listar(root, 'ai/scripts', /\.mjs$/),
    ...listar(root, 'ai/docs', /\.mjs$/), ...listar(root, 'ai/mcp', /\.mjs$/), ...listar(root, '.opencode/plugins', /\.js$/),
  ].filter((f) => fs.existsSync(path.join(root, f)));
  const fallan = archivos.filter((f) => node(root, ['--check', f]).status !== 0);
  return resultado('sintaxis', !fallan.length, fallan.length ? `con errores: ${fallan.join(', ')}` : `${archivos.length} scripts sin errores de sintaxis`);
}

/** La configuración generada y la ayuda (ai/README.md) están al día con las fuentes. */
export function configuracionAlDia(root) {
  const r = node(root, ['ai/sync.mjs', '--check']);
  const detalle = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').filter((l) => /desactualizado|sobra|Error|no se puede/.test(l)).slice(0, 8);
  return resultado('ayuda-y-configuracion', r.status === 0, r.status === 0 ? 'ai/README.md y la configuración generada están al día' : `${detalle.join(' | ')} → npm run ai:sync`);
}

/** Las guardas responden: bloquean un push forzado y dejan pasar un comando inocuo (prueba de humo). */
export function guardasResponden(root) {
  const probar = (command) => node(root, ['ai/hooks/pre-tool.mjs', '--platform=claude'], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: root }), timeout: 15000,
  }).status;
  const bloquea = probar('git push --force origin feat/1-prueba');
  const deja = probar('git status');
  const ok = bloquea === 2 && deja === 0;
  return resultado('guardas-responden', ok, ok ? 'bloquean un push forzado y dejan pasar git status' : `push forzado → código ${bloquea} (esperado 2); git status → código ${deja} (esperado 0)`);
}

/** Handshake initialize con un servidor MCP propio por stdio. */
function handshake(root, script, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [script], { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
    let buffer = '';
    const fin = (ok, detalle) => { clearTimeout(t); hijo.kill(); resolve({ ok, detalle }); };
    const t = setTimeout(() => fin(false, 'sin respuesta a initialize'), timeoutMs);
    hijo.on('error', (e) => fin(false, e.message));
    hijo.stdout.on('data', (d) => {
      buffer += d;
      for (const linea of buffer.split('\n')) {
        try {
          const msg = JSON.parse(linea);
          if (msg.id === 1) fin(Boolean(msg.result?.serverInfo), msg.result?.serverInfo ? `${msg.result.serverInfo.name} ${msg.result.serverInfo.version}` : JSON.stringify(msg.error ?? msg));
        } catch {
          // línea incompleta
        }
      }
    });
    hijo.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'uraqi-verificar', version: '1.0.0' } } })}\n`);
  });
}

/** Los servidores MCP propios arrancan y responden; los de npm tienen versión fijada en el lanzador. */
export async function servidoresMcp(root) {
  const servers = JSON.parse(fs.readFileSync(path.join(root, 'ai/mcp/servers.json'), 'utf8')).servers ?? {};
  const launch = fs.existsSync(path.join(root, 'ai/mcp/launch.mjs')) ? fs.readFileSync(path.join(root, 'ai/mcp/launch.mjs'), 'utf8') : '';
  const fallos = [];
  const oks = [];
  for (const [n, s] of Object.entries(servers)) {
    if (s.script) {
      if (!fs.existsSync(path.join(root, s.script))) { fallos.push(`${n}: no existe ${s.script}`); continue; }
      const r = await handshake(root, s.script);
      (r.ok ? oks : fallos).push(`${n}: ${r.detalle}`);
    } else if (!new RegExp(`${s.launch}:\\s*\\{\\s*pkg:\\s*'[^']+@\\d`).test(launch)) {
      fallos.push(`${n}: sin versión fijada en ai/mcp/launch.mjs`);
    } else oks.push(`${n}: npm con versión fijada`);
  }
  return resultado('servidores-mcp', !fallos.length, fallos.length ? fallos.join(' | ') : oks.join(' · '));
}

/** Coherencia de todas las fuentes de herramientas con el documento maestro. */
export function coherenciaTotal(root) {
  const archivos = [];
  const recorrer = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) {
      for (const e of fs.readdirSync(abs)) if (e !== 'node_modules' && e !== '__pycache__') recorrer(`${rel}/${e}`);
    } else if (revisable(rel)) archivos.push({ path: rel, texto: fs.readFileSync(abs, 'utf8'), agregadas: '' });
  };
  for (const r of ['.agents/skills', 'ai', '.githooks', '.github', 'AGENTS.md', 'CLAUDE.md', 'package.json']) recorrer(r);
  const { errores } = coherencia(archivos, cargarDocumento(root));
  return resultado('coherencia-documento', !errores.length, errores.length ? errores.slice(0, 10).join(' | ') : `${archivos.length} archivos coherentes con el documento maestro`);
}

/** Pruebas de las guardas y automatizaciones (npm run test:guardas). */
export function pruebas(root) {
  const cmd = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts?.['test:guardas'] ?? '';
  const args = cmd.replace(/^node\s+/, '').split(/\s+/).filter(Boolean);
  const r = node(root, args, { timeout: 120000 });
  // Con terminal, node --test imprime «ℹ pass N»; sin terminal (CI), TAP: «# pass N».
  const pasan = /^(?:ℹ|#) pass (\d+)/m.exec(r.stdout ?? '')?.[1];
  const fallan = /^(?:ℹ|#) fail (\d+)/m.exec(r.stdout ?? '')?.[1];
  return resultado('pruebas', r.status === 0, r.status === 0 ? `${pasan ?? '?'} pruebas en verde` : `${fallan ?? '?'} prueba(s) fallan → npm run test:guardas`);
}

const dirs = (root, rel) => (fs.existsSync(path.join(root, rel)) ? fs.readdirSync(path.join(root, rel), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);

/** Skills activas: cada skill de .agents/skills (que leen Gemini, Codex y opencode) tiene su copia en .claude/skills. */
export function skillsActivas(root) {
  const propias = dirs(root, '.agents/skills').filter((s) => !s.startsWith('speckit-') && fs.existsSync(path.join(root, '.agents/skills', s, 'SKILL.md')));
  const faltan = propias.filter((s) => !fs.existsSync(path.join(root, '.claude/skills', s, 'SKILL.md')));
  return resultado('skills', propias.length > 0 && !faltan.length, faltan.length ? `sin copia para Claude Code: ${faltan.join(', ')}` : `${propias.length} skills activas en los cuatro asistentes`);
}

/** Spec Kit activo en cada asistente: skills (Claude Code y Codex), comandos de Gemini CLI y de opencode. */
export function specKitActivo(root) {
  const cmds = dirs(root, '.agents/skills').filter((s) => s.startsWith('speckit-')).map((s) => s.slice(8));
  if (!cmds.length) return resultado('spec-kit', false, 'Spec Kit no está instalado (.agents/skills/speckit-*)');
  const faltan = [];
  for (const c of cmds) {
    if (!fs.existsSync(path.join(root, '.claude/skills', `speckit-${c}`, 'SKILL.md'))) faltan.push(`Claude Code: speckit-${c}`);
    if (!fs.existsSync(path.join(root, '.gemini/commands', `speckit.${c}.toml`))) faltan.push(`Gemini CLI: speckit.${c}`);
    if (!fs.existsSync(path.join(root, '.opencode/commands', `speckit.${c}.md`))) faltan.push(`opencode: speckit.${c}`);
  }
  return resultado('spec-kit', !faltan.length, faltan.length ? `faltan: ${faltan.slice(0, 6).join(', ')}${faltan.length > 6 ? ` (+${faltan.length - 6})` : ''}` : `${cmds.length} comandos de Spec Kit en los cuatro asistentes`);
}

/** Subagentes generados para los cuatro asistentes. */
export function subagentesActivos(root) {
  const nombres = listar(root, 'ai/agents', /\.md$/).map((f) => path.basename(f, '.md'));
  const faltan = [];
  for (const n of nombres) {
    for (const [asistente, rel] of [['Claude Code', `.claude/agents/${n}.md`], ['Gemini CLI', `.gemini/agents/${n}.md`], ['Codex CLI', `.codex/agents/${n}.toml`], ['opencode', `.opencode/agents/${n}.md`]]) {
      if (!fs.existsSync(path.join(root, rel))) faltan.push(`${asistente}: ${n}`);
    }
  }
  return resultado('subagentes', nombres.length > 0 && !faltan.length, faltan.length ? `faltan: ${faltan.slice(0, 6).join(', ')}${faltan.length > 6 ? ` (+${faltan.length - 6})` : ''}` : `${nombres.length} subagentes en los cuatro asistentes`);
}

/** Claude Code solo usa los MCP del proyecto si la persona los aprobó (aviso: los demás asistentes no lo necesitan). */
export function mcpAprobadosClaude(root) {
  const leerJson = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return {}; } };
  const servidores = Object.keys(leerJson('.mcp.json').mcpServers ?? {});
  const local = { ...leerJson('.claude/settings.json'), ...leerJson('.claude/settings.local.json') };
  const desactivados = (local.disabledMcpjsonServers ?? []).filter((s) => servidores.includes(s));
  const aprobados = local.enableAllProjectMcpServers === true ? servidores : (local.enabledMcpjsonServers ?? []);
  const faltan = servidores.filter((s) => !aprobados.includes(s) || desactivados.includes(s));
  return resultado('mcp-claude', !faltan.length, faltan.length ? `servidores sin aprobar o desactivados en Claude Code: ${faltan.join(', ')}` : 'servidores MCP del proyecto aprobados en Claude Code', 'aviso');
}

/** El catálogo de referencias coincide con §31 del documento maestro. */
export function referenciasCoherentes(root) {
  const catalogo = cargarCatalogo(root);
  if (!catalogo.length) return resultado('referencias', false, `no hay catálogo de referencias (${CATALOGO})`);
  const errores = validarCatalogo(catalogo, leerDocumento(root), { modulos: cargarEquipo(root).modulos.map((m) => m.id) });
  return resultado('referencias', !errores.length, errores.length ? errores.slice(0, 4).join(' | ') : `${catalogo.length} referencias de §31 en el catálogo, con sus enlaces`);
}

/** Node 20 o superior (hooks, sync y servidores MCP propios). */
export function nodeVersion() {
  const mayor = Number(process.versions.node.split('.')[0]);
  return resultado('node', mayor >= 20, `Node ${process.versions.node}${mayor >= 20 ? '' : ' (se necesita 20 o superior)'}`);
}

/** Python 3 (scripts de vibecodear y regeneración del documento maestro en texto). */
export function pythonDisponible(root) {
  const ok = ['python', 'python3', 'py'].some((cmd) => spawnSync(cmd, ['--version'], { cwd: root, encoding: 'utf8', timeout: 8000 }).status === 0);
  return resultado('python', ok, ok ? 'Python disponible' : 'no se encontró Python 3 (lo usan los scripts de vibecodear y extraer_documento.py)', 'aviso');
}

/** Sesión de GitHub CLI (issues, PR, avisos de aprobación y del SDD). No muestra el token. */
export function sesionGh(root) {
  const r = spawnSync('gh', ['auth', 'status'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  return resultado('gh', r.status === 0, r.status === 0 ? 'GitHub CLI con sesión iniciada' : (r.error ? 'GitHub CLI no está instalado' : 'GitHub CLI sin sesión iniciada'), 'aviso');
}

/**
 * Ejecuta las comprobaciones. rapido: sin node --check, sin MCP ni pruebas (para hooks y el inicio de sesión).
 * ci: omite lo que solo tiene sentido en un clon (hooks de git activos, commitlint instalado).
 */
export async function verificar(root, { rapido = false, ci = false, conPruebas = false } = {}) {
  const r = [];
  if (!ci) r.push(hooksDeGitActivos(root), hooksDeGitEjecutables(root), nodeVersion());
  r.push(...hooksDeGitCompletos(root).filter((x) => !(ci && x.id === 'commitlint')));
  r.push(hooksDeAsistentes(root), skillsActivas(root), specKitActivo(root), subagentesActivos(root));
  if (!ci) r.push(mcpAprobadosClaude(root));
  r.push(configuracionAlDia(root), guardasResponden(root), coherenciaTotal(root), referenciasCoherentes(root));
  if (!rapido) r.push(sintaxis(root), await servidoresMcp(root));
  if (!rapido && !ci) r.push(pythonDisponible(root), sesionGh(root));
  if (conPruebas) r.push(pruebas(root));
  return r;
}

export const fallidas = (r) => r.filter((x) => !x.ok && x.nivel === 'error');

/** Texto legible de los resultados. */
export function textoVerificacion(r) {
  return r.map((x) => `${x.ok ? '✔' : x.nivel === 'error' ? '✘' : '⚠'} ${x.id}: ${x.detalle}`).join('\n');
}
