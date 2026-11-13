// Pruebas de las referencias de §31: catálogo, selección, secciones generadas, revisión y aviso.
// Ejecutar: node --test ai/hooks/test/referencias.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  cargarCatalogo, validarCatalogo, seccionReferencias, referenciasPara, bloqueReferencias, inyectarBloque, revisarImplementacion,
  esArtefactoDelProducto, avisoReferencias, leerDocumento, textoRevision, MARCA_INICIO, MARCA_FIN, CATALOGO,
} from '../lib/referencias.mjs';
import { cargarEquipo } from '../lib/equipo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOC = leerDocumento(ROOT);
const CAT = cargarCatalogo(ROOT);
const MODULOS = cargarEquipo(ROOT).modulos.map((m) => m.id);

test('el catálogo recoge cada referencia de §31, con su enlace idéntico', () => {
  assert.deepEqual(validarCatalogo(CAT, DOC, { modulos: MODULOS }), []);
  const enlaces = (seccionReferencias(DOC).replace(/\s+/g, '').match(/https?:\/\//g) ?? []).length;
  assert.equal(CAT.length, enlaces);
  const b = CAT.find((r) => r.id === 'belenguer-2019');
  assert.deepEqual(b.citadaEn.map((c) => c.seccion), ['§11.1', '§12', '§23.1']);
});

test('el catálogo detecta referencias de menos, enlaces cambiados e identificadores inventados', () => {
  const sinUna = CAT.slice(1);
  assert.match(validarCatalogo(sinUna, DOC).join(), /§31 tiene 26 enlaces y el catálogo 25/);
  const otra = CAT.map((r) => (r.id === 'gdal-cog' ? { ...r, enlace: 'https://gdal.org/inventado' } : r));
  assert.match(validarCatalogo(otra, DOC).join(), /gdal-cog: el enlace https:\/\/gdal\.org\/inventado no está en §31/);
  const mal = CAT.map((r) => (r.id === 'cesium' ? { ...r, aplicaA: { ...r.aplicaA, ids: ['RF-99'], modulos: ['M-INVENTADO'] }, citadaEn: [{ seccion: '§40' }] } : r));
  const e = validarCatalogo(mal, DOC, { modulos: MODULOS }).join('\n');
  assert.match(e, /cesium: cita RF-99/);
  assert.match(e, /la sección §40 no existe/);
  assert.match(e, /el módulo M-INVENTADO no figura en §19/);
  assert.match(validarCatalogo(CAT, 'sin sección 31').join(), /No se encontró §31/);
});

test('elige las referencias por requisito, módulo o skill', () => {
  assert.deepEqual(referenciasPara({ ids: ['MC-03'] }, CAT).map((r) => r.id), ['belenguer-2019']);
  assert.ok(referenciasPara({ ids: ['RF-03'] }, CAT).some((r) => r.id === 'ovando-2016'));
  assert.ok(referenciasPara({ modulos: ['M-GLOBO'] }, CAT).some((r) => r.id === 'cesium'));
  assert.ok(referenciasPara({ skills: ['ingesta-nisar-asf'] }, CAT).some((r) => r.id === 'asf-gdal'));
  assert.deepEqual(referenciasPara({ ids: ['RNF-01'] }, CAT), []);
});

test('inserta, reemplaza y quita la sección generada sin duplicarla', () => {
  const base = '---\nname: x\n---\n\n# Skill\n\nTexto.\n';
  const b1 = bloqueReferencias(referenciasPara({ ids: ['MC-03'] }, CAT));
  const con = inyectarBloque(base, b1);
  assert.match(con, /## Referencias del documento maestro \(§31\)[\s\S]*Belenguer-Plomer[\s\S]*referencias:fin/);
  assert.equal(inyectarBloque(con, b1), con, 'idempotente');
  const b2 = bloqueReferencias(referenciasPara({ ids: ['RF-02'] }, CAT));
  const cambiado = inyectarBloque(con, b2);
  assert.doesNotMatch(cambiado, /Belenguer/);
  assert.match(cambiado, /CesiumJS/);
  assert.equal((cambiado.match(/referencias:inicio/g) ?? []).length, 1);
  assert.equal(inyectarBloque(cambiado, '').trim(), base.trim(), 'sin referencias, se quita la sección');
  const sdd = '## 6. Herramientas del repositorio\n\n- Skills: x\n\n## 7. Riesgos y pendientes\n\n- r\n';
  const conSdd = inyectarBloque(sdd, bloqueReferencias(referenciasPara({ ids: ['MC-03'] }, CAT), { encabezado: '**Referencias del documento maestro (§31)**' }), { antesDe: '## 7. Riesgos y pendientes' });
  assert.ok(conSdd.indexOf('Belenguer') < conSdd.indexOf('## 7.'), 'en el SDD va dentro de la sección 6');
  assert.equal(inyectarBloque(conSdd, bloqueReferencias(referenciasPara({ ids: ['MC-03'] }, CAT), { encabezado: '**Referencias del documento maestro (§31)**' }), { antesDe: '## 7. Riesgos y pendientes' }), conSdd);
});

test('revisa que la implementación cite sus referencias y no invente DOI', () => {
  const archivos = {
    'pipeline/ciencia/cociente.py': '"""Cociente de HV en dB (MC-03)."""\n',
    'pipeline/validacion/dice.py': '"""Dice frente al dNBR (VC-01). Belenguer-Plomer et al. (2019), https://doi.org/10.1016/j.rse.2019.111345"""\n',
    'web/src/fichas/oruro.json': '{"fuente": "Satgé et al. (2017)", "req": "RF-03", "doi": "10.9999/inventado.2024"}',
    'ai/scripts/x.mjs': '// MC-03 sin citar, pero es una herramienta',
    'sdd/m-ciencia.md': 'MC-03',
  };
  const r = revisarImplementacion({ archivos: Object.keys(archivos), leer: (f) => archivos[f], catalogo: CAT });
  const b = r.referencias.find((x) => x.id === 'belenguer-2019');
  assert.equal(b.estado, 'considerada', 'VC-01 la cita');
  const satge = r.referencias.find((x) => x.id === 'satge-2017');
  assert.equal(satge.estado, 'considerada');
  const ovando = r.referencias.find((x) => x.id === 'ovando-2016');
  assert.equal(ovando.estado, 'sin-citar', 'la ficha implementa RF-03 sin citar a Ovando');
  assert.equal(r.referencias.find((x) => x.id === 'cesium').estado, 'sin-implementar');
  assert.deepEqual(r.doisFuera, [{ archivo: 'web/src/fichas/oruro.json', doi: '10.9999/inventado.2024' }]);
  assert.equal(esArtefactoDelProducto('ai/scripts/x.mjs'), false);
  assert.equal(esArtefactoDelProducto('sdd/m-ciencia.md'), false);
  assert.equal(esArtefactoDelProducto(CATALOGO), false);
  assert.equal(esArtefactoDelProducto('specs/003-ciencia/plan.md'), true);
  const t = textoRevision(r);
  assert.match(t, /sin citar donde se implementan/i);
  assert.match(t, /DOI que no están en §31/);
});

test('el repositorio real: catálogo válido y cada skill del catálogo tiene su sección generada', () => {
  const skills = fs.readdirSync(path.join(ROOT, '.agents/skills'));
  for (const s of new Set(CAT.flatMap((r) => r.aplicaA.skills))) {
    if (!skills.includes(s)) continue;
    const t = fs.readFileSync(path.join(ROOT, '.agents/skills', s, 'SKILL.md'), 'utf8');
    assert.ok(t.includes(MARCA_INICIO) && t.includes(MARCA_FIN), `la skill ${s} no tiene su sección de referencias (npm run ai:sync)`);
  }
  const especialista = fs.readFileSync(path.join(ROOT, '.agents/skills/referencias-documento/SKILL.md'), 'utf8');
  assert.equal((especialista.match(/^- \*\*/gm) ?? []).length, CAT.length, 'la skill especialista lista todas las referencias');
});

test('al editar, avisa de las referencias que aplican una vez por sesión', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uraqi-ref-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.mkdirSync(path.join(dir, 'ai/referencias'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, CATALOGO), path.join(dir, CATALOGO));
    const a = avisoReferencias({ texto: 'def cociente():  # MC-03', cwd: dir, sesion: 's1' });
    assert.match(a, /Referencias de §31 que aplican[\s\S]*Belenguer-Plomer[\s\S]*doi\.org\/10\.1016/);
    assert.equal(avisoReferencias({ texto: 'otra vez MC-03', cwd: dir, sesion: 's1' }), null, 'una vez por sesión');
    assert.match(avisoReferencias({ texto: 'MC-03', cwd: dir, sesion: 's2' }), /Belenguer/);
    assert.equal(avisoReferencias({ texto: 'sin requisitos', cwd: dir, sesion: 's3' }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
