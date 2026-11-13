#!/usr/bin/env node
// Sincroniza las herramientas de IA de UraqiVision para Claude Code, Gemini CLI, Codex CLI y opencode.
//
// Fuentes (lo único que se edita a mano):
//   .agents/skills/<skill>/   skills (Gemini, Codex y opencode las leen directamente de aquí)
//   ai/agents/<agente>.md     subagentes
//   ai/hooks/                 guardas (scripts compartidos)
//   ai/mcp/servers.json       servidores MCP
//   ai/docs/README.plantilla.md  texto del ai/README.md (el resto del README se genera de las fuentes)
//   sdd/*.md                  SDD por área (la tabla de orden de sdd/README.md se genera desde ellos)
//   ai/referencias/catalogo.json  referencias de §31: genera su sección en cada skill y SDD que las usa
//
// Uso:
//   node ai/sync.mjs           genera o actualiza los archivos de cada plataforma
//   node ai/sync.mjs --check   no escribe nada; termina con código 1 si algo está desactualizado
//
// Idea tomada de QA/scripts/platform-sync.mjs del repositorio chapterCoreIEEE.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './hooks/lib/frontmatter.mjs';
import { generarReadme } from './docs/readme.mjs';
import { cargarSdds, readmeConOrden } from './hooks/lib/sdd.mjs';
import { cargarCatalogo, referenciasPara, bloqueReferencias, inyectarBloque } from './hooks/lib/referencias.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const GEN = 'Generado por ai/sync.mjs — no editar a mano; edita la fuente (ai/ o .agents/skills/) y ejecuta `node ai/sync.mjs`.';
const MARKER = '.sincronizado-por-ai-sync';
const READ_ONLY_TOOLS_CLAUDE = ['Read', 'Grep', 'Glob', 'Bash', 'PowerShell', 'Skill'];

const rel = (...p) => path.join(ROOT, ...p);
const outputs = new Map(); // ruta absoluta -> contenido
const removals = new Set(); // rutas absolutas a borrar
const emit = (p, content) => outputs.set(rel(p), content.endsWith('\n') ? content : `${content}\n`);
const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// ------------------------------------------------------------------ Lectura de fuentes

const agents = fs.readdirSync(rel('ai', 'agents')).filter((f) => f.endsWith('.md')).sort().map((f) => {
  const { data, body } = parseFrontmatter(fs.readFileSync(rel('ai', 'agents', f), 'utf8'), `ai/agents/${f}`);
  if (`${data.name}.md` !== f) throw new Error(`ai/agents/${f}: el nombre del archivo debe ser ${data.name}.md`);
  const access = data.access ?? 'read';
  if (!['read', 'write'].includes(access)) throw new Error(`ai/agents/${f}: access debe ser read o write`);
  return { ...data, access, web: data.web === 'true', skills: data.skills ?? [], mcp: data.mcp ?? [], body, file: f };
});

const skillsDir = rel('.agents', 'skills');
// Las skills de Spec Kit (speckit-*) las instala y mantiene `specify` para cada plataforma.
const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('speckit-') && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
  .map((d) => d.name)
  .sort();

for (const a of agents) {
  for (const s of a.skills) if (!skills.includes(s)) throw new Error(`ai/agents/${a.file}: la skill "${s}" no existe en .agents/skills/`);
}

const mcp = JSON.parse(fs.readFileSync(rel('ai', 'mcp', 'servers.json'), 'utf8')).servers;
for (const a of agents) {
  for (const s of a.mcp) if (!mcp[s]) throw new Error(`ai/agents/${a.file}: el servidor MCP "${s}" no existe en ai/mcp/servers.json`);
}

// ------------------------------------------------------------------ Skills -> Claude Code

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__pycache__' || e.name === 'node_modules' || e.name.endsWith('.pyc')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p));
  }
  return out;
}

// Referencias de §31: cada skill recibe la sección generada con los enlaces que le aplican (la skill
// referencias-documento, el catálogo completo). Se escribe en la fuente y en su copia para Claude Code.
const catalogo = cargarCatalogo(ROOT);
const conReferencias = (s, texto) => inyectarBloque(texto, bloqueReferencias(s === 'referencias-documento' ? catalogo : referenciasPara({ skills: [s] }, catalogo)));

