// Pruebas del revisor de código vivo y del CI/CD por rama. Ejecutar: node --test ai/hooks/test/codigo-vivo.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analizar, planDeSolucion, informe, importsDe, exportsDe, excluido } from '../lib/codigo-vivo.mjs';
import { revisarCicd, ramasDeWorkflow, textoCicd } from '../lib/cicd.mjs';
import { destinoDePromocion } from '../lib/promocion.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const repo = (mapa) => ({ archivos: Object.keys(mapa), leer: (f) => mapa[f] ?? null });
const de = (r, tipo) => r.hallazgos.filter((h) => h.tipo === tipo);

const SINTETICO = {
  'package.json': JSON.stringify({ scripts: { cli: 'node src/cli.mjs', test: 'node --test test/a.test.mjs' }, dependencies: { react: '1.0.0' } }),
  'src/cli.mjs': [
    "import fs from 'node:fs';",
    "import React from 'react';",
    "import _ from 'lodash';",
    "import { usada } from './lib/a.mjs';",
    "import { x } from './lib/falta.mjs';",
    'const plantilla = `',
    "import { y } from './no-es-import.mjs';",
    '`;',
    '// TODO: conectar la descarga',
    "const filas = 'datos de ejemplo';",
    'usada();',
  ].join('\n'),
  'src/lib/a.mjs': 'export function usada() {}\nexport function usadaPorPrueba() {}\nexport const nadie = 1;\nexport function interna() {}\ninterna();',
  'src/lib/huerfano.mjs': 'export const h = 1;',
  'src/lib/solo-pruebas.mjs': 'export const s = 1;',
  'src/lib/intencional.mjs': '// uraqi: vivo — lo carga el visor por nombre\nexport const v = 1;',
  'test/a.test.mjs': "import { s } from '../src/lib/solo-pruebas.mjs';\nimport { usadaPorPrueba } from '../src/lib/a.mjs';\ntest.only('x', () => {});\ntest.skip('y', () => {});",
  '.github/workflows/ci.yml': 'on:\n  pull_request:\n    branches: [dev]\njobs:\n  a:\n    steps:\n      - run: node scripts/no-existe.mjs\n',
  'README.md': 'Ejecuta `node tools/no-existe.mjs` o mira `ejemplo.ts`.',
  'ejemplo.ts': 'export const e = 1;',
  'fixtures/roto.mjs': "import './nada.mjs';",
  'pipeline/run.py': 'from .util import f\nif __name__ == "__main__":\n    f()\n',
  'pipeline/util.py': 'def f():\n    pass\n',
  'pipeline/huerfano.py': 'def g():\n    pass\n',
};

test('detecta código roto: imports y referencias a archivos inexistentes, paquetes sin declarar', () => {
  const r = analizar(repo({ ...SINTETICO, '.github/workflows/ci.yml': `${SINTETICO['.github/workflows/ci.yml']}      - run: python pipeline/run.py\n` }));
  assert.deepEqual(de(r, 'import-roto').map((h) => [h.archivo, h.linea]), [['src/cli.mjs', 5]]);
  assert.deepEqual(de(r, 'paquete-no-declarado').map((h) => h.detalle), ['importa el paquete «lodash», que no está en ningún package.json']);
  assert.match(de(r, 'referencia-rota')[0].detalle, /scripts\/no-existe\.mjs/);
  assert.match(de(r, 'doc-cita-inexistente')[0].detalle, /tools\/no-existe\.mjs/);
  assert.ok(r.hallazgos.every((h) => !h.archivo.startsWith('fixtures/')), 'los fixtures rotos a propósito no cuentan');
  assert.ok(!r.hallazgos.some((h) => /no-es-import/.test(h.detalle)), 'un import dentro de una plantilla de texto no es un import');
});

test('detecta código muerto, código que solo usan las pruebas y exportaciones sin uso', () => {
  const r = analizar(repo({ ...SINTETICO, '.github/workflows/ci.yml': `${SINTETICO['.github/workflows/ci.yml']}      - run: python pipeline/run.py\n` }));
  assert.deepEqual(de(r, 'codigo-muerto').map((h) => h.archivo).sort(), ['pipeline/huerfano.py', 'src/lib/huerfano.mjs']);
  assert.deepEqual(de(r, 'solo-pruebas').map((h) => h.archivo), ['src/lib/solo-pruebas.mjs']);
  assert.deepEqual(de(r, 'exportacion-sin-uso').map((h) => h.detalle).sort(), ['«nadie» se exporta pero nadie lo usa', '«usadaPorPrueba» solo lo usan las pruebas']);
  for (const vivo of ['src/lib/intencional.mjs', 'ejemplo.ts', 'pipeline/util.py', 'src/lib/a.mjs']) {
    assert.ok(!r.hallazgos.some((h) => h.archivo === vivo && ['codigo-muerto', 'solo-pruebas'].includes(h.tipo)), `${vivo} está vivo`);
  }
});

test('avisa de trabajo sin terminar, datos simulados (RN-04) y pruebas desactivadas; .only es error', () => {
  const r = analizar(repo(SINTETICO));
  assert.equal(de(r, 'sin-terminar')[0].linea, 9);
  assert.equal(de(r, 'datos-simulados')[0].linea, 10);
  assert.equal(de(r, 'prueba-only')[0].nivel, 'error');
  assert.equal(de(r, 'prueba-desactivada')[0].nivel, 'aviso');
});

