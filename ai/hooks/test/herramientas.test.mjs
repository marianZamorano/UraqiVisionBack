// Pruebas del aviso, la coherencia y la verificación de las herramientas de IA.
// Ejecutar: node --test ai/hooks/test/herramientas.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  clasificarHerramienta, esFuenteDeHerramienta, resumirCambios, textoResumen, analizarDocumento, coherencia,
  revisable, lineasAgregadas, textoAviso, MARCA_AVISO, cargarDocumento,
} from '../lib/herramientas.mjs';
import { parseNameStatus } from '../lib/herramientas-git.mjs';
import { hooksDeAsistentes, guardasResponden, coherenciaTotal, servidoresMcp, hooksDeGitCompletos, hooksDeGitEjecutables } from '../lib/verificacion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const DOC = analizarDocumento([
  '8. Alcance y exclusiones',
  '17.3 Archivos publicados',
  '29. Decisiones pendientes',
  'RF-16', 'RNF-06', 'PS-05', 'DP-06',
].join('\n'));

test('clasifica cada tipo de herramienta y separa lo generado', () => {
  assert.deepEqual(clasificarHerramienta('.agents/skills/ayuda/SKILL.md'), { categoria: 'skill', nombre: 'ayuda', principal: true });
  assert.equal(clasificarHerramienta('.agents/skills/ayuda/references/x.md').principal, false);
  assert.equal(clasificarHerramienta('.agents/skills/speckit-plan/SKILL.md').categoria, 'Spec Kit');
  assert.equal(clasificarHerramienta('ai/agents/revisor-qa.md').categoria, 'subagente');
  assert.equal(clasificarHerramienta('ai/mcp/servers.json').categoria, 'servidor MCP');
  assert.deepEqual(clasificarHerramienta('ai/qa/mcp-servers/qa-evidence/tools.mjs'), { categoria: 'servidor MCP', nombre: 'qa-evidence', principal: false });
  assert.equal(clasificarHerramienta('ai/hooks/lib/guard.mjs').categoria, 'guarda');
  assert.deepEqual(clasificarHerramienta('ai/hooks/git-pre-commit.mjs'), { categoria: 'hook de git', nombre: 'pre-commit', principal: true });
  assert.equal(clasificarHerramienta('.githooks/pre-push').categoria, 'hook de git');
  assert.equal(clasificarHerramienta('ai/hooks/post-edit.mjs').categoria, 'hook de los asistentes');
  assert.equal(clasificarHerramienta('.github/workflows/herramientas.yml').categoria, 'workflow');
  assert.equal(clasificarHerramienta('ai/docs/README.plantilla.md').categoria, 'ayuda');
  assert.equal(clasificarHerramienta('ai/sync.mjs').categoria, 'ayuda');
  assert.equal(clasificarHerramienta('package.json').categoria, 'scripts npm');
  assert.equal(clasificarHerramienta('AGENTS.md').categoria, 'instrucciones de los asistentes');
  for (const g of ['ai/README.md', '.claude/skills/ayuda/SKILL.md', '.mcp.json', 'opencode.json', '.codex/config.toml']) {
    assert.deepEqual(clasificarHerramienta(g), { generado: true }, g);
    assert.equal(esFuenteDeHerramienta(g), false);
  }
  assert.equal(clasificarHerramienta('src/App.tsx'), null);
  assert.equal(clasificarHerramienta('docs/UraqiVisionDocumentoMaestrov1.1.pdf'), null);
});

