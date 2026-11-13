#!/usr/bin/env node
// SDD por área: estado, siguiente prompt listo para copiar, confirmaciones y resultados en el historial.
//   node ai/scripts/sdd.mjs estado [--modulo M-MAPA]               progreso, conflictos y siguiente de cada SDD
//   node ai/scripts/sdd.mjs siguiente [--despues ID] [--yo] [--persona N] [--asistente claude|codex|gemini|opencode]
//   node ai/scripts/sdd.mjs ver <ID> [--asistente …]               un prompt concreto
//   node ai/scripts/sdd.mjs confirmar <ID> --decision ejecutar|modificar|omitir [--nota "…"]
//   node ai/scripts/sdd.mjs registrar <ID> --resultado hecho|parcial|conflicto|en-espera|omitido [--nota "…"]
//   node ai/scripts/sdd.mjs historial [--id ID] [--modulo M-…]     lo que pasó con cada prompt
//   node ai/scripts/sdd.mjs validar                                estructura de todos los SDD (falla si hay errores)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  cargarSdds, todosLosPrompts, validar, leerHistorial, escribirEntrada, estados, siguiente, textoSiguiente,
  leerEnCurso, guardarEnCurso, borrarEnCurso, RESULTADOS, DECISIONES,
} from '../hooks/lib/sdd.mjs';
import { cargarEquipo, colaboradores, leerIdentidad } from '../hooks/lib/equipo.mjs';

const args = process.argv.slice(2);
const comando = args[0] ?? 'estado';
const valor = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const posicional = args.slice(1).find((a, i, l) => !a.startsWith('--') && !(i > 0 && l[i - 1].startsWith('--')));
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const sdds = cargarSdds(root);
const prompts = todosLosPrompts(sdds);
const asistente = valor('--asistente') ?? 'claude';
const yo = leerIdentidad(root)?.nombre ?? null;
const rama = () => { try { return execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; } };

function buscar(id) {
  const p = prompts.find((x) => x.id === id);
  if (!p) { console.error(`No existe ${id} en sdd/. Mira la lista con: node ai/scripts/sdd.mjs estado`); process.exit(1); }
  return p;
}