test('plan de solución: un paso por tipo, primero los errores, con su acción', () => {
  const r = analizar(repo(SINTETICO));
  const plan = planDeSolucion(r.hallazgos);
  assert.equal(plan[0].nivel, 'error');
  assert.ok(plan.findIndex((p) => p.nivel === 'aviso') > plan.findLastIndex((p) => p.nivel === 'error'));
  assert.match(plan.find((p) => p.tipo === 'codigo-muerto').accion, /conéctalo[\s\S]*bórralo[\s\S]*uraqi: vivo/);
  const md = informe(r);
  assert.match(md, /✘ \d+ error\(es\)/);
  assert.match(md, /\*\*Plan de solución\*\*/);
  assert.match(informe(analizar(repo({ 'package.json': '{"scripts":{"a":"node a.mjs"}}', 'a.mjs': '' }))), /✔ sin código roto ni muerto/);
});

test('lee imports y exports de JS/TS', () => {
  const imps = importsDe("import a, { b as c, type D } from './x';\nimport * as ns from './y';\nexport * from './z';\nconst m = await import('./w');\n// import n from './comentado';");
  assert.deepEqual(imps.map((i) => i.spec).sort(), ['./w', './x', './y', './z']);
  assert.deepEqual([...imps.find((i) => i.spec === './x').nombres].sort(), ['D', 'b', 'default']);
  assert.equal(imps.find((i) => i.spec === './y').nombres, '*');
  assert.ok(!imps.some((i) => i.spec === './comentado'));
  assert.deepEqual([...exportsDe('export async function f() {}\nexport const g = 1;\nexport { h, i as j };\nexport default x;')].sort(), ['default', 'f', 'g', 'h', 'j']);
  assert.equal(excluido('node_modules/x/a.js'), true);
  assert.equal(excluido('.claude/skills/x/a.mjs'), true);
  assert.equal(excluido('ai/hooks/lib/a.mjs'), false);
});

test('CI/CD: ramas de cada workflow y estado pendiente, incompleto o completo', () => {
  assert.deepEqual([...ramasDeWorkflow('on:\n  pull_request:\n    branches: [qa, main]\n')].sort(), ['main', 'qa']);
  assert.deepEqual([...ramasDeWorkflow('on:\n  push:\n    branches:\n      - dev\n')], ['dev']);
  assert.deepEqual([...ramasDeWorkflow('on:\n  pull_request:\n')].sort(), ['dev', 'main', 'qa']);

  const sinApp = revisarCicd(repo({ '.github/workflows/a.yml': 'on:\n  pull_request:\n    branches: [dev]\njobs:\n  a:\n    steps:\n      - run: node ai/scripts/buenas-practicas-pr.mjs --pr 1\n' }));
  assert.equal(sinApp.estado, 'pendiente');
  assert.ok(sinApp.hallazgos.every((h) => h.nivel === 'aviso'));
  assert.deepEqual(sinApp.ramas.dev.conflictos, ['a.yml']);
  assert.match(textoCicd(sinApp), /pendiente[\s\S]*DP-06/);

  const conApp = revisarCicd(repo({ 'web/package.json': '{"scripts":{"build":"vite build","preview":"vite preview"}}', '.github/workflows/a.yml': 'on:\n  pull_request:\njobs:\n  a:\n    steps:\n      - run: node ai/scripts/buenas-practicas-pr.mjs\n' }));
  assert.equal(conApp.estado, 'incompleto');
  assert.ok(conApp.hallazgos.some((h) => h.nivel === 'error' && h.etapa === 'build' && h.rama === 'main'));

  const completo = revisarCicd(repo({
    'web/package.json': '{"scripts":{"build":"vite build","preview":"vite preview"}}',
    '.github/workflows/ci.yml': [
      'on:', '  pull_request:', '    branches: [dev, qa, main]', 'jobs:', '  ci:', '    steps:',
      '      - run: node ai/scripts/buenas-practicas-pr.mjs --pr 1',
      '      - run: node ai/scripts/codigo-vivo.mjs revisar --pr 1',
      '      - run: npm test',
      '      - run: node ai/scripts/codigo-vivo.mjs levantar',
    ].join('\n'),
  }));
  assert.equal(completo.estado, 'completo');
  assert.deepEqual(completo.hallazgos, []);
});

test('la guarda solo se activa al crear una PR hacia qa o main', () => {
  assert.equal(destinoDePromocion('gh pr create --base qa --head dev --title x'), 'qa');
  assert.equal(destinoDePromocion('gh pr create -B main --title "Promoción qa → main"'), 'main');
  assert.equal(destinoDePromocion("gh pr create --base='main' --fill"), 'main');
  assert.equal(destinoDePromocion('gh pr create --base dev --title x'), null);
  assert.equal(destinoDePromocion('gh pr list --base qa'), null);
  assert.equal(destinoDePromocion(undefined), null);
});

test('el repositorio no tiene código roto ni muerto (regresión)', () => {
  const ls = (a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const archivos = [...new Set([...ls(['ls-files']), ...ls(['ls-files', '--others', '--exclude-standard'])])].filter((f) => fs.existsSync(path.join(ROOT, f)));
  const r = analizar({ archivos, leer: (f) => fs.readFileSync(path.join(ROOT, f), 'utf8') });
  const errores = r.hallazgos.filter((h) => h.nivel === 'error');
  assert.deepEqual(errores.map((h) => `${h.tipo} ${h.archivo}: ${h.detalle}`), []);
});