for (const s of skills) {
  for (const f of walk(path.join(skillsDir, s))) {
    let contenido = fs.readFileSync(path.join(skillsDir, s, f), 'utf8');
    if (f === 'SKILL.md') {
      const nuevo = conReferencias(s, contenido);
      if (nuevo.replace(/\r\n/g, '\n') !== contenido.replace(/\r\n/g, '\n')) emit(path.join('.agents', 'skills', s, f), nuevo);
      contenido = nuevo;
    }
    outputs.set(rel('.claude', 'skills', s, f), contenido);
  }
  emit(path.join('.claude', 'skills', s, MARKER), `${GEN}\nFuente: .agents/skills/${s}/`);
}
const claudeSkills = rel('.claude', 'skills');
if (fs.existsSync(claudeSkills)) {
  for (const d of fs.readdirSync(claudeSkills)) {
    if (fs.existsSync(path.join(claudeSkills, d, MARKER)) && !skills.includes(d)) removals.add(path.join(claudeSkills, d));
  }
}

// ------------------------------------------------------------------ Subagentes

const quote = (s) => JSON.stringify(s);
const preface = (a, invoke) => [
  `> Subagente \`${a.name}\` de UraqiVision (fuente: \`ai/agents/${a.file}\`).`,
  a.access === 'read'
    ? '> Es de **solo lectura**: no modifiques archivos, no hagas commits ni despliegues.'
    : '> Puede escribir **solo** lo que su rol permite y tras aprobación explícita; no hace commits, push ni despliegues.',
  a.skills.length ? `> Carga primero estas skills (están en \`.agents/skills/\`): ${a.skills.map(invoke).join(', ')}.` : '',
  '> Sigue AGENTS.md. La fuente de verdad es docs/UraqiVisionDocumentoMaestrov1.0.pdf (copia en .txt).',
].filter(Boolean).join('\n');

for (const a of agents) {
  const claudeTools = [
    ...READ_ONLY_TOOLS_CLAUDE,
    ...(a.access === 'write' ? ['Write', 'Edit', 'MultiEdit'] : []),
    ...(a.web ? ['WebFetch', 'WebSearch'] : []),
    ...a.mcp.map((s) => `mcp__${s}__*`),
  ].join(', ');
  emit(path.join('.claude', 'agents', `${a.name}.md`), [
    '---',
    `name: ${a.name}`,
    `description: ${quote(a.description)}`,
    `tools: ${claudeTools}`,
    ...(a.skills.length ? ['skills:', ...a.skills.map((s) => `  - ${s}`)] : []),
    ...(a.color ? [`color: ${a.color}`] : []),
    '---',
    '',
    `<!-- ${GEN} Fuente: ai/agents/${a.file} -->`,
    '',
    a.body,
  ].join('\n'));

  emit(path.join('.gemini', 'agents', `${a.name}.md`), [
    '---',
    `name: ${a.name}`,
    `description: ${quote(a.description)}`,
    'kind: local',
    '---',
    '',
    `<!-- ${GEN} -->`,
    '',
    preface(a, (s) => `\`${s}\``),
    '',
    a.body,
  ].join('\n'));

  const instructions = `${preface(a, (s) => `$${s}`)}\n\n${a.body}`;
  if (instructions.includes("'''")) throw new Error(`ai/agents/${a.file}: el cuerpo no puede contener '''`);
  emit(path.join('.codex', 'agents', `${a.name}.toml`), [
    `# ${GEN}`,
    `# Fuente: ai/agents/${a.file}`,
    `name = ${quote(a.name)}`,
    `description = ${quote(a.description)}`,
    `developer_instructions = '''`,
    instructions,
    `'''`,
  ].join('\n'));

  emit(path.join('.opencode', 'agents', `${a.name}.md`), [
    '---',
    `description: ${quote(a.description)}`,
    'mode: subagent',
    'permission:',
    `  edit: ${a.access === 'write' ? 'ask' : 'deny'}`,
    `  webfetch: ${a.web ? 'ask' : 'deny'}`,
    '---',
    '',
    `<!-- ${GEN} -->`,
    '',
    preface(a, (s) => `\`${s}\` (herramienta skill)`),
    '',
    a.body,
  ].join('\n'));
}

