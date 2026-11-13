// Pruebas del equipo (§19), la identificación del colaborador y los avisos de apoyo a otro rol.
// Ejecutar: node --test ai/hooks/test/equipo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parsearEquipo, expandirRequisitos, colaboradores, opciones, evaluarAlcance, textoApoyo, identidadVigente,
  nombreDeComandoSoy, cargaVibecodear, textoPedirIdentidad, guardaVibecodear, avisoDeApoyo, leerIdentidad,
  normalizarNombre, VIGENCIA_SIN_SESION_MS,
} from '../lib/equipo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOC = fs.readFileSync(path.join(ROOT, 'docs/UraqiVisionDocumentoMaestrov1.0.txt'), 'utf8');
const MODULOS = parsearEquipo(DOC);
const FRONT = ['M-GLOBO', 'M-MAPA', 'M-ATLAS', 'M-INTERFAZ'];
const BACK = ['M-INGESTA', 'M-CIENCIA', 'M-VALIDACIÓN', 'M-PUBLICACIÓN', 'M-INSIGHT'];
const mod = (id) => MODULOS.find((m) => m.id === id);

test('lee los nueve módulos de §19 del documento maestro con responsables, apoyo y revisores', () => {
  assert.deepEqual(MODULOS.map((m) => m.id), [...BACK, ...FRONT]);
  assert.deepEqual(mod('M-GLOBO'), { id: 'M-GLOBO', responsabilidad: mod('M-GLOBO').responsabilidad, requisitos: ['RF-02', 'RF-25', 'RF-26', 'RF-27', 'RF-28', 'RF-29', 'RF-30', 'RF-32'], responsables: ['Joaco'], apoyo: ['Angie', 'Marian'], revisores: ['Angie'] });
  assert.deepEqual([mod('M-VALIDACIÓN').responsables, mod('M-VALIDACIÓN').apoyo, mod('M-VALIDACIÓN').revisores], [['Tabata'], ['Alex'], ['Mimi']]);
  assert.deepEqual(mod('M-ATLAS').responsables, ['Angie', 'Marian']);
  assert.deepEqual(mod('M-MAPA').requisitos, ['RF-05', 'RF-06', 'RF-07', 'RF-08', 'RF-10', 'RF-35', 'RF-36', 'RF-38']);
  assert.match(mod('M-INSIGHT').responsabilidad, /serverless/);
  assert.deepEqual(colaboradores(MODULOS).sort(), ['Alex', 'Angie', 'Joaco', 'Marian', 'Mimi', 'Tabata']);
});

test('expande rangos de requisitos', () => {
  assert.deepEqual(expandirRequisitos('MC-02 a MC-04, RF-10'), ['MC-02', 'MC-03', 'MC-04', 'RF-10']);
  assert.deepEqual(expandirRequisitos('CQ-01 a CQ-03'), ['CQ-01', 'CQ-02', 'CQ-03']);
});

test('opción múltiple: hasta cuatro personas con rol en el repositorio, el resto como otros', () => {
  const f = opciones(MODULOS, FRONT);
  assert.deepEqual(f.opciones.map((o) => o.nombre), ['Joaco', 'Angie', 'Marian', 'Mimi']);
  assert.deepEqual(f.otros, ['Alex', 'Tabata']);
  assert.match(f.opciones[0].descripcion, /^Aquí: responsable de M-GLOBO, M-MAPA/);
  assert.match(f.opciones[3].descripcion, /^Aquí: revisa M-INTERFAZ\. En todo el proyecto: responsable de M-PUBLICACIÓN, M-INSIGHT/);
  const b = opciones(MODULOS, BACK);
  assert.deepEqual(b.opciones.map((o) => o.nombre), ['Alex', 'Tabata', 'Mimi', 'Marian']);
  assert.deepEqual(b.otros, ['Joaco', 'Angie']);
  const t = textoPedirIdentidad({ modulos: MODULOS, repoModulos: FRONT });
  assert.match(t, /OPCIÓN MÚLTIPLE/);
  assert.match(t, /AskUserQuestion/);
  assert.match(t, /1\. Joaco[\s\S]*4\. Mimi/);
  assert.match(t, /No lo deduzcas/);
  assert.equal(normalizarNombre('marian', MODULOS), 'Marian');
  assert.equal(normalizarNombre('Pepe', MODULOS), null);
});