test('resume las piezas: estado del archivo principal, generados y otros aparte', () => {
  const r = resumirCambios([
    { status: 'A', path: '.agents/skills/nueva/SKILL.md' },
    { status: 'A', path: '.agents/skills/nueva/references/a.md' },
    { status: 'A', path: '.agents/skills/vieja/references/b.md' },
    { status: 'D', path: 'ai/agents/retirado.md' },
    { status: 'M', path: 'ai/README.md' },
    { status: '??', path: '.claude/skills/nueva/SKILL.md' },
    { status: 'M', path: 'src/main.tsx' },
  ]);
  assert.deepEqual(r.piezas.map((p) => [p.categoria, p.nombre, p.estado]), [
    ['skill', 'nueva', 'nueva'], ['skill', 'vieja', 'modificada'], ['subagente', 'retirado', 'borrada'],
  ]);
  assert.equal(r.generados, 2);
  assert.equal(r.otros, 1);
  assert.deepEqual(textoResumen(r), ['- skill: `nueva` (nueva), `vieja` (modificada)', '- subagente: `retirado` (borrada)']);
  assert.deepEqual(resumirCambios([{ status: 'M', path: 'src/x.ts' }]).piezas, []);
});

test('lee identificadores, secciones y decisiones pendientes del documento', () => {
  assert.ok(DOC.ids.has('RF-16') && DOC.ids.has('DP-06'));
  assert.ok(DOC.secciones.has('8') && DOC.secciones.has('17.3') && !DOC.secciones.has('17'));
  assert.deepEqual([...DOC.pendientes], ['DP-06']);
});

test('el documento maestro real tiene los identificadores y secciones que citan las herramientas', () => {
  const doc = cargarDocumento(ROOT);
  assert.ok(doc, 'existe la copia en texto del documento maestro');
  for (const id of ['RF-01', 'RNF-06', 'MC-03', 'RN-13', 'CQ-04', 'VC-01', 'PS-05', 'DP-08']) assert.ok(doc.ids.has(id), id);
  for (const s of ['8', '16', '17.3', '21.1', '28', '29']) assert.ok(doc.secciones.has(s), `§${s}`);
});

test('coherencia: bloquea identificadores y secciones inventados', () => {
  const { errores } = coherencia([
    { path: '.agents/skills/x/SKILL.md', texto: '---\nname: x\ndescription: d\n---\nCumple RF-16 y RF-99 (§17.3, §40).' },
  ], DOC);
  assert.equal(errores.length, 2);
  assert.match(errores[0], /RF-99/);
  assert.doesNotMatch(errores[0], /RF-16/);
  assert.match(errores[1], /§40/);
});

test('coherencia: avisa de decisiones pendientes solo en las líneas nuevas', () => {
  const texto = '---\nname: x\ndescription: d\n---\nHospedaje según DP-06.';
  assert.equal(coherencia([{ path: '.agents/skills/x/SKILL.md', texto, agregadas: 'Hospedaje según DP-06.' }], DOC).avisos.length, 1);
  assert.equal(coherencia([{ path: '.agents/skills/x/SKILL.md', texto, agregadas: 'otra línea' }], DOC).avisos.length, 0);
});

test('coherencia: frontmatter de skills y subagentes, y servidores MCP con effects', () => {
  const skill = coherencia([{ path: '.agents/skills/x/SKILL.md', texto: '---\nname: y\ndescription: d\n---\n' }], DOC);
  assert.match(skill.errores[0], /debe ser «x»/);
  const sinFm = coherencia([{ path: ai('agents/z.md'), texto: 'sin frontmatter' }], DOC);
  assert.match(sinFm.errores[0], /falta el frontmatter/);
  const agente = coherencia([{ path: ai('agents/z.md'), texto: '---\nname: z\ndescription: d\naccess: admin\n---\n' }], DOC);
  assert.match(agente.errores[0], /access/);
  const mcp = coherencia([{ path: 'ai/mcp/servers.json', texto: JSON.stringify({ servers: { a: { description: 'x' }, b: { effects: false } } }) }], DOC);
  assert.equal(mcp.errores.length, 2);
  assert.match(mcp.errores[0], /«a» debe declarar effects/);
  assert.match(mcp.errores[1], /«b» necesita description/);
});

