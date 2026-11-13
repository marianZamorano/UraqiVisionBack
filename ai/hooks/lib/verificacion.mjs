// Verifica que las herramientas de IA funcionan y están activas (con efectos de lectura: ejecuta git y node).
// Cada comprobación devuelve { id, ok, nivel: 'error'|'aviso', detalle }. La usan ai/scripts/herramientas.mjs,
// los hooks de git post-merge y post-checkout, el inicio de sesión de los asistentes y el workflow Herramientas de IA.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { cargarDocumento, coherencia, revisable } from './herramientas.mjs';

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

/**
 * Ejecuta las comprobaciones. rapido: sin node --check, sin MCP ni pruebas (para hooks y el inicio de sesión).
 * ci: omite lo que solo tiene sentido en un clon (hooks de git activos, commitlint instalado).
 */
export async function verificar(root, { rapido = false, ci = false, conPruebas = false } = {}) {
  const r = [];
  if (!ci) r.push(hooksDeGitActivos(root));
  r.push(...hooksDeGitCompletos(root).filter((x) => !(ci && x.id === 'commitlint')));
  r.push(hooksDeAsistentes(root), configuracionAlDia(root), guardasResponden(root), coherenciaTotal(root));
  if (!rapido) r.push(sintaxis(root), await servidoresMcp(root));
  if (conPruebas) r.push(pruebas(root));
  return r;
}

export const fallidas = (r) => r.filter((x) => !x.ok && x.nivel === 'error');

/** Texto legible de los resultados. */
export function textoVerificacion(r) {
  return r.map((x) => `${x.ok ? '✔' : x.nivel === 'error' ? '✘' : '⚠'} ${x.id}: ${x.detalle}`).join('\n');
}
