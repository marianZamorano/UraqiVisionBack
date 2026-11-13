// Pruebas del SDD por área: estructura, estado e historial, conflictos, siguiente prompt y hooks.
// Ejecutar: node --test ai/hooks/test/sdd.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parsearSdd, validar, estados, siguiente, paraAsistente, difiere, idEnMensaje, textoSiguiente, cargarSdds,
  todosLosPrompts, readmeConOrden, escribirEntrada, leerHistorial, guardarEnCurso, leerEnCurso, hashPrompt, SECCIONES,
} from '../lib/sdd.mjs';
import { contextoDePromptSdd, motivoDeFinSdd } from '../lib/sdd-hooks.mjs';
import { cargarEquipo, colaboradores } from '../lib/equipo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function prompt(id, { orden, deps = '—', ejecuta = 'Joaco', comando = 'speckit-specify', texto } = {}) {
  return [
    `### ${id} · Paso ${id}`,
    `- **Orden:** ${orden}`, '- **Fase:** 2 · Especificación', `- **Comando:** ${comando}`, `- **Ejecuta:** ${ejecuta}`,
    '- **Revisa:** Marian', `- **Depende de:** ${deps}`, '- **Momento:** Sáb', '- **Produce:** spec.md',
    '- **Herramientas:** skill `x`', '- **Verificación:** prueba', '', '```text', texto ?? `[SDD ${id}] /${comando} hacer ${id}`, '```', '',
  ].join('\n');
}
function sdd({ id = 'M-MAPA', prefijo = 'MAPA', prompts = '', secciones = SECCIONES } = {}) {
  return [`---\nid: ${id}\ntitulo: T\ntipo: modulo\nprefijo: ${prefijo}\nspec: specs/x\n---`, '# SDD',
    ...secciones.map((s) => (s === '8. Secuencia de prompts' ? `## ${s}\n\n${prompts}` : `## ${s}\n\ntexto`))].join('\n\n');
}
const CTX = { colaboradores: ['Joaco', 'Marian', 'Angie'], repoModulos: ['M-MAPA'], skills: ['speckit-specify', 'speckit-plan'] };

test('lee un SDD: frontmatter, secciones y prompts con sus datos', () => {
  const s = parsearSdd(sdd({ prompts: prompt('P-MAPA-01', { orden: 1 }) + prompt('P-MAPA-02', { orden: 2, deps: 'P-MAPA-01', ejecuta: 'Joaco, Marian', comando: 'speckit-plan' }) }), 'sdd/m-mapa.md');
  assert.equal(s.meta.id, 'M-MAPA');
  assert.deepEqual(s.secciones, SECCIONES);
  assert.deepEqual(s.prompts.map((p) => [p.id, p.orden, p.dependencias, p.ejecutores]), [['P-MAPA-01', 1, [], ['Joaco']], ['P-MAPA-02', 2, ['P-MAPA-01'], ['Joaco', 'Marian']]]);
  assert.equal(s.prompts[1].texto, '[SDD P-MAPA-02] /speckit-plan hacer P-MAPA-02');
  assert.equal(s.prompts[1].hash, hashPrompt('[SDD P-MAPA-02] /speckit-plan hacer P-MAPA-02'));
  assert.deepEqual(validar([s], CTX), []);
});

test('valida la estructura común y rechaza cada desvío', () => {
  const malo = parsearSdd(sdd({
    secciones: SECCIONES.filter((x) => x !== '7. Riesgos y pendientes'),
    prompts: [
      prompt('P-MAPA-01', { orden: 2, deps: 'P-MAPA-03' }),
      prompt('P-MAPA-02', { orden: 1, ejecuta: 'Pepe' }),
      prompt('P-MAPA-02', { orden: 1 }),
      prompt('P-GLOBO-01', { orden: 3, texto: 'sin etiqueta /speckit-specify' }),
      prompt('P-MAPA-03', { orden: 4, comando: 'speckit-inventado' }),
      prompt('P-MAPA-04', { orden: 5, comando: 'speckit-plan', texto: '[SDD P-MAPA-04] /speckit-specify otra cosa' }),
    ].join(''),
  }), 'sdd/m-mapa.md');
  const e = validar([malo], CTX).join('\n');
  assert.match(e, /faltan secciones obligatorias: 7\. Riesgos y pendientes/);
  assert.match(e, /depende de P-MAPA-03, que va después/);
  assert.match(e, /«Pepe» no figura en §19/);
  assert.match(e, /identificador repetido/);
  assert.match(e, /Orden 1 repetido/);
  assert.match(e, /P-GLOBO-01: el identificador debe ser P-MAPA-NN/);
  assert.match(e, /debe empezar con «\[SDD P-GLOBO-01\]»/);
  assert.match(e, /«speckit-inventado» no es una skill/);
  assert.match(e, /P-MAPA-04: el prompt no invoca \/speckit-plan/);
  assert.match(validar([parsearSdd('# sin frontmatter', 'sdd/x.md')], CTX).join(), /falta el frontmatter/);
  assert.match(validar([parsearSdd(sdd({ id: 'M-GLOBO', prompts: prompt('P-MAPA-01', { orden: 1 }) }), 'sdd/x.md')], CTX).join(), /no es de este repositorio/);
});

