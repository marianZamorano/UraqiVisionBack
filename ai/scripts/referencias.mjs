#!/usr/bin/env node
// Referencias de §31 del documento maestro: qué enlaces aplican a cada requisito, módulo o skill, y si la
// implementación las tiene en cuenta.
//   node ai/scripts/referencias.mjs lista [--modulo M-…] [--skill nombre]    referencias con su enlace y uso
//   node ai/scripts/referencias.mjs para <RF-xx|MC-xx|…>…                    las que aplican a esos requisitos
//   node ai/scripts/referencias.mjs revisar [--json]                         catálogo frente a §31 e implementación
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  cargarCatalogo, validarCatalogo, leerDocumento, referenciasPara, listaReferencias, revisarImplementacion, textoRevision,
} from '../hooks/lib/referencias.mjs';
import { cargarEquipo } from '../hooks/lib/equipo.mjs';

const args = process.argv.slice(2);
const comando = args[0] ?? 'lista';
const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const catalogo = cargarCatalogo(root);

function archivosDelRepo() {
  const ls = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  return [...new Set([...ls(['ls-files']), ...ls(['ls-files', '--others', '--exclude-standard'])])].filter((f) => fs.existsSync(path.join(root, f)));
}
const leer = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; } };

const comandos = {
  lista() {
    const modulo = valor('--modulo');
    const skill = valor('--skill');
    const refs = modulo || skill ? referenciasPara({ modulos: modulo ? [modulo] : [], skills: skill ? [skill] : [] }, catalogo) : catalogo;
    console.log(refs.length ? listaReferencias(refs) : 'Ninguna referencia de §31 aplica a ese filtro.');
  },
  para() {
    const ids = args.slice(1).flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
    const refs = referenciasPara({ ids, modulos: ids.filter((i) => i.startsWith('M-')) }, catalogo);
    console.log(refs.length ? listaReferencias(refs) : `Ninguna referencia de §31 aplica a ${ids.join(', ')}.`);
  },
  revisar() {
    const { modulos } = cargarEquipo(root);
    const errores = validarCatalogo(catalogo, leerDocumento(root), { modulos: modulos.map((m) => m.id) });
    const r = revisarImplementacion({ archivos: archivosDelRepo(), leer, catalogo });
    if (args.includes('--json')) console.log(JSON.stringify({ errores, ...r }, null, 2));
    else console.log(textoRevision(r, errores));
    process.exitCode = errores.length ? 1 : 0;
  },
};

if (!comandos[comando]) {
  console.error(`Comando desconocido: ${comando}. Usa: ${Object.keys(comandos).join(', ')}.`);
  process.exit(2);
}
comandos[comando]();