// Borra subagentes generados cuya fuente ya no existe.
const names = new Set(agents.map((a) => a.name));
for (const [dir, ext] of [['.claude/agents', '.md'], ['.gemini/agents', '.md'], ['.codex/agents', '.toml'], ['.opencode/agents', '.md']]) {
  const abs = rel(dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const p = path.join(abs, f);
    if (f.endsWith(ext) && !names.has(f.slice(0, -ext.length)) && fs.readFileSync(p, 'utf8').includes('Generado por ai/sync.mjs')) removals.add(p);
  }
}

// ------------------------------------------------------------------ MCP

// Servidores de npm: a través del lanzador con versión fijada. Servidores propios: su script directamente.
const launch = (name) => (mcp[name].script ? [mcp[name].script] : ['ai/mcp/launch.mjs', mcp[name].launch]);
for (const [n, s] of Object.entries(mcp)) {
  if (s.script && !fs.existsSync(rel(s.script))) throw new Error(`ai/mcp/servers.json: no existe ${s.script} (servidor ${n})`);
}

emit('.mcp.json', json({
  mcpServers: Object.fromEntries(Object.keys(mcp).map((n) => [n, { command: 'node', args: launch(n) }])),
}));

const codexMcp = Object.keys(mcp).map((n) => [
  `[mcp_servers.${n}]`,
  `# ${mcp[n].description}`,
  'command = "node"',
  `args = ${JSON.stringify(launch(n))}`,
  ...(mcp[n].optionalEnv?.length ? [`env_vars = ${JSON.stringify(mcp[n].optionalEnv)}`] : []),
  `default_tools_approval_mode = "${mcp[n].effects ? 'prompt' : 'auto'}"`,
].join('\n')).join('\n\n');

emit(path.join('.codex', 'config.toml'), [
  `# ${GEN}`,
  '# Codex se lanza desde la raíz del repositorio. La capa .codex/ del proyecto (hooks incluidos) solo se carga',
  '# si confías en el proyecto; revisa y confía los hooks con /hooks.',
  '',
  codexMcp,
].join('\n'));

// ------------------------------------------------------------------ Hooks y permisos

const hook = (script, p) => `node ai/hooks/${script} --platform=${p}`;
const claudeHook = (script) => `node "$CLAUDE_PROJECT_DIR/ai/hooks/${script}" --platform=claude`;

emit(path.join('.claude', 'settings.json'), json({
  $schema: 'https://json.schemastore.org/claude-code-settings.json',
  permissions: {
    deny: [
      'Read(./**/.env)', 'Read(./**/.env.local)', 'Read(./**/.env.development)', 'Read(./**/.env.production)',
      'Read(./**/.netrc)', 'Read(./**/_netrc)', 'Read(./**/*.pem)', 'Read(./**/*.key)',
      'Bash(git push --force *)', 'Bash(git push -f *)', 'Bash(git reset --hard *)',
      'PowerShell(git push --force *)', 'PowerShell(git push -f *)', 'PowerShell(git reset --hard *)',
      'Bash(npm publish *)', 'PowerShell(npm publish *)',
    ],
    ask: [
      'Bash(git push *)', 'PowerShell(git push *)',
      'Bash(vercel *)', 'PowerShell(vercel *)',
      'Bash(gh release *)', 'Bash(gh pr merge *)',
      // Aprobar y fusionar PR: Claude pide permiso a la persona antes de ejecutarlos.
      'Bash(npm run pr:aprobar*)', 'PowerShell(npm run pr:aprobar*)',
      'Bash(npm run pr:fusionar*)', 'PowerShell(npm run pr:fusionar*)',
      'Bash(node ai/scripts/prs.mjs aprobar*)', 'PowerShell(node ai/scripts/prs.mjs aprobar*)',
      'Bash(node ai/scripts/prs.mjs fusionar*)', 'PowerShell(node ai/scripts/prs.mjs fusionar*)',
    ],
  },
  hooks: {
    // Inicio y mensajes consultan GitHub para avisar de PR pendientes: margen de tiempo para la red.
    SessionStart: [{ hooks: [{ type: 'command', command: claudeHook('session-context.mjs'), timeout: 30 }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: claudeHook('prompt-guard.mjs'), timeout: 30 }] }],
    PreToolUse: [{
      matcher: 'Bash|PowerShell|Write|Edit|MultiEdit|NotebookEdit|Read|Skill',
      hooks: [{ type: 'command', command: claudeHook('pre-tool.mjs'), timeout: 10 }],
    }],
    PostToolUse: [{
      matcher: 'Write|Edit|MultiEdit',
      hooks: [{ type: 'command', command: claudeHook('post-edit.mjs'), timeout: 15 }],
    }],
    // Fin de turno: si un prompt del SDD se ejecutó sin registrarse, pide registrarlo y mostrar el siguiente.
    Stop: [{ hooks: [{ type: 'command', command: claudeHook('fin-turno.mjs'), timeout: 15 }] }],
  },
}));