const comandos = {
  estado() {
    const est = estados(prompts, leerHistorial(root));
    const filtro = valor('--modulo');
    for (const s of sdds.filter((x) => !filtro || x.meta?.id === filtro)) {
      const ps = s.prompts;
      const hechos = ps.filter((p) => est.get(p.id).estado === 'hecho').length;
      console.log(`\n${s.meta?.id} · ${s.meta?.titulo} (${s.archivo}) — ${hechos}/${ps.length}`);
      for (const p of ps) {
        const e = est.get(p.id);
        const icono = { hecho: '✔', omitido: '⤼', parcial: '◐', conflicto: '✘', 'en-espera': '⏸', pendiente: '·' }[e.estado];
        console.log(`  ${icono} ${p.id} ${p.titulo.padEnd(28)} ${e.estado.padEnd(10)} ${p.datos.Ejecuta}${e.conflictos.length ? `\n      ⚠ ${e.conflictos.join('\n      ⚠ ')}` : ''}`);
      }
    }
    const sig = siguiente(prompts, est, { persona: yo });
    console.log(`\n${textoSiguiente(sig, est, { asistente, titulo: yo ? `Siguiente para ${yo}` : 'Siguiente prompt' })}`);
  },
  siguiente() {
    const est = estados(prompts, leerHistorial(root));
    const persona = valor('--persona') ?? (args.includes('--yo') ? yo : undefined);
    console.log(textoSiguiente(siguiente(prompts, est, { despues: valor('--despues'), persona }), est, { asistente }));
  },
  ver() {
    const p = buscar(posicional);
    const est = estados(prompts, leerHistorial(root));
    console.log(textoSiguiente({ prompt: p, bloqueadoPor: p.dependencias.filter((d) => !['hecho', 'omitido'].includes(est.get(d)?.estado)) }, est, { asistente, titulo: 'Prompt' }));
  },
  confirmar() {
    const p = buscar(posicional);
    const decision = valor('--decision');
    if (!DECISIONES.includes(decision)) { console.error(`--decision debe ser ${DECISIONES.join(', ')}`); process.exit(1); }
    escribirEntrada(root, { tipo: 'confirmacion', id: p.id, decision, colaborador: yo, nota: valor('--nota') ?? '', hash: p.hash, rama: rama() });
    if (decision === 'omitir') {
      escribirEntrada(root, { tipo: 'resultado', id: p.id, resultado: 'omitido', colaborador: yo, nota: valor('--nota') ?? '', hash: p.hash, rama: rama() });
      borrarEnCurso(root);
      const est = estados(prompts, leerHistorial(root));
      console.log(`⤼ ${p.id} omitido y registrado en el historial.\n\n${textoSiguiente(siguiente(prompts, est, { despues: p.id, persona: yo }), est, { asistente })}`);
      return;
    }
    const curso = leerEnCurso(root);
    guardarEnCurso(root, { id: p.id, sesion: curso?.id === p.id ? curso.sesion : null, estado: 'en-ejecucion', inicio: new Date().toISOString(), decision });
    console.log(`✔ ${p.id}: «${decision}» registrado en el historial.${decision === 'modificar' ? ` Edita el prompt en ${p.archivo} con el cambio acordado y luego ejecútalo.` : ' Ejecútalo.'}\nAl terminar: node ai/scripts/sdd.mjs registrar ${p.id} --resultado hecho|parcial|conflicto|en-espera --nota "…"`);
  },
  registrar() {
    const p = buscar(posicional);
    const resultado = valor('--resultado');
    if (!RESULTADOS.includes(resultado)) { console.error(`--resultado debe ser ${RESULTADOS.join(', ')}`); process.exit(1); }
    const archivo = escribirEntrada(root, { tipo: 'resultado', id: p.id, resultado, colaborador: yo, nota: valor('--nota') ?? '', hash: p.hash, rama: rama() });
    const curso = leerEnCurso(root);
    if (resultado === 'en-espera') guardarEnCurso(root, { ...(curso ?? {}), id: p.id, estado: 'en-espera' });
    else if (curso?.id === p.id) borrarEnCurso(root);
    const est = estados(prompts, leerHistorial(root));
    console.log(`✔ ${p.id} → «${resultado}» en el historial (${archivo}). Inclúyelo en el commit de tu rama.\n`);
    console.log(textoSiguiente(siguiente(prompts, est, { despues: p.id }), est, { asistente }));
  },
  historial() {
    const id = valor('--id');
    const modulo = valor('--modulo');
    const ids = new Set(prompts.filter((p) => (!id || p.id === id) && (!modulo || p.sdd === modulo)).map((p) => p.id));
    const h = leerHistorial(root).filter((x) => ids.has(x.id));
    if (!h.length) { console.log('Sin entradas en el historial todavía.'); return; }
    for (const x of h) console.log(`${x.fecha.slice(0, 16).replace('T', ' ')}  ${x.id.padEnd(14)} ${(x.tipo === 'resultado' ? x.resultado : `decide ${x.decision}`).padEnd(18)} ${(x.colaborador ?? '—').padEnd(8)} ${x.rama ?? ''}${x.nota ? `\n    ${x.nota}` : ''}`);
  },
  validar() {
    const { modulos, repoModulos } = cargarEquipo(root);
    const skills = fs.existsSync(path.join(root, '.agents/skills')) ? fs.readdirSync(path.join(root, '.agents/skills')) : [];
    const errores = validar(sdds, { colaboradores: colaboradores(modulos), repoModulos, skills });
    if (!sdds.length) errores.push('No hay SDD en sdd/.');
    if (errores.length) { console.error(`SDD con errores de estructura:\n- ${errores.join('\n- ')}`); process.exit(1); }
    console.log(`✔ ${sdds.length} SDD y ${prompts.length} prompts con la estructura correcta.`);
  },
};

if (!comandos[comando]) {
  console.error(`Comando desconocido: ${comando}. Usa: ${Object.keys(comandos).join(', ')}.`);
  process.exit(2);
}
comandos[comando]();
