#!/usr/bin/env node
// Microauditoría de UraqiVision: reúne la evidencia de los últimos cambios de un repositorio.
// Solo lectura: usa git y, si está disponible, gh. No escribe archivos ni lee .env/.netrc.
//
//   node .agents/skills/microauditoria/scripts/evidencia.mjs                 últimos 7 días de HEAD
//   node .agents/skills/microauditoria/scripts/evidencia.mjs --dias 3
//   node .agents/skills/microauditoria/scripts/evidencia.mjs --desde origin/qa   lo que dev aún no promovió
//   node .agents/skills/microauditoria/scripts/evidencia.mjs --desde 2026-11-12
//   node .agents/skills/microauditoria/scripts/evidencia.mjs --repo ../uraqiVision   otro repositorio local
//   ... --rama origin/dev   (por defecto HEAD)   ... --json   (salida para otras herramientas)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const JSON_OUT = args.includes('--json');
const dias = Number(opt('--dias', '7'));
const desde = opt('--desde', null);
const rama = opt('--rama', 'HEAD');
const repo = resolve(opt('--repo', '.'));

function run(cmd, a, { tolerante = false } = {}) {
  try {
    return execFileSync(cmd, a, {
      cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20,
    }).trim();
  } catch (e) {
    if (tolerante) return null;
    throw e;
  }
}
const git = (...a) => run('git', a);
const gitT = (...a) => run('git', a, { tolerante: true });

if (gitT('rev-parse', '--is-inside-work-tree') !== 'true') {
  console.error(`No es un repositorio git: ${repo}`);
  process.exit(2);
}

// ---------- Rango ----------
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '');
let rango; let fechaInicio;
if (desde && !esFecha(desde)) {
  rango = [`${desde}..${rama}`];
  fechaInicio = gitT('log', '-1', '--format=%cs', desde);
} else {
  fechaInicio = esFecha(desde)
    ? desde
    : new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
  rango = [`--since=${fechaInicio}T00:00:00`, rama];
}
const descRango = desde && !esFecha(desde) ? `${desde}..${rama}` : `${rama} desde ${fechaInicio}`;