emit(path.join('.codex', 'hooks.json'), json({
  description: GEN,
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', command: hook('session-context.mjs', 'codex'), timeout: 30 }] }],
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: hook('prompt-guard.mjs', 'codex'), timeout: 30 }] }],
    PreToolUse: [{ matcher: '^(Bash|apply_patch)$', hooks: [{ type: 'command', command: hook('pre-tool.mjs', 'codex'), timeout: 10 }] }],
    PostToolUse: [{ matcher: '^apply_patch$', hooks: [{ type: 'command', command: hook('post-edit.mjs', 'codex'), timeout: 15 }] }],
    Stop: [{ hooks: [{ type: 'command', command: hook('fin-turno.mjs', 'codex'), timeout: 15 }] }],
  },
}));

emit(path.join('.gemini', 'settings.json'), json({
  context: { fileName: ['AGENTS.md'] },
  mcpServers: Object.fromEntries(Object.keys(mcp).map((n) => [n, {
    command: 'node',
    args: launch(n),
    description: mcp[n].description,
  }])),
  hooks: {
    SessionStart: [{ hooks: [{ type: 'command', name: 'uraqi-contexto', command: hook('session-context.mjs', 'gemini'), timeout: 30000 }] }],
    BeforeAgent: [{ hooks: [{ type: 'command', name: 'uraqi-prompt', command: hook('prompt-guard.mjs', 'gemini'), timeout: 30000 }] }],
    BeforeTool: [{
      matcher: 'run_shell_command|write_file|replace|read_file',
      hooks: [{ type: 'command', name: 'uraqi-guardas', command: hook('pre-tool.mjs', 'gemini'), timeout: 10000 }],
    }],
    AfterTool: [{
      matcher: 'write_file|replace',
      hooks: [{ type: 'command', name: 'uraqi-post-edit', command: hook('post-edit.mjs', 'gemini'), timeout: 15000 }],
    }],
    AfterAgent: [{ hooks: [{ type: 'command', name: 'uraqi-fin-turno', command: hook('fin-turno.mjs', 'gemini'), timeout: 15000 }] }],
  },
}));

emit('opencode.json', json({
  $schema: 'https://opencode.ai/config.json',
  mcp: Object.fromEntries(Object.keys(mcp).map((n) => [n, { type: 'local', command: ['node', ...launch(n)], enabled: true }])),
  permission: {
    bash: {
      'git push*': 'ask',
      'git push --force*': 'deny',
      'git push -f*': 'deny',
      'git reset --hard*': 'deny',
      'npm publish*': 'deny',
      'vercel*': 'ask',
      'npm run pr:aprobar*': 'ask',
      'npm run pr:fusionar*': 'ask',
      'node ai/scripts/prs.mjs aprobar*': 'ask',
      'node ai/scripts/prs.mjs fusionar*': 'ask',
    },
  },
}));