test('coherencia: no revisa pruebas, generados ni archivos ajenos a las herramientas; sin documento, error', () => {
  assert.equal(revisable('ai/hooks/test/guard.test.mjs'), false);
  assert.equal(revisable('ai/README.md'), false);
  assert.equal(revisable('src/App.tsx'), false);
  assert.equal(revisable('.agents/skills/x/SKILL.md'), true);
  assert.equal(coherencia([{ path: 'ai/hooks/test/x.test.mjs', texto: 'RF-99' }], DOC).errores.length, 0);
  assert.match(coherencia([], null).errores[0], /No existe/);
});

test('extrae las líneas agregadas de un diff por archivo', () => {
  const diff = ['diff --git a/a.md b/a.md', '--- a/a.md', '+++ b/a.md', '@@ -1 +1,2 @@', '-viejo', '+nuevo DP-06', '+otra', '--- a/b.md', '+++ /dev/null', '-x'].join('\n');
  const m = lineasAgregadas(diff);
  assert.equal(m.get('a.md'), 'nuevo DP-06\notra');
  assert.equal(m.has('b.md'), false);
  assert.deepEqual(parseNameStatus('M\tai/sync.mjs\nR100\tviejo.md\tnuevo.md\n'), [{ status: 'M', path: 'ai/sync.mjs' }, { status: 'R100', path: 'nuevo.md' }]);
});

test('el aviso menciona a los colaboradores (excepto el autor) y dice qué hacer', () => {
  const t = textoAviso({ numero: 7, titulo: 'feat(ai): x', autor: 'ana', base: 'dev', menciones: ['beto', 'caro'], lineas: ['- skill: `x` (nueva)'] });
  assert.ok(t.startsWith(MARCA_AVISO));
  assert.match(t, /@beto @caro — la PR #7/);
  assert.match(t, /de @ana cambió/);
  assert.match(t, /git switch dev && git pull/);
  assert.match(t, /npm run ai:verificar/);
  assert.match(t, /✔ Coherente/);
  const solo = textoAviso({ numero: 7, titulo: 't', autor: 'ana', base: 'dev', menciones: [], lineas: [], errores: ['e1'] });
  assert.match(solo, /^La PR #7/m);
  assert.match(solo, /✘ Coherencia[\s\S]*- e1/);
});

test('verificación real: hooks configurados, guardas que responden, MCP que arrancan y coherencia total', async () => {
  for (const r of [hooksDeAsistentes(ROOT), guardasResponden(ROOT), coherenciaTotal(ROOT), await servidoresMcp(ROOT), hooksDeGitCompletos(ROOT)[0]]) {
    assert.ok(r.ok, `${r.id}: ${r.detalle}`);
  }
});

test('los hooks de git se ejecutan: un hook 100644 falla y con --chmod=+x pasa', () => {
  const propio = hooksDeGitEjecutables(ROOT);
  assert.equal(propio.id, 'hooks-git-ejecutables');
  assert.ok(propio.ok, propio.detalle);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-hooks-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.mkdirSync(path.join(dir, '.githooks'));
    fs.writeFileSync(path.join(dir, '.githooks', 'pre-push'), '#!/bin/sh\n');
    if (process.platform !== 'win32') fs.chmodSync(path.join(dir, '.githooks', 'pre-push'), 0o644);
    execFileSync('git', ['add', '.githooks/pre-push'], { cwd: dir });
    const antes = hooksDeGitEjecutables(dir);
    assert.equal(antes.ok, false, 'un hook 100644 debe fallar');
    assert.match(antes.detalle, /pre-push/);

    execFileSync('git', ['update-index', '--chmod=+x', '.githooks/pre-push'], { cwd: dir });
    if (process.platform !== 'win32') fs.chmodSync(path.join(dir, '.githooks', 'pre-push'), 0o755);
    const despues = hooksDeGitEjecutables(dir);
    assert.ok(despues.ok, despues.detalle);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function ai(rel) {
  return `ai/${rel}`;
}
