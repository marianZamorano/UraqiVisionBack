// Automatización del SDD en los hooks de los asistentes (nunca lanzan):
// - al pegar un prompt «[SDD P-…]»: contexto para confirmar con la persona (opción múltiple), comprobar quién lo
//   ejecuta, dependencias, cambios y re-ejecuciones; anota el prompt en curso.
// - al terminar el turno (Stop / AfterAgent): si el prompt se ejecutó y no se registró, obliga a registrarlo y a
//   mostrar el siguiente prompt listo para copiar.
// - al iniciar sesión: el siguiente prompt de la persona y los conflictos del historial.
import { execFileSync } from 'node:child_process';
import {
  cargarSdds, todosLosPrompts, leerHistorial, estados, siguiente, leerEnCurso, guardarEnCurso, idEnMensaje, difiere,
} from './sdd.mjs';
import { cargarEquipo, leerIdentidad, identidadVigente, textoPedirIdentidad } from './equipo.mjs';
import { cargarCatalogo, referenciasPara, listaReferencias } from './referencias.mjs';

const raizDe = (cwd) => execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Contexto para el asistente cuando el mensaje trae un prompt del SDD. */
export function contextoDePromptSdd({ prompt, cwd, sesion }) {
  const id = idEnMensaje(prompt);
  if (!id) return null;
  try {
    const root = raizDe(cwd);
    const prompts = todosLosPrompts(cargarSdds(root));
    const p = prompts.find((x) => x.id === id);
    if (!p) return `[SDD] El mensaje cita ${id}, que no existe en sdd/. Dile a la persona que revise el identificador (npm run sdd:estado).`;
    const est = estados(prompts, leerHistorial(root));
    const s = est.get(id);
    const equipo = cargarEquipo(root);
    const yo = leerIdentidad(root);
    const lineas = [`[SDD] Prompt ${id} · ${p.titulo} (${p.sdd}, ${p.archivo}). Ejecuta: ${p.datos.Ejecuta}. Revisa: ${p.datos.Revisa}.`];
    if (!identidadVigente(yo, sesion)) {
      lineas.push(`Primero identifica a la persona: ${textoPedirIdentidad(equipo)}`);
    } else if (!p.ejecutores.includes(yo.nombre) && !p.ejecutores.includes('Equipo')) {
      lineas.push(`⚠ ${yo.nombre} no es quien ejecuta este prompt (${p.datos.Ejecuta}): si lo hace, va a apoyar el rol de otra persona. Díselo y que le avise antes de seguir.`);
    }
    const faltan = p.dependencias.filter((d) => !['hecho', 'omitido'].includes(est.get(d)?.estado));
    if (faltan.length) lineas.push(`⚠ Dependencias sin terminar: ${faltan.join(', ')}. Avísalo: ejecutarlo antes puede generar conflictos.`);
    if (s?.estado === 'hecho') lineas.push(`⚠ Ya se ejecutó (${s.hecho.fecha.slice(0, 16)}, ${s.hecho.colaborador}). Volver a ejecutarlo puede generar conflictos: confírmalo y registra el motivo.`);
    for (const c of s?.conflictos ?? []) lineas.push(`⚠ Conflicto: ${c}.`);
    // Referencias de §31 del área y de los requisitos del prompt: para tenerlas en cuenta en la spec, el plan y el código.
    const refs = referenciasPara({ ids: [...new Set(p.texto.match(/\b(?:RF|RNF|MC|RN|CQ|VC|PS)-\d{2,3}\b/g) ?? [])], modulos: [p.sdd] }, cargarCatalogo(root));
    if (refs.length) lineas.push(`Referencias de §31 que aplican a este paso (tenlas en cuenta y cítalas en lo que produzca; skill referencias-documento):\n${listaReferencias(refs)}`);
    if (difiere(prompt, p.texto)) lineas.push('⚠ El texto pegado difiere del prompt registrado en el SDD: es una MODIFICACIÓN. Pregunta si se actualiza el SDD con la versión nueva (edita el bloque del prompt en su archivo) y registra la decisión «modificar» con el motivo.');
    lineas.push(
      'ANTES de ejecutarlo, confirma con la persona con una pregunta de OPCIÓN MÚLTIPLE (AskUserQuestion en Claude Code; lista numerada en otros asistentes): «Ejecutar tal cual (Recomendado)» · «Modificarlo antes de ejecutar» · «Posponer u omitir». Registra la respuesta:',
      `  node ai/scripts/sdd.mjs confirmar ${id} --decision ejecutar|modificar|omitir --nota "<motivo>"`,
      'Si elige modificar: acuerda el cambio, edita el prompt en su archivo de sdd/ y luego ejecútalo.',
      'AL TERMINAR registra el resultado y muestra a la persona el siguiente prompt tal como lo imprime el comando, en un bloque listo para copiar:',
      `  node ai/scripts/sdd.mjs registrar ${id} --resultado hecho|parcial|conflicto|en-espera --nota "<qué pasó, cambios o conflictos>"`,
    );
    guardarEnCurso(root, { id, sesion: sesion ?? null, estado: 'por-confirmar', inicio: new Date().toISOString() });
    return lineas.join('\n');
  } catch {
    return null;
  }
}

