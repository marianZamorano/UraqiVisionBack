// Pruebas de la vigilancia en segundo plano y de la guía paso a paso para activar las herramientas.
// Ejecutar: node --test ai/hooks/test/vigilancia.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PASOS, pasosDe, textoGuia } from '../lib/guia-activacion.mjs';
import { debeRefrescar, decidirAviso, firmaDe, guardarVigilancia, leerVigilancia, INTERVALO_MS, ESPERA_EN_CURSO_MS } from '../lib/vigilancia.mjs';
import { verificar, skillsActivas, specKitActivo, subagentesActivos, mcpAprobadosClaude, nodeVersion } from '../lib/verificacion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const fallo = (id, detalle = 'd', nivel = 'error') => ({ id, ok: false, nivel, detalle });

test('cada comprobación de la verificación tiene su guía paso a paso', async () => {
  const r = await verificar(ROOT, { conPruebas: false });
  const ids = [...new Set([...r.map((x) => x.id), 'pruebas'])];
  for (const id of ids) assert.ok(PASOS[id], `falta la guía de «${id}»`);
  for (const id of Object.keys(PASOS)) {
    const pasos = pasosDe(fallo(id, 'no está instalado'));
    assert.ok(pasos.length >= 2, id);
    assert.match(pasos.at(-1), /npm run ai:activar/, `${id}: termina volviendo a comprobar`);
  }
  assert.match(pasosDe(fallo('desconocida')).join(), /skill `ayuda`/);
});

test('la guía va primero por lo que bloquea, numerada y con pasos', () => {
  const t = textoGuia([fallo('gh', 'GitHub CLI sin sesión iniciada', 'aviso'), fallo('hooks-git-activos', 'core.hooksPath sin configurar')]);
  assert.match(t, /PASO A PASO/);
  assert.match(t, /pide confirmación antes de ejecutar un comando con efectos/);
  assert.match(t, /1\. ✘ hooks-git-activos[\s\S]*a\. Activa los hooks de git de este clon: `npm run hooks:activar`[\s\S]*2\. ⚠ gh[\s\S]*`gh auth login`/);
  assert.doesNotMatch(t, /token[^\n]*pega/i);
});

test('vigilancia: refresca cada 5 minutos salvo que haya una verificación en curso', () => {
  const ahora = 1_000_000_000;
  assert.equal(debeRefrescar(null, ahora), true);
  assert.equal(debeRefrescar({ fecha: ahora - 1000 }, ahora), false);
  assert.equal(debeRefrescar({ fecha: ahora - INTERVALO_MS }, ahora), true);
  assert.equal(debeRefrescar({ fecha: ahora - INTERVALO_MS, enCurso: ahora - 1000 }, ahora), false, 'no lanza dos a la vez');
  assert.equal(debeRefrescar({ fecha: ahora - INTERVALO_MS, enCurso: ahora - ESPERA_EN_CURSO_MS }, ahora), true, 'una verificación colgada no bloquea para siempre');
});

test('vigilancia: avisa una vez por problema y sesión, y avisa cuando todo vuelve a estar activo', () => {
  const resultados = [{ id: 'skills', ok: true }, fallo('hooks-git-activos')];
  const primero = decidirAviso({ resultados }, 's1');
  assert.match(primero.texto, /hooks-git-activos/);
  assert.deepEqual(primero.avisado, { firma: firmaDe([fallo('hooks-git-activos')]), sesion: 's1' });
  assert.equal(decidirAviso({ resultados, avisado: primero.avisado }, 's1').texto, null, 'mismo problema, misma sesión: no repite');
  assert.match(decidirAviso({ resultados, avisado: primero.avisado }, 's2').texto, /hooks-git-activos/, 'sesión nueva: vuelve a guiar');
  assert.match(decidirAviso({ resultados: [...resultados, fallo('gh', 'x', 'aviso')], avisado: primero.avisado }, 's1').texto, /gh/, 'problema nuevo: guía');
  const resuelto = decidirAviso({ resultados: [{ id: 'skills', ok: true }], avisado: primero.avisado }, 's1');
  assert.match(resuelto.texto, /vuelven a estar todas activas/);
  assert.equal(resuelto.avisado, null);
  assert.equal(decidirAviso({ resultados: [{ id: 'skills', ok: true }] }, 's1').texto, null, 'todo bien desde el principio: silencio');
  assert.equal(decidirAviso(null, 's1').texto, null, 'sin verificación aún: silencio');
});

test('vigilancia: el resultado se guarda en .git del clon y se mezcla', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-vig-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    assert.equal(leerVigilancia(dir), null);
    guardarVigilancia(dir, { enCurso: 1 });
    guardarVigilancia(dir, { fecha: 2, resultados: [] });
    assert.deepEqual(leerVigilancia(dir), { enCurso: 1, fecha: 2, resultados: [] });
    assert.ok(fs.existsSync(path.join(dir, '.git', 'uraqi-vigilancia.json')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('comprobaciones nuevas en el repositorio real: skills, Spec Kit, subagentes y Node', () => {
  for (const r of [skillsActivas(ROOT), specKitActivo(ROOT), subagentesActivos(ROOT), nodeVersion()]) assert.ok(r.ok, `${r.id}: ${r.detalle}`);
  assert.equal(mcpAprobadosClaude(ROOT).nivel, 'aviso');
});

test('las comprobaciones detectan lo que falta en un repositorio incompleto', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-vig-'));
  try {
    const crear = (rel, txt = 'x') => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), txt); };
    crear('.agents/skills/ayuda/SKILL.md');
    crear('.agents/skills/speckit-plan/SKILL.md');
    crear('.claude/skills/speckit-plan/SKILL.md');
    crear('ai/agents/revisor-qa.md');
    crear('.claude/agents/revisor-qa.md');
    crear('.mcp.json', JSON.stringify({ mcpServers: { context7: {} } }));
    crear('.claude/settings.local.json', JSON.stringify({ disabledMcpjsonServers: ['context7'], enableAllProjectMcpServers: true }));
    assert.match(skillsActivas(dir).detalle, /sin copia para Claude Code: ayuda/);
    assert.match(specKitActivo(dir).detalle, /Gemini CLI: speckit\.plan[\s\S]*opencode: speckit\.plan/);
    assert.match(subagentesActivos(dir).detalle, /Gemini CLI: revisor-qa/);
    assert.match(mcpAprobadosClaude(dir).detalle, /context7/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
