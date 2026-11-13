// Genera ai/README.md, la ayuda del repositorio, para que nunca quede desactualizada:
// - el texto (instalación, cómo funciona, ejemplos) sale de ai/docs/README.plantilla.md;
// - los catálogos (skills, Spec Kit, subagentes, MCP, hooks, guardas, workflows y scripts npm) salen de sus
//   fuentes: frontmatter de cada skill y subagente, ai/mcp/servers.json, la configuración de hooks que emite
//   ai/sync.mjs, los comentarios de cabecera de cada hook y workflow, y package.json.
// - valida la plantilla: cada `npm run x`, `node ai/...` y ruta citada debe existir; cada script npm necesita su
//   descripción en package.json → "uraqi.scripts". Si algo falla, ai/sync.mjs no genera y --check falla.
// Lo llama ai/sync.mjs (y por eso lo comprueban el hook pre-commit y el workflow Buenas prácticas de PR).
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../hooks/lib/frontmatter.mjs';

export const PLANTILLA = 'ai/docs/README.plantilla.md';
export const BLOQUES = ['resumen', 'skills', 'speckit', 'sdd-estado', 'subagentes', 'mcp', 'hooks-asistentes', 'guardas', 'githooks', 'workflows', 'scripts'];
const AVISO = '<!-- Generado por ai/sync.mjs desde ai/docs/README.plantilla.md y las fuentes (skills, subagentes, MCP, hooks, workflows y package.json). No lo edites a mano: edita la plantilla o la fuente y ejecuta `npm run ai:sync`. -->';

// ------------------------------------------------------------------ Utilidades

const celda = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
function tabla(cabecera, filas) {
  if (!filas.length) return '_Nada todavía._';
  return [
    `| ${cabecera.join(' | ')} |`,
    `|${cabecera.map(() => '---').join('|')}|`,
    ...filas.map((f) => `| ${f.map(celda).join(' | ')} |`),
  ].join('\n');
}
const code = (s) => `\`${s}\``;

/** Separa una descripción en «para qué» y «cuándo usarla» (la parte que empieza con «Usar…» o «Use…»). */
export function separar(desc) {
  const m = /^(?:([\s\S]*?\.)\s+)?((?:Usar|Use)\b[\s\S]*)$/.exec(String(desc).trim());
  return m ? { que: m[1] ?? '', cuando: m[2] } : { que: String(desc).trim(), cuando: '' };
}

/** Comentario de cabecera de un script (`//` o `#`), sin el shebang y hasta la primera línea de uso. */
export function cabecera(texto, prefijo) {
  const lineas = String(texto).split(/\r?\n/);
  const out = [];
  for (let i = lineas[0]?.startsWith('#!') ? 1 : 0; i < lineas.length; i += 1) {
    const l = lineas[i].trimStart();
    if (!l.startsWith(prefijo) || l.startsWith('#!')) break;
    const t = l.slice(prefijo.length).trim();
    if (/^(Uso|Ejecutar|Argumentos|git pasa|Idea tomada)\b/i.test(t)) break;
    if (/^Se activa con\b/i.test(t)) continue;
    if (t) out.push(t);
  }
  return out.join(' ')
    .replace(/^Hook de git [\w-]+(?:\s*\([^)]*\))?\s*[:.]\s*/i, '')
    .replace(/Argumentos de git:[^.]*\.\s*/g, '')
    .replace(/\s+/g, ' ').trim();
}

const leer = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const existe = (root, rel) => fs.existsSync(path.join(root, rel));
const lista = (root, rel, filtro = () => true) => (existe(root, rel) ? fs.readdirSync(path.join(root, rel), { withFileTypes: true }).filter(filtro) : []);

// ------------------------------------------------------------------ Fuentes