/**
 * Fin de turno: motivo para seguir (registrar y mostrar el siguiente) o null. No insiste si ya se pidió una vez
 * (stopHookActive), si se espera la confirmación de la persona o si el prompt quedó «en-espera».
 */
export function motivoDeFinSdd({ cwd, sesion, stopHookActive }) {
  if (stopHookActive) return null;
  try {
    const root = raizDe(cwd);
    const curso = leerEnCurso(root);
    if (!curso || curso.estado !== 'en-ejecucion') return null;
    if (curso.sesion && sesion && curso.sesion !== sesion) return null;
    const registrado = leerHistorial(root).some((h) => h.id === curso.id && h.tipo === 'resultado' && h.fecha >= curso.inicio);
    if (registrado) return null;
    return [
      `[SDD] El prompt ${curso.id} se ejecutó y todavía no está en el historial. Antes de terminar:`,
      `1. Registra el resultado: node ai/scripts/sdd.mjs registrar ${curso.id} --resultado hecho|parcial|conflicto|en-espera --nota "<qué pasó, cambios o conflictos>"`,
      '   (usa «en-espera» si estás esperando una respuesta o aprobación de la persona).',
      '2. Muestra a la persona el siguiente prompt tal como lo imprime ese comando, en un bloque ```text listo para copiar y pegar.',
    ].join('\n');
  } catch {
    return null;
  }
}

/** Línea del inicio de sesión: siguiente prompt de quien está registrado y conflictos del historial. */
export function lineaSdd(cwd) {
  try {
    const root = raizDe(cwd);
    const prompts = todosLosPrompts(cargarSdds(root));
    if (!prompts.length) return '';
    const est = estados(prompts, leerHistorial(root));
    const hechos = prompts.filter((p) => est.get(p.id).estado === 'hecho').length;
    const conflictos = prompts.filter((p) => est.get(p.id).conflictos.length).map((p) => p.id);
    const yo = leerIdentidad(root);
    const sig = siguiente(prompts, est, { persona: yo?.nombre });
    return [
      `[UraqiVision] SDD: ${hechos}/${prompts.length} prompts hechos${conflictos.length ? ` · ⚠ conflictos en ${conflictos.join(', ')} (npm run sdd:estado)` : ''}.`,
      sig ? `Siguiente${yo?.nombre ? ` para ${yo.nombre}` : ''}: ${sig.prompt.id} · ${sig.prompt.titulo} (${sig.prompt.sdd}) → npm run sdd:siguiente` : '',
    ].filter(Boolean).join(' ');
  } catch {
    return '';
  }
}
