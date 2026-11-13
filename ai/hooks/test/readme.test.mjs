// Pruebas del generador de ai/README.md (la ayuda). Ejecutar: node --test ai/hooks/test/readme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarReadme, validarPlantilla, separar, cabecera, BLOQUES } from '../../docs/readme.mjs';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('el README del repositorio se genera sin errores y lista cada skill, subagente y servidor MCP', () => {
  const { texto, errores } = generarReadme({ root: ROOT });
  assert.deepEqual(errores, []);
  for (const d of fs.readdirSync(path.join(ROOT, '.agents', 'skills'))) {
    if (fs.existsSync(path.join(ROOT, '.agents', 'skills', d, 'SKILL.md'))) assert.match(texto, new RegExp(`\`${d}\``), `falta la skill ${d}`);
  }
  for (const f of fs.readdirSync(path.join(ROOT, 'ai', 'agents'))) {
    const { data } = parseFrontmatter(fs.readFileSync(path.join(ROOT, 'ai', 'agents', f), 'utf8'), f);
    assert.match(texto, new RegExp(`\`${data.name}\``), `falta el subagente ${data.name}`);
  }
  for (const s of Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'ai', 'mcp', 'servers.json'), 'utf8')).servers)) {
    assert.match(texto, new RegExp(`\`${s}\``), `falta el servidor MCP ${s}`);
  }
  assert.doesNotMatch(texto, /<!-- @@[\w-]+ -->/, 'no quedan bloques sin rellenar');
});

test('el README versionado coincide con el generado (si no, falta npm run ai:sync)', () => {
  const { texto } = generarReadme({ root: ROOT });
  const actual = fs.readFileSync(path.join(ROOT, 'ai/README.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(actual, texto);
});

test('la plantilla falla si cita scripts, comandos o rutas que no existen, o si le falta un bloque', () => {
  const bloques = BLOQUES.map((b) => `<!-- @@${b} -->`).join('\n');
  const ok = `${bloques}\nnpm run ai:sync y \`ai/sync.mjs\``;
  assert.deepEqual(validarPlantilla(ok, { root: ROOT, scripts: { 'ai:sync': 'x' } }), []);
  const mal = `${BLOQUES.slice(1).map((b) => `<!-- @@${b} -->`).join('\n')}\n<!-- @@inventado -->\nnpm run no-existe\nnode ai/scripts/no-existe.mjs\n\`ai/no-existe/\``;
  const errores = validarPlantilla(mal, { root: ROOT, scripts: {} }).join('\n');
  assert.match(errores, /falta el bloque <!-- @@resumen -->/);
  assert.match(errores, /bloque desconocido <!-- @@inventado -->/);
  assert.match(errores, /npm run no-existe/);
  assert.match(errores, /ai\/scripts\/no-existe\.mjs/);
  assert.match(errores, /ai\/no-existe/);
});

test('separa «para qué» de «cuándo usarla» y lee cabeceras sin la línea de uso', () => {
  assert.deepEqual(separar('Hace X. Usar cuando Y.'), { que: 'Hace X.', cuando: 'Usar cuando Y.' });
  assert.deepEqual(separar('Use when Z.'), { que: '', cuando: 'Use when Z.' });
  assert.deepEqual(separar('Solo qué.'), { que: 'Solo qué.', cuando: '' });
  assert.equal(cabecera('#!/usr/bin/env node\n// Hace algo.\n// Más.\n// Uso: node x.mjs\ncode', '//'), 'Hace algo. Más.');
  assert.equal(cabecera('// Hook de git pre-push: bloquea.\n', '//'), 'bloquea.');
});