function leerSkills(root) {
  return lista(root, '.agents/skills', (d) => d.isDirectory() && existe(root, `.agents/skills/${d.name}/SKILL.md`))
    .map((d) => {
      const file = `.agents/skills/${d.name}/SKILL.md`;
      const { data } = parseFrontmatter(leer(root, file), file);
      const extras = lista(root, `.agents/skills/${d.name}`, (e) => e.name !== 'SKILL.md')
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
      return { nombre: d.name, descripcion: data.description, argumentos: data['argument-hint'] ?? '', soloPersona: data['disable-model-invocation'] === 'true', extras };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function leerAgentes(root) {
  return lista(root, 'ai/agents', (d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => {
      const file = `ai/agents/${d.name}`;
      const { data } = parseFrontmatter(leer(root, file), file);
      return { nombre: data.name, descripcion: data.description, acceso: data.access ?? 'read', web: data.web === 'true', skills: data.skills ?? [], mcp: data.mcp ?? [] };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function leerMcp(root) {
  const servers = JSON.parse(leer(root, 'ai/mcp/servers.json')).servers;
  const launch = existe(root, 'ai/mcp/launch.mjs') ? leer(root, 'ai/mcp/launch.mjs') : '';
  const paquetes = Object.fromEntries([...launch.matchAll(/([\w-]+):\s*\{\s*pkg:\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  return Object.entries(servers).map(([nombre, s]) => ({
    nombre,
    descripcion: s.description ?? '',
    origen: s.script ? `propio: ${code(s.script)}` : paquetes[s.launch] ? `npm: ${code(paquetes[s.launch])}` : `lanzador: ${code(s.launch ?? '?')}`,
    efectos: s.effects ? 'Sí (pide aprobación)' : 'No (solo lectura)',
    env: (s.optionalEnv ?? []).join(', '),
  }));
}

/** Eventos de hooks por plataforma, leídos de la configuración que emite ai/sync.mjs. */
function leerHooksAsistentes(root, outputs) {
  const generado = (rel) => {
    const abs = path.join(root, rel);
    if (outputs?.has(abs)) return outputs.get(abs);
    return existe(root, rel) ? leer(root, rel) : null;
  };
  const plataformas = [['Claude Code', '.claude/settings.json'], ['Codex CLI', '.codex/hooks.json'], ['Gemini CLI', '.gemini/settings.json']];
  const porScript = new Map();
  for (const [plataforma, rel] of plataformas) {
    const txt = generado(rel);
    if (!txt) continue;
    for (const [evento, entradas] of Object.entries(JSON.parse(txt).hooks ?? {})) {
      for (const e of entradas) {
        for (const h of e.hooks ?? []) {
          const script = /ai\/hooks\/([\w-]+\.mjs)/.exec(h.command ?? '')?.[1];
          if (!script) continue;
          if (!porScript.has(script)) porScript.set(script, {});
          const reg = porScript.get(script);
          (reg[plataforma] ??= []).push(e.matcher ? `${evento} (${e.matcher})` : evento);
        }
      }
    }
  }
  const opencode = generado('.opencode/plugins/uraqi-guardas.js') ?? '';
  return [...porScript.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([script, reg]) => ({
    script,
    descripcion: existe(root, `ai/hooks/${script}`) ? cabecera(leer(root, `ai/hooks/${script}`), '//') : '',
    reg,
    opencode: (script === 'pre-tool.mjs' && opencode.includes('tool.execute.before')) ? 'plugin: tool.execute.before'
      : (script === 'prompt-guard.mjs' && opencode.includes('chat.message')) ? 'plugin: chat.message' : '—',
  }));
}

function leerGuardas(root) {
  const reglas = new Map();
  const agregar = (id, donde, que) => { if (!reglas.has(id)) reglas.set(id, { id, donde, que: que.replace(/\$\{[^}]*\}/g, '…').replace(/…\./g, '…').trim() }); };
  const archivos = [
    ...lista(root, 'ai/hooks/lib', (d) => d.isFile() && d.name.endsWith('.mjs')).map((d) => `ai/hooks/lib/${d.name}`),
    ...lista(root, 'ai/hooks', (d) => d.isFile() && d.name.endsWith('.mjs')).map((d) => `ai/hooks/${d.name}`),
  ];
  const secretos = [];
  for (const f of archivos) {
    const t = leer(root, f);
    for (const m of t.matchAll(/\{\s*id:\s*'([a-z0-9-]+)',[^\n]*?why:\s*'((?:[^'\\]|\\.)*)'/g)) agregar(m[1], f, m[2]);
    for (const m of t.matchAll(/\{\s*id:\s*'([a-z0-9-]+)',\s*re:[^\n]*\}/g)) if (!/why:/.test(m[0])) secretos.push(m[1]);
    for (const m of t.matchAll(/deny\('([a-z0-9-]+)',\s*[`'"]([^`'"]*)/g)) agregar(m[1], f, m[2].split(/(?<=\.)\s/)[0]);
    for (const m of t.matchAll(/\[uraqi-guard:([a-z0-9-]+)\]\s*([^`'"\n\\]*)/g)) agregar(m[1], f, m[2].split(/(?<=\.)\s/)[0]);
  }
  return { reglas: [...reglas.values()].sort((a, b) => a.id.localeCompare(b.id)), secretos: [...new Set(secretos)].sort() };
}

function leerGitHooks(root) {
  return lista(root, '.githooks', (d) => d.isFile()).map((d) => {
    const js = `ai/hooks/git-${d.name}.mjs`;
    const desc = existe(root, js) ? cabecera(leer(root, js), '//') : cabecera(leer(root, `.githooks/${d.name}`), '#');
    return { nombre: d.name, script: existe(root, js) ? js : `.githooks/${d.name}`, descripcion: desc };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function leerWorkflows(root) {
  return lista(root, '.github/workflows', (d) => d.isFile() && /\.ya?ml$/.test(d.name)).map((d) => {
    const t = leer(root, `.github/workflows/${d.name}`);
    const on = /^on:\s*\r?\n((?:[ \t]+.*\r?\n?)+)/m.exec(t)?.[1] ?? '';
    const eventos = [...on.matchAll(/^ {2}([\w_]+):/gm)].map((m) => m[1]);
    return { archivo: d.name, nombre: /^name:\s*(.+)$/m.exec(t)?.[1]?.trim() ?? d.name, eventos, descripcion: cabecera(t, '#') };
  }).sort((a, b) => a.archivo.localeCompare(b.archivo));
}

function leerScripts(root, errores) {
  const pkg = JSON.parse(leer(root, 'package.json'));
  const scripts = pkg.scripts ?? {};
  const desc = pkg.uraqi?.scripts ?? {};
  for (const s of Object.keys(scripts)) if (!desc[s]) errores.push(`package.json: falta la descripción del script "${s}" en "uraqi.scripts"`);
  for (const s of Object.keys(desc)) if (s !== '$comentario' && !scripts[s]) errores.push(`package.json: "uraqi.scripts" describe "${s}", que no existe en "scripts"`);
  return { scripts, desc };
}

function leerSdd(root) {
  const constitucion = '.specify/memory/constitution.md';
  let estado = 'no existe';
  if (existe(root, constitucion)) {
    const t = leer(root, constitucion);
    estado = /\[(CONSTITUTION_VERSION|PROJECT_NAME)\]/.test(t)
      ? 'plantilla sin rellenar: falta la fase 1 (`speckit-constitution`)'
      : (/\*\*Version\*\*:\s*([^|\n]+)/.exec(t)?.[1]?.trim() ? `versión ${/\*\*Version\*\*:\s*([^|\n]+)/.exec(t)[1].trim()}` : 'rellenada');
  }
  const specs = lista(root, 'specs', (d) => d.isDirectory()).map((d) => ({
    nombre: d.name,
    artefactos: ['spec.md', 'plan.md', 'tasks.md'].filter((f) => existe(root, `specs/${d.name}/${f}`)),
  })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const plantillas = lista(root, '.specify/templates', (d) => d.isFile()).map((d) => d.name).sort();
  return { constitucion, estado, specs, plantillas };
}

// ------------------------------------------------------------------ Validación de la plantilla

/** Errores de la plantilla: bloques desconocidos o faltantes, scripts npm, comandos node y rutas inexistentes. */
export function validarPlantilla(texto, { root, scripts }) {
  const errores = [];
  const usados = [...texto.matchAll(/^<!-- @@([\w-]+) -->$/gm)].map((m) => m[1]);
  for (const b of usados) if (!BLOQUES.includes(b)) errores.push(`${PLANTILLA}: bloque desconocido <!-- @@${b} -->`);
  for (const b of BLOQUES) if (!usados.includes(b)) errores.push(`${PLANTILLA}: falta el bloque <!-- @@${b} -->`);
  for (const m of texto.matchAll(/npm run (?:-s\s+)?([\w:.-]+)/g)) {
    if (!scripts[m[1]]) errores.push(`${PLANTILLA}: cita \`npm run ${m[1]}\`, que no existe en package.json`);
  }
  const rutas = new Set();
  for (const m of texto.matchAll(/\bnode\s+(?:--test\s+)?((?:ai|\.agents)\/[\w./-]+\.m?js)\b/g)) rutas.add(m[1]);
  for (const m of texto.matchAll(/`([^`\s]+)`/g)) {
    const r = m[1].replace(/[),.:;]+$/, '');
    if (/[<>*{}…]|\.\.\./.test(r)) continue;
    if (/^(ai|\.agents|\.githooks|\.github|\.specify|docs|\.claude|\.gemini|\.codex|\.opencode)\//.test(r)
      || /^(AGENTS\.md|CLAUDE\.md|package\.json|\.mcp\.json|opencode\.json|commitlint\.config\.mjs|\.env\.example)$/.test(r)) rutas.add(r.replace(/\/$/, ''));
  }
  for (const r of rutas) if (!existe(root, r)) errores.push(`${PLANTILLA}: cita ${r}, que no existe`);
  return errores;
}

// ------------------------------------------------------------------ Bloques

function bloques(root, outputs, errores) {
  const skills = leerSkills(root);
  const propias = skills.filter((s) => !s.nombre.startsWith('speckit-'));
  const speckit = skills.filter((s) => s.nombre.startsWith('speckit-'));
  const agentes = leerAgentes(root);
  const mcp = leerMcp(root);
  const hooks = leerHooksAsistentes(root, outputs);
  const guardas = leerGuardas(root);
  const githooks = leerGitHooks(root);
  const workflows = leerWorkflows(root);
  const { scripts, desc } = leerScripts(root, errores);
  const sdd = leerSdd(root);

  for (const a of agentes) {
    for (const s of a.skills) if (!skills.some((k) => k.nombre === s)) errores.push(`ai/agents/${a.nombre}.md: la skill "${s}" no existe`);
  }

  return {
    scripts,
    texto: {
      resumen: tabla(['Pieza', 'Cantidad', 'Fuente'], [
        ['Skills propias', propias.length, code('.agents/skills/')],
        ['Skills de Spec Kit (SDD)', speckit.length, code('.agents/skills/speckit-*')],
        ['Subagentes', agentes.length, code('ai/agents/')],
        ['Servidores MCP', mcp.length, code('ai/mcp/servers.json')],
        ['Hooks de los asistentes', hooks.length, code('ai/hooks/*.mjs')],
        ['Reglas de las guardas', guardas.reglas.length, code('ai/hooks/lib/')],
        ['Hooks de git', githooks.length, code('.githooks/')],
        ['Workflows de GitHub', workflows.length, code('.github/workflows/')],
        ['Scripts npm', Object.keys(scripts).length, code('package.json')],
      ]),
      skills: tabla(['Skill', 'Para qué', 'Cuándo usarla', 'Archivos de apoyo'], propias.map((s) => {
        const { que, cuando } = separar(s.descripcion);
        const extra = s.soloPersona ? ` Solo la invoca la persona (\`/${s.nombre}${s.argumentos ? ` ${s.argumentos}` : ''}\`).` : '';
        return [code(s.nombre), que || '—', `${cuando}${extra}`.trim() || '—', s.extras.map(code).join(', ') || '—'];
      })),
      speckit: tabla(['Skill', 'Qué hace'], speckit.map((s) => [code(s.nombre), s.descripcion])),
      'sdd-estado': [
        `- **Constitución** (${code(sdd.constitucion)}): ${sdd.estado}.`,
        `- **Specs** (${code('specs/')}): ${sdd.specs.length ? sdd.specs.map((s) => `${code(s.nombre)} (${s.artefactos.join(', ') || 'sin artefactos'})`).join(', ') : 'ninguna todavía'}.`,
        `- **Plantillas** (${code('.specify/templates/')}): ${sdd.plantillas.map(code).join(', ') || 'ninguna'}.`,
      ].join('\n'),
      subagentes: tabla(['Subagente', 'Acceso', 'Para qué', 'Skills que carga', 'MCP'], agentes.map((a) => [
        code(a.nombre),
        `${a.acceso === 'write' ? 'Escribe con aprobación' : 'Solo lectura'}${a.web ? ', con web' : ''}`,
        a.descripcion,
        a.skills.map(code).join(', ') || '—',
        a.mcp.map(code).join(', ') || '—',
      ])),
      mcp: tabla(['Servidor', 'Para qué', 'Origen y versión', 'Efectos', 'Variables opcionales'], mcp.map((m) => [code(m.nombre), m.descripcion, m.origen, m.efectos, m.env || '—'])),
      'hooks-asistentes': tabla(['Script', 'Qué hace', 'Claude Code', 'Codex CLI', 'Gemini CLI', 'opencode'], hooks.map((h) => [
        code(`ai/hooks/${h.script}`), h.descripcion,
        (h.reg['Claude Code'] ?? []).join(', ') || '—', (h.reg['Codex CLI'] ?? []).join(', ') || '—', (h.reg['Gemini CLI'] ?? []).join(', ') || '—', h.opencode,
      ])),
      guardas: [
        tabla(['Regla', 'Qué bloquea o avisa', 'Dónde'], guardas.reglas.map((r) => [code(r.id), r.que || '—', code(r.donde)])),
        '',
        `Secretos que detectan (en comandos, archivos, mensajes y commits): ${guardas.secretos.map(code).join(', ') || '—'}.`,
      ].join('\n'),
      githooks: tabla(['Hook', 'Qué hace', 'Script'], githooks.map((g) => [code(g.nombre), g.descripcion, code(g.script)])),
      workflows: tabla(['Workflow', 'Cuándo corre', 'Qué hace', 'Archivo'], workflows.map((w) => [w.nombre, w.eventos.join(', ') || '—', w.descripcion || '—', code(`.github/workflows/${w.archivo}`)])),
      scripts: tabla(['Comando', 'Qué hace', 'Ejecuta'], Object.entries(scripts).map(([s, cmd]) => [code(`npm run ${s}`), desc[s] ?? '—', code(cmd)])),
    },
  };
}

// ------------------------------------------------------------------ API

/** Devuelve { texto, errores }. outputs: el mapa de archivos que va a escribir ai/sync.mjs (opcional). */
export function generarReadme({ root, outputs = new Map() }) {
  const errores = [];
  if (!existe(root, PLANTILLA)) return { texto: '', errores: [`falta ${PLANTILLA}`] };
  const plantilla = leer(root, PLANTILLA).replace(/\r\n/g, '\n');
  let b;
  try {
    b = bloques(root, outputs, errores);
  } catch (err) {
    return { texto: '', errores: [...errores, err.message] };
  }
  errores.push(...validarPlantilla(plantilla, { root, scripts: b.scripts }));
  const cuerpo = plantilla.replace(/^<!-- @@([\w-]+) -->$/gm, (linea, nombre) => b.texto[nombre] ?? linea);
  return { texto: `${AVISO}\n\n${cuerpo.trim()}\n`, errores };
}