// ---------- Commits ----------
const IDENT = /\b(?:RF|RNF|MC|RN|CQ|VC|PS|DP|OE|CU|HU)-\d{2}\b|\bM-[A-ZÁÉÍÓÚ]{3,}\b/g;
const log = git('log', ...rango, '--no-merges', '--format=@@%h%x1f%aI%x1f%an%x1f%s', '--name-status');
const commits = [];
for (const linea of log.split('\n')) {
  if (linea.startsWith('@@')) {
    const [hash, fecha, autor, asunto] = linea.slice(2).split('\x1f');
    commits.push({
      hash, fecha, autor, asunto,
      issues: [...new Set((asunto.match(/#\d+/g) ?? []))],
      identificadores: [...new Set((asunto.match(IDENT) ?? []))],
      archivos: [],
    });
  } else if (linea.trim() && commits.length) {
    const partes = linea.split('\t');
    commits.at(-1).archivos.push({ estado: partes[0][0], ruta: partes.at(-1), anterior: partes.length > 2 ? partes[1] : null });
  }
}

const merges = (gitT('log', ...rango, '--merges', '--format=%h%x1f%aI%x1f%s') ?? '')
  .split('\n').filter(Boolean).map((l) => {
    const [hash, fecha, asunto] = l.split('\x1f');
    const pr = asunto.match(/pull request #(\d+)/)?.[1] ?? null;
    return { hash, fecha, asunto, pr: pr ? Number(pr) : null };
  });

// ---------- Áreas ----------
const GENERADOS = ['.claude/', '.gemini/', '.codex/', '.opencode/', '.mcp.json', 'opencode.json'];
const AREAS = [
  ['Decisiones y reglas', ['AGENTS.md', 'CLAUDE.md', 'docs/', '.specify/memory/', 'specs/']],
  ['Herramientas de IA', ['.agents/', 'ai/', '.specify/']],
  ['CI y repositorio', ['.github/', '.githooks/', '.husky/', '.gitattributes','package.json', 'package-lock.json', 'commitlint', '.gitignore', '.env.example', '.editorconfig']],
];
const esGenerado = (r) => GENERADOS.some((g) => r === g || r.startsWith(g));
const areaDe = (r) => (esGenerado(r) ? 'Generados (ai/sync.mjs)' : AREAS.find(([, ps]) => ps.some((p) => r === p || r.startsWith(p)))?.[0] ?? 'Código y datos');

const porArea = {};
const archivosTocados = new Map(); // ruta -> {estado final, commits}
for (const c of [...commits].reverse()) {
  for (const f of c.archivos) {
    const a = areaDe(f.ruta);
    porArea[a] ??= new Set();
    porArea[a].add(f.ruta);
    const prev = archivosTocados.get(f.ruta);
    archivosTocados.set(f.ruta, { estado: f.estado, commits: [...(prev?.commits ?? []), c.hash] });
  }
}

// Archivos que suelen registrar decisiones: el agente debe leer su diff.
const DECISION = /^(AGENTS\.md|CLAUDE\.md|docs\/|\.specify\/memory\/|specs\/|ai\/mcp\/servers\.json|package\.json|\.env\.example|\.github\/workflows\/)/;
const archivosDecision = [...archivosTocados.entries()]
  .filter(([r]) => DECISION.test(r))
  .map(([ruta, v]) => ({ ruta, estado: v.estado, commits: v.commits }));

// ---------- Comprobaciones ----------
const hallazgos = [];
const sinIssue = commits.filter((c) => c.issues.length === 0);
if (sinIssue.length) hallazgos.push({ nivel: 'error', regla: 'Trazabilidad', detalle: `${sinIssue.length} commit(s) sin #issue: ${sinIssue.map((c) => c.hash).join(', ')}` });
const sinId = commits.filter((c) => c.identificadores.length === 0);
if (sinId.length) hallazgos.push({ nivel: 'aviso', regla: 'Identificadores', detalle: `${sinId.length} de ${commits.length} commit(s) no citan RF/RNF/MC/RN/CQ/VC/PS/M-*` });

// Referencias colgantes: skills, subagentes o servidores MCP borrados que siguen nombrándose.
const borrados = new Set();
for (const [ruta, v] of archivosTocados) {
  if (v.estado !== 'D' || esGenerado(ruta)) continue;
  const m = ruta.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/) ?? ruta.match(/^ai\/agents\/([^/]+)\.md$/);
  if (m && !existsSync(join(repo, ruta))) borrados.add(m[1]);
}
const colgantes = [];
for (const nombre of borrados) {
  const hits = (gitT('grep', '-l', '-F', '-e', nombre) ?? '').split('\n').filter((r) => r && !esGenerado(r));
  if (hits.length) colgantes.push({ nombre, archivos: hits });
}
if (colgantes.length) hallazgos.push({ nivel: 'aviso', regla: 'Referencias colgantes', detalle: colgantes.map((c) => `${c.nombre} → ${c.archivos.join(', ')}`).join(' | ') });

// Código cambiado sin pruebas en el mismo rango (heurística).
const codigo = [...(porArea['Código y datos'] ?? [])];
const esPrueba = (r) => /(^|\/)(tests?|__tests__|e2e)\/|\.(test|spec)\.[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.py$/.test(r);
const codigoSinPrueba = codigo.filter((r) => !esPrueba(r) && /\.(py|ts|tsx|js|jsx|mjs)$/.test(r));
if (codigoSinPrueba.length && !codigo.some(esPrueba)) hallazgos.push({ nivel: 'aviso', regla: 'Pruebas', detalle: `${codigoSinPrueba.length} archivo(s) de código cambiaron y ninguna prueba en el rango` });

// Archivos generados al día.
let sync = null;
if (existsSync(join(repo, 'ai/sync.mjs'))) {
  const r = spawnSync(process.execPath, ['ai/sync.mjs', '--check'], { cwd: repo, encoding: 'utf8' });
  sync = { ok: r.status === 0, resumen: (r.stdout ?? '').trim().split('\n').at(-1) };
  if (!sync.ok) hallazgos.push({ nivel: 'error', regla: 'Generados', detalle: `ai/sync.mjs --check: ${sync.resumen}` });
}

// Árbol de trabajo.
const sucio = (gitT('status', '--porcelain') ?? '').split('\n').filter(Boolean);
if (sucio.length) hallazgos.push({ nivel: 'aviso', regla: 'Sin commitear', detalle: `${sucio.length} archivo(s) con cambios locales` });

// Estructura de variables de entorno (solo el hecho de que cambió; nunca valores).
if (archivosTocados.has('.env.example')) hallazgos.push({ nivel: 'aviso', regla: 'Entorno', detalle: '.env.example cambió: confirma que el cambio de estructura se comunicó al equipo' });

// ---------- GitHub (opcional) ----------
let github = null;
if (gitT('remote', 'get-url', 'origin') && run('gh', ['--version'], { tolerante: true })) {
  const pj = (a) => { const s = run('gh', a, { tolerante: true }); try { return s ? JSON.parse(s) : null; } catch { return null; } };
  github = {
    prsFusionadas: pj(['pr', 'list', '--state', 'merged', '--search', `merged:>=${fechaInicio}`, '--limit', '50', '--json', 'number,title,baseRefName,headRefName,mergedAt,url']),
    prsAbiertas: pj(['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,baseRefName,headRefName,isDraft,url']),
    issues: pj(['issue', 'list', '--state', 'all', '--search', `updated:>=${fechaInicio}`, '--limit', '50', '--json', 'number,title,state,labels']),
  };
}

// ---------- Salida ----------
const datos = {
  repositorio: gitT('remote', 'get-url', 'origin') ?? repo,
  rama: gitT('rev-parse', '--abbrev-ref', 'HEAD'),
  rango: descRango,
  commits: commits.map(({ archivos, ...c }) => ({ ...c, archivos: archivos.length })),
  merges,
  areas: Object.fromEntries(Object.entries(porArea).map(([a, s]) => [a, [...s].sort()])),
  archivosDecision,
  hallazgos,
  sync,
  github,
};

if (JSON_OUT) {
  console.log(JSON.stringify(datos, null, 2));
  process.exit(0);
}

const L = [];
L.push(`# Evidencia · ${datos.repositorio}`, `Rama actual: ${datos.rama} · Rango: ${datos.rango}`, '');
L.push(`## Commits (${commits.length}) y merges (${merges.length})`);
for (const c of commits) L.push(`- ${c.hash} ${c.fecha.slice(0, 10)} ${c.autor}: ${c.asunto}`);
for (const m of merges) L.push(`- merge ${m.hash} ${m.fecha.slice(0, 10)}: ${m.asunto}`);
L.push('', '## Archivos por área');
for (const [a, rs] of Object.entries(datos.areas)) {
  L.push(`- **${a}** (${rs.length})${a.startsWith('Generados') ? '' : ': ' + rs.slice(0, 15).join(', ') + (rs.length > 15 ? ', …' : '')}`);
}
L.push('', '## Archivos que registran decisiones (lee su diff)');
if (!archivosDecision.length) L.push('- Ninguno en el rango.');
for (const d of archivosDecision) L.push(`- ${d.estado} ${d.ruta} (${d.commits.join(', ')})`);
L.push('', '## Comprobaciones automáticas');
if (!hallazgos.length) L.push('- Sin hallazgos.');
for (const h of hallazgos) L.push(`- ${h.nivel === 'error' ? '❌' : '⚠️'} ${h.regla}: ${h.detalle}`);
if (sync?.ok) L.push(`- ✅ Generados: ${sync.resumen}`);
if (github) {
  L.push('', '## GitHub');
  for (const p of github.prsFusionadas ?? []) L.push(`- PR #${p.number} fusionada ${p.mergedAt.slice(0, 10)} (${p.headRefName} → ${p.baseRefName}): ${p.title}`);
  for (const p of github.prsAbiertas ?? []) L.push(`- PR #${p.number} abierta${p.isDraft ? ' (borrador)' : ''} (${p.headRefName} → ${p.baseRefName}): ${p.title}`);
  for (const i of github.issues ?? []) L.push(`- Issue #${i.number} ${i.state.toLowerCase()} [${i.labels.map((l) => l.name).join(', ')}]: ${i.title}`);
} else {
  L.push('', '_gh no disponible: sin datos de PR ni issues._');
}
console.log(L.join('\n'));