test('alcance: propio, apoyo a otra persona, otro repositorio y transversal', () => {
  const marian = evaluarAlcance({ nombre: 'Marian', refs: ['RF-01', 'RF-02', 'RF-05', 'MC-03', 'RNF-06'], modulos: MODULOS, repoModulos: FRONT });
  assert.deepEqual(marian.propios.sort(), ['M-ATLAS', 'M-GLOBO']);
  assert.deepEqual(marian.apoyo.map((a) => a.modulo), ['M-MAPA'], 'RF-05 cuenta como M-MAPA en el frontend, no como M-PUBLICACIÓN');
  assert.deepEqual(marian.otroRepo.map((a) => a.modulo), ['M-CIENCIA']);
  assert.deepEqual(marian.sinModulo, ['RNF-06']);
  const t = textoApoyo(marian, 'Marian');
  assert.match(t, /vas a apoyar el rol de otra persona: M-MAPA es de Joaco y tú lo revisas/);
  assert.match(t, /M-CIENCIA no está en este repositorio \(es de Tabata\): derívalo/);
  assert.match(t, /Avísale/);
  const enBack = evaluarAlcance({ nombre: 'Marian', refs: ['RF-02', 'RF-16'], modulos: MODULOS, repoModulos: BACK });
  assert.deepEqual([enBack.propios, enBack.propiosOtroRepo], [[], ['M-GLOBO']], 'su módulo del frontend no es «tuyo» en el backend');
  assert.match(textoApoyo(enBack, 'Marian'), /M-INSIGHT es de Mimi y tú lo revisas[\s\S]*↪ M-GLOBO es tuyo, pero vive en el otro repositorio/);
  assert.equal(textoApoyo(evaluarAlcance({ nombre: 'Joaco', refs: ['RF-05', 'M-GLOBO'], modulos: MODULOS, repoModulos: FRONT }), 'Joaco'), null);
  const alex = evaluarAlcance({ nombre: 'Alex', refs: ['RF-10'], modulos: MODULOS, repoModulos: BACK });
  assert.deepEqual(alex.propios, ['M-VALIDACIÓN'], 'el apoyo que §19 asigna cuenta como propio');
});

test('identidad: vale para su sesión o, sin id de sesión, 12 horas', () => {
  const ahora = Date.now();
  assert.equal(identidadVigente({ nombre: 'Marian', fecha: ahora, sesion: 's1' }, 's1'), true);
  assert.equal(identidadVigente({ nombre: 'Marian', fecha: ahora, sesion: 's1' }, 's2'), false);
  assert.equal(identidadVigente({ nombre: 'Marian', fecha: ahora }, 's1'), false);
  assert.equal(identidadVigente({ nombre: 'Marian', fecha: ahora }, undefined), true);
  assert.equal(identidadVigente({ nombre: 'Marian', fecha: ahora - VIGENCIA_SIN_SESION_MS - 1 }, undefined), false);
  assert.equal(identidadVigente(null, 's1'), false);
});

test('detecta el registro de identidad y la carga de vibecodear en cada asistente', () => {
  assert.equal(nombreDeComandoSoy('node ai/scripts/equipo.mjs soy Marian'), 'Marian');
  assert.equal(nombreDeComandoSoy('node "ai/scripts/equipo.mjs" soy "Angie"'), 'Angie');
  assert.equal(nombreDeComandoSoy('npm run equipo:soy -- Joaco'), 'Joaco');
  assert.equal(nombreDeComandoSoy('node ai/scripts/equipo.mjs quien'), null);
  assert.equal(cargaVibecodear('Skill', { skill: 'vibecodear' }), true);
  assert.equal(cargaVibecodear('Skill', { skill: 'uraqi:vibecodear' }), true);
  assert.equal(cargaVibecodear('Skill', { skill: 'ayuda' }), false);
  assert.equal(cargaVibecodear('read_file', { absolute_path: 'C:\\repo\\.agents\\skills\\vibecodear\\SKILL.md' }), true);
  assert.equal(cargaVibecodear('Read', { file_path: '/repo/.claude/skills/vibecodear/SKILL.md' }), true);
  assert.equal(cargaVibecodear('Read', { file_path: '/repo/.agents/skills/vibecodear/references/roles.md' }), false);
});

test('de punta a punta: la guarda bloquea vibecodear sin identidad, registra la sesión y avisa del apoyo una vez', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-equipo-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.copyFileSync(path.join(ROOT, 'docs/UraqiVisionDocumentoMaestrov1.0.txt'), path.join(dir, 'docs/UraqiVisionDocumentoMaestrov1.0.txt'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ uraqi: { modulos: FRONT } }));

    const skill = { tool: 'Skill', input: { skill: 'vibecodear' }, cwd: dir };
    assert.match(guardaVibecodear({ ...skill, sesion: 's1' }), /^\[uraqi-guard:colaborador-sin-identificar\][\s\S]*1\. Joaco/);
    assert.equal(guardaVibecodear({ tool: 'Bash', input: { command: 'node ai/scripts/equipo.mjs soy Marian' }, cwd: dir, sesion: 's1' }), null);
    assert.deepEqual([leerIdentidad(dir).nombre, leerIdentidad(dir).sesion], ['Marian', 's1']);
    assert.equal(guardaVibecodear({ ...skill, sesion: 's1' }), null, 'identificada en esta sesión');
    assert.match(guardaVibecodear({ ...skill, sesion: 's2' }), /colaborador-sin-identificar/, 'otra sesión vuelve a preguntar');
    assert.equal(guardaVibecodear({ tool: 'Bash', input: { command: 'node ai/scripts/equipo.mjs soy Pepe' }, cwd: dir, sesion: 's2' }), null);
    assert.equal(leerIdentidad(dir).nombre, 'Marian', 'un nombre fuera de §19 no se registra');

    assert.match(avisoDeApoyo({ texto: 'deslizador (RF-06)', cwd: dir, sesion: 's1' }), /M-MAPA es de Joaco/);
    assert.equal(avisoDeApoyo({ texto: 'otra vez RF-07', cwd: dir, sesion: 's1' }), null, 'una vez por módulo y sesión');
    assert.equal(avisoDeApoyo({ texto: 'ficha del atlas (RF-03)', cwd: dir, sesion: 's1' }), null, 'propio');
    assert.match(avisoDeApoyo({ texto: 'commit (RF-06)', cwd: dir }), /M-MAPA/, 'sin sesión (commit-msg) avisa siempre');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
