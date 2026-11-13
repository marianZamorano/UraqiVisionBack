#!/usr/bin/env node
// Herramientas de IA: verificar que funcionan y están activas, revisar la coherencia de sus cambios con el documento
// maestro y avisar a los demás colaboradores cuando cambian.
//   node ai/scripts/herramientas.mjs verificar [--rapido] [--pruebas] [--ci] [--json] [--guardar]
//   node ai/scripts/herramientas.mjs activar                                   (guía paso a paso de lo que no está activo)
//   node ai/scripts/herramientas.mjs cambios [--desde <ref>] [--hasta <ref>]   (por defecto: origin/dev → árbol de trabajo)
//   node ai/scripts/herramientas.mjs revisar-pr --pr <N> --base <ref>          (CI: falla si algo no funciona o es incoherente)
//   node ai/scripts/herramientas.mjs notificar --pr <N> [--simular]            (CI: comenta mencionando a los colaboradores)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resumirCambios, textoResumen, textoAviso, MARCA_REVISION, MARCA_AVISO } from '../hooks/lib/herramientas.mjs';
import { raiz, cambiosEntre, cambiosDeTrabajo, coherenciaDeCambios, parseNameStatus } from '../hooks/lib/herramientas-git.mjs';
import { verificar, fallidas, textoVerificacion } from '../hooks/lib/verificacion.mjs';
import { api, repoSlug, colaboradores } from '../hooks/lib/github.mjs';
import { guardarVigilancia } from '../hooks/lib/vigilancia.mjs';
import { textoGuia } from '../hooks/lib/guia-activacion.mjs';

const args = process.argv.slice(2);
const comando = args[0] ?? 'verificar';
const valor = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const tiene = (flag) => args.includes(flag);
const root = raiz();
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const resumenPaso = (texto) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`); };

async function cmdVerificar() {
  const r = await verificar(root, { rapido: tiene('--rapido'), ci: tiene('--ci'), conPruebas: tiene('--pruebas') });
  // --guardar: lo usa la vigilancia en segundo plano; deja el resultado en .git/ y no imprime nada.
  if (tiene('--guardar')) {
    guardarVigilancia(root, { fecha: Date.now(), enCurso: null, resultados: r });
    return;
  }
  if (tiene('--json')) console.log(JSON.stringify(r, null, 2));
  else console.log(`Herramientas de IA · verificación\n${textoVerificacion(r)}`);
  const malas = fallidas(r);
  if (!tiene('--json')) console.log(malas.length ? `\n${malas.length} comprobación(es) fallan.` : '\nTodo funciona y está activo.');
  process.exit(malas.length ? 1 : 0);
}

function informeDeCambios(entries, fuente, diff) {
  const resumen = resumirCambios(entries);
  const { errores, avisos } = coherenciaDeCambios(entries, { root, fuente, diff });
  return { resumen, errores, avisos };
}

function cmdCambios() {
  const desde = valor('--desde') ?? 'origin/dev';
  const hasta = valor('--hasta');
  const entries = hasta ? cambiosEntre(desde, hasta, root) : cambiosDeTrabajo(desde, root);
  const diff = git('diff', desde, ...(hasta ? [hasta] : []));
  const { resumen, errores, avisos } = informeDeCambios(entries, hasta ?? 'trabajo', diff);
  if (!resumen.piezas.length) {
    console.log(`Sin cambios en herramientas de IA entre ${desde} y ${hasta ?? 'el árbol de trabajo'}.`);
    return;
  }
  console.log(`Herramientas de IA que cambian (${desde} → ${hasta ?? 'árbol de trabajo'}):\n${textoResumen(resumen).join('\n')}`);
  for (const a of avisos) console.log(`⚠ ${a}`);
  for (const e of errores) console.log(`✘ ${e}`);
  console.log(errores.length ? '\nIncoherente con el documento maestro: corrígelo antes de commitear.' : '\nCoherente con el documento maestro.');
  process.exitCode = errores.length ? 1 : 0;
}

async function cmdRevisarPr() {
  const numero = valor('--pr');
  const base = valor('--base') ?? 'origin/dev';
  const entries = parseNameStatus(git('diff', '--name-status', '-M', `${base}...HEAD`));
  const diff = git('diff', `${base}...HEAD`);
  const { resumen, errores, avisos } = informeDeCambios(entries, 'trabajo', diff);
  if (!resumen.piezas.length) {
    console.log('La PR no cambia herramientas de IA: nada que revisar.');
    resumenPaso('La PR no cambia herramientas de IA.');
    return;
  }
  const r = await verificar(root, { ci: true, conPruebas: true });
  const malas = fallidas(r);
  const ok = !malas.length && !errores.length;
  const cuerpo = [
    MARCA_REVISION,
    `### Herramientas de IA · ${ok ? '✔ funcionan y son coherentes' : '✘ hay problemas'}`,
    '',
    'Esta PR cambia:',
    ...textoResumen(resumen),
    '',
    '**Coherencia con el documento maestro**',
    ...(errores.length ? errores.map((e) => `- ✘ ${e}`) : ['- ✔ Identificadores, secciones, frontmatter y servidores MCP coherentes.']),
    ...avisos.map((a) => `- ⚠ ${a}`),
    '',
    '**Verificación (funcionan y están activas)**',
    ...r.map((x) => `- ${x.ok ? '✔' : x.nivel === 'error' ? '✘' : '⚠'} \`${x.id}\`: ${x.detalle}`),
    '',
    '_Al fusionarse en `dev`, se avisará a los demás colaboradores._',
  ].join('\n');
  console.log(cuerpo);
  resumenPaso(cuerpo);
  if (numero && process.env.GITHUB_TOKEN) {
    const slug = repoSlug(root);
    const comentarios = await api(`repos/${slug}/issues/${numero}/comments?per_page=100`);
    const previo = comentarios.find((c) => c.body?.includes(MARCA_REVISION));
    if (previo) await api(`repos/${slug}/issues/comments/${previo.id}`, { method: 'PATCH', body: { body: cuerpo } });
    else await api(`repos/${slug}/issues/${numero}/comments`, { method: 'POST', body: { body: cuerpo } });
  }
  process.exitCode = ok ? 0 : 1;
}