test('los SDD reales del repositorio son válidos y el README tiene su orden al día', () => {
  const sdds = cargarSdds(ROOT);
  const { modulos, repoModulos } = cargarEquipo(ROOT);
  const skills = fs.readdirSync(path.join(ROOT, '.agents/skills'));
  assert.ok(sdds.length >= 6, 'un SDD por área de este repositorio, más proyecto e integración');
  assert.deepEqual(validar(sdds, { colaboradores: colaboradores(modulos), repoModulos, skills }), []);
  for (const m of repoModulos) assert.ok(sdds.some((s) => s.meta.id === m), `falta el SDD de ${m}`);
  const readme = fs.readFileSync(path.join(ROOT, 'sdd/README.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(readmeConOrden(readme, sdds), readme, 'sdd/README.md desactualizado: npm run ai:sync');
});

test('estado, conflictos y siguiente prompt a partir del historial', () => {
  const s = parsearSdd(sdd({ prompts: prompt('P-MAPA-01', { orden: 1 }) + prompt('P-MAPA-02', { orden: 2, deps: 'P-MAPA-01' }) + prompt('P-MAPA-03', { orden: 3, deps: 'P-MAPA-02', ejecuta: 'Marian' }) }), 'sdd/m-mapa.md');
  const ps = s.prompts;
  const r = (id, resultado, fecha, hash = ps.find((p) => p.id === id).hash) => ({ tipo: 'resultado', id, resultado, fecha, hash, colaborador: 'Joaco' });

  let est = estados(ps, []);
  assert.equal(siguiente(ps, est).prompt.id, 'P-MAPA-01');
  est = estados(ps, [r('P-MAPA-01', 'hecho', '2026-11-14T09:00:00Z')]);
  assert.equal(siguiente(ps, est, { despues: 'P-MAPA-01' }).prompt.id, 'P-MAPA-02');
  assert.equal(siguiente(ps, est, { persona: 'Marian' }).bloqueadoPor[0], 'P-MAPA-02', 'el de Marian espera su dependencia');

  est = estados(ps, [r('P-MAPA-01', 'hecho', '2026-11-14T09:00:00Z'), r('P-MAPA-02', 'parcial', '2026-11-14T10:00:00Z')]);
  const cont = siguiente(ps, est, { despues: 'P-MAPA-02' });
  assert.equal(cont.prompt.id, 'P-MAPA-02');
  assert.ok(cont.continuar);
  assert.match(textoSiguiente(cont, est), /Continúa el mismo prompt \(quedó «parcial»\)/);

  est = estados(ps, [
    r('P-MAPA-01', 'hecho', '2026-11-14T09:00:00Z'),
    r('P-MAPA-02', 'hecho', '2026-11-14T10:00:00Z', 'hash-viejo'),
    r('P-MAPA-01', 'hecho', '2026-11-14T11:00:00Z'),
    r('P-MAPA-03', 'conflicto', '2026-11-14T12:00:00Z'),
  ]);
  assert.match(est.get('P-MAPA-02').conflictos.join(), /cambió después de ejecutarse/);
  assert.match(est.get('P-MAPA-02').conflictos.join(), /P-MAPA-01 se ejecutó de nuevo después/);
  assert.match(est.get('P-MAPA-03').conflictos.join(), /marcado como conflicto/);
  assert.equal(siguiente(ps, estados(ps, ps.map((p) => r(p.id, 'hecho', '2026-11-14T09:00:00Z')))), null);
  assert.match(textoSiguiente(null, est), /No quedan prompts pendientes/);
});

test('adapta los comandos a cada asistente y detecta prompts modificados', () => {
  const t = '[SDD P-MAPA-01] /speckit-specify algo y luego /speckit-plan';
  assert.equal(paraAsistente(t, 'claude'), t);
  assert.equal(paraAsistente(t, 'codex'), '[SDD P-MAPA-01] $speckit-specify algo y luego $speckit-plan');
  assert.equal(paraAsistente(t, 'gemini'), '[SDD P-MAPA-01] /speckit.specify algo y luego /speckit.plan');
  assert.equal(idEnMensaje(`hola\n${t}`), 'P-MAPA-01');
  assert.equal(idEnMensaje('sin etiqueta'), null);
  assert.equal(difiere(`Ejecuta esto: ${paraAsistente(t, 'gemini')}`, t), false, 'el formato del asistente no cuenta como cambio');
  assert.equal(difiere(`${t} y además otra cosa`, t), true);
});

test('de punta a punta: confirmar, ejecutar, fin de turno exige registrar y el registro lo libera', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-sdd-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.mkdirSync(path.join(dir, 'sdd'));
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.copyFileSync(path.join(ROOT, 'docs/UraqiVisionDocumentoMaestrov1.0.txt'), path.join(dir, 'docs/UraqiVisionDocumentoMaestrov1.0.txt'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ uraqi: { modulos: ['M-MAPA'] } }));
    fs.writeFileSync(path.join(dir, 'sdd/m-mapa.md'), sdd({ prompts: prompt('P-MAPA-01', { orden: 1 }) + prompt('P-MAPA-02', { orden: 2, deps: 'P-MAPA-01' }) }));

    const ctx = contextoDePromptSdd({ prompt: '[SDD P-MAPA-02] /speckit-specify hacer P-MAPA-02', cwd: dir, sesion: 's1' });
    assert.match(ctx, /Prompt P-MAPA-02/);
    assert.match(ctx, /Primero identifica a la persona/);
    assert.match(ctx, /Dependencias sin terminar: P-MAPA-01/);
    assert.match(ctx, /OPCIÓN MÚLTIPLE[\s\S]*Ejecutar tal cual[\s\S]*Modificarlo antes de ejecutar[\s\S]*Posponer u omitir/);
    assert.doesNotMatch(ctx, /MODIFICACIÓN/);
    assert.equal(leerEnCurso(dir).estado, 'por-confirmar');
    assert.match(contextoDePromptSdd({ prompt: '[SDD P-MAPA-02] /speckit-specify otra cosa', cwd: dir, sesion: 's1' }), /es una MODIFICACIÓN/);
    assert.match(contextoDePromptSdd({ prompt: '[SDD P-MAPA-99] x', cwd: dir, sesion: 's1' }), /no existe en sdd/);

    assert.equal(motivoDeFinSdd({ cwd: dir, sesion: 's1' }), null, 'esperando la confirmación de la persona: no insiste');
    guardarEnCurso(dir, { id: 'P-MAPA-02', sesion: 's1', estado: 'en-ejecucion', inicio: new Date(Date.now() - 1000).toISOString() });
    assert.match(motivoDeFinSdd({ cwd: dir, sesion: 's1' }), /se ejecutó y todavía no está en el historial[\s\S]*registrar P-MAPA-02[\s\S]*siguiente prompt/);
    assert.equal(motivoDeFinSdd({ cwd: dir, sesion: 's1', stopHookActive: true }), null, 'no insiste dos veces seguidas');
    assert.equal(motivoDeFinSdd({ cwd: dir, sesion: 's2' }), null, 'otra sesión no se bloquea');

    escribirEntrada(dir, { tipo: 'resultado', id: 'P-MAPA-02', resultado: 'hecho', colaborador: 'Joaco', nota: 'ok', hash: 'x' });
    assert.equal(motivoDeFinSdd({ cwd: dir, sesion: 's1' }), null, 'registrado: termina');
    const h = leerHistorial(dir);
    assert.equal(h.length, 1);
    assert.match(h[0].archivo, /^sdd\/historial\/.+_P-MAPA-02_Joaco_resultado\.json$/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