emit(path.join('.opencode', 'plugins', 'uraqi-guardas.js'), `// ${GEN}
// Plugin de opencode: aplica las guardas compartidas de ai/hooks/lib/guard.mjs antes de cada herramienta.
// Lanzar un error bloquea la herramienta. Las aprobaciones ("ask") las resuelve "permission" de opencode.json.
import { evaluateTool, evaluatePrompt } from '../../ai/hooks/lib/guard.mjs';
import { currentBranch } from '../../ai/hooks/lib/git.mjs';
import { revisarPromocion } from '../../ai/hooks/lib/promocion.mjs';
import { guardaVibecodear } from '../../ai/hooks/lib/equipo.mjs';

export const UraqiGuardas = async ({ directory }) => ({
  'tool.execute.before': async (input, output) => {
    const result = evaluateTool(input.tool, output.args ?? {}, directory, { branch: currentBranch(directory) });
    if (result.decision === 'deny') throw new Error(result.reason);
    // PR hacia qa o main: revisor de código vivo (bloquea si hay código roto o muerto).
    // vibecodear: no se carga sin saber qué colaborador es la persona (§19).
    const motivo = revisarPromocion(output.args?.command, directory)
      ?? guardaVibecodear({ tool: input.tool, input: output.args ?? {}, cwd: directory, sesion: input.sessionID });
    if (motivo) throw new Error(motivo);
  },
  'chat.message': async (_input, output) => {
    const text = (output?.parts ?? []).filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\\n');
    const result = text ? evaluatePrompt(text) : { decision: null };
    if (result.decision === 'deny') throw new Error(result.reason);
  },
});
`);

// ------------------------------------------------------------------ sdd/README.md (orden de los prompts)

// La tabla del orden global de prompts se genera desde los SDD de sdd/*.md; el resto del README se escribe a mano.
// Cada SDD recibe, dentro de «6. Herramientas del repositorio», las referencias de §31 de su área.
for (const s of cargarSdds(ROOT)) {
  if (!s.meta) continue;
  const abs = rel(s.archivo);
  const texto = fs.readFileSync(abs, 'utf8');
  const refs = s.meta.tipo === 'modulo'
    ? referenciasPara({ modulos: [s.meta.id] }, catalogo)
    // Identificadores del SDD sin contar la sección generada (si no, sus propios «Aplica a» arrastrarían más).
    : referenciasPara({ ids: [...new Set(inyectarBloque(texto, '').match(/\b(?:RF|RNF|MC|RN|CQ|VC|PS)-\d{2,3}\b/g) ?? [])] }, catalogo);
  const nuevo = inyectarBloque(texto, bloqueReferencias(refs, { encabezado: '**Referencias del documento maestro (§31)**' }), { antesDe: '## 7. Riesgos y pendientes' });
  if (nuevo.replace(/\r\n/g, '\n') !== texto.replace(/\r\n/g, '\n')) emit(s.archivo, nuevo);
}

if (fs.existsSync(rel('sdd', 'README.md'))) {
  const readme = fs.readFileSync(rel('sdd', 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  const nuevo = readmeConOrden(readme, cargarSdds(ROOT));
  if (!nuevo) throw new Error('sdd/README.md: faltan las marcas del orden de prompts (<!-- sdd:orden … --> y <!-- /sdd:orden -->)');
  emit(path.join('sdd', 'README.md'), nuevo);
}

// ------------------------------------------------------------------ ai/README.md (ayuda siempre al día)

// Se genera después de la configuración de hooks para documentar exactamente lo que se acaba de emitir.
{
  const { texto, errores } = generarReadme({ root: ROOT, outputs });
  if (errores.length) throw new Error(`ai/README.md no se puede generar:\n- ${errores.join('\n- ')}`);
  emit('ai/README.md', texto);
}

// ------------------------------------------------------------------ Escritura o comprobación

let stale = 0;
for (const [p, content] of outputs) {
  const current = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  // Se ignoran los finales de línea: git puede convertirlos a CRLF en Windows.
  if (current !== null && current.replace(/\r\n/g, '\n') === content.replace(/\r\n/g, '\n')) continue;
  stale += 1;
  if (CHECK) {
    console.log(`desactualizado: ${path.relative(ROOT, p)}`);
  } else {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
    console.log(`escrito: ${path.relative(ROOT, p)}`);
  }
}
for (const p of removals) {
  stale += 1;
  if (CHECK) console.log(`sobra: ${path.relative(ROOT, p)}`);
  else {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`borrado: ${path.relative(ROOT, p)}`);
  }
}

console.log(`${skills.length} skills, ${agents.length} subagentes, ${Object.keys(mcp).length} servidores MCP · ${stale} cambio(s)${CHECK ? ' pendiente(s)' : ''}.`);
if (CHECK && stale) process.exit(1);