async function cmdNotificar() {
  const numero = valor('--pr');
  if (!numero) throw new Error('Falta --pr <N>');
  const slug = repoSlug(root);
  const pr = await api(`repos/${slug}/pulls/${numero}`);
  if (!pr.merged_at) { console.log(`La PR #${numero} no está fusionada: no se avisa.`); return; }
  const archivos = [];
  for (let pagina = 1; ; pagina += 1) {
    const lote = await api(`repos/${slug}/pulls/${numero}/files?per_page=100&page=${pagina}`);
    archivos.push(...lote);
    if (lote.length < 100) break;
  }
  const letra = { added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C', changed: 'M' };
  const entries = archivos.map((f) => ({ status: letra[f.status] ?? 'M', path: f.filename }));
  const resumen = resumirCambios(entries);
  if (!resumen.piezas.length) { console.log('La PR no cambió herramientas de IA: no se avisa.'); return; }
  const diff = archivos.map((f) => `+++ b/${f.filename}\n${f.patch ?? ''}`).join('\n');
  const { errores, avisos } = coherenciaDeCambios(entries, { root, fuente: 'trabajo', diff });
  const autor = pr.user?.login;
  const menciones = (await colaboradores(slug)).filter((c) => c !== autor);
  const cuerpo = textoAviso({ numero, titulo: pr.title, autor, base: pr.base.ref, menciones, lineas: textoResumen(resumen), errores, avisos });
  console.log(cuerpo);
  resumenPaso(cuerpo);
  if (tiene('--simular')) return;
  if (!menciones.length) console.log('No hay otros colaboradores con acceso aceptado: el comentario queda como registro.');
  const comentarios = await api(`repos/${slug}/issues/${numero}/comments?per_page=100`);
  if (comentarios.some((c) => c.body?.includes(MARCA_AVISO))) { console.log('El aviso ya se publicó.'); return; }
  await api(`repos/${slug}/issues/${numero}/comments`, { method: 'POST', body: { body: cuerpo } });
  console.log(`Aviso publicado en la PR #${numero}${menciones.length ? ` para ${menciones.join(', ')}` : ''}.`);
}

/** Guía paso a paso de lo que no está activo (verificación completa, sin las pruebas). */
async function cmdActivar() {
  const r = await verificar(root, {});
  guardarVigilancia(root, { fecha: Date.now(), enCurso: null, resultados: r });
  const fallos = r.filter((x) => !x.ok);
  if (!fallos.length) { console.log(`✔ Todas las herramientas de IA están activas (${r.length} comprobaciones).`); return; }
  console.log(textoGuia(fallos, { titulo: 'Herramientas de IA que no están activas' }));
  process.exitCode = fallidas(r).length ? 1 : 0;
}

const comandos = { verificar: cmdVerificar, activar: cmdActivar, cambios: cmdCambios, 'revisar-pr': cmdRevisarPr, notificar: cmdNotificar };
if (!comandos[comando]) {
  console.error(`Comando desconocido: ${comando}. Usa: ${Object.keys(comandos).join(', ')}.`);
  process.exit(2);
}
try {
  await comandos[comando]();
} catch (err) {
  console.error(`[uraqi] herramientas ${comando}: ${err.message}`);
  process.exit(1);
}
