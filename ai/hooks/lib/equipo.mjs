// Equipo y módulos de UraqiVision según §19 del documento maestro (módulo, responsabilidad, requisitos,
// responsable, apoyo y revisor). Se lee de la copia en texto del documento: nada se escribe a mano.
// Sirve para que vibecodear pregunte qué colaborador es la persona (opción múltiple) y avise cuando el trabajo es
// del módulo de otra persona (apoyo a su rol). La identidad se guarda solo en el clon (.git/), nunca se versiona.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DOCUMENTO } from './herramientas.mjs';

const ID = /\b(?:RF|RNF|MC|RN|CQ|VC|PS)-\d{2,3}\b/;
const LINEA_REQ = /^(?:\s*(?:(?:RF|RNF|MC|RN|CQ|VC|PS)-\d{2,3}|a|y)\s*,?)+\s*$/;
const nombres = (s) => String(s).split(/,|\s+y\s+/).map((n) => n.trim()).filter(Boolean);

/** Expande «RF-25 a RF-30, RF-32» en la lista de identificadores. */
export function expandirRequisitos(texto) {
  const out = [];
  for (const m of String(texto).matchAll(/\b([A-Z]+)-(\d{2,3})(?:\s+a\s+\1-(\d{2,3}))?/g)) {
    const desde = Number(m[2]);
    const hasta = m[3] ? Number(m[3]) : desde;
    for (let n = desde; n <= hasta; n += 1) out.push(`${m[1]}-${String(n).padStart(m[2].length, '0')}`);
  }
  return out;
}

/** Módulos de §19: [{ id, responsabilidad, requisitos, responsables, apoyo, revisores }] */
export function parsearEquipo(texto) {
  const lineas = String(texto).split(/\r?\n/).map((l) => l.trim());
  const inicio = lineas.findLastIndex((l) => /^19\.\s+Módulos y responsabilidades/.test(l));
  if (inicio < 0) return [];
  const fin = lineas.findIndex((l, i) => i > inicio && /^20\.\s/.test(l));
  const bloque = lineas.slice(inicio + 1, fin < 0 ? undefined : fin);
  const modulos = [];
  let actual = null;
  for (const l of bloque) {
    if (/^M-[A-ZÁÉÍÓÚÑ]+$/.test(l)) { actual = { id: l, lineas: [] }; modulos.push(actual); }
    else if (actual && l) actual.lineas.push(l);
  }
  return modulos.map(({ id, lineas: L }) => {
    const iReq = L.findIndex((l) => ID.test(l));
    let fReq = iReq;
    while (fReq + 1 < L.length - 1 && LINEA_REQ.test(L[fReq + 1])) fReq += 1;
    const [principal, deApoyo = ''] = L.slice(fReq + 1, -1).join(' ').split(/,?\s*con apoyo\s+de\s+/);
    return {
      id,
      responsabilidad: L.slice(0, iReq).join(' '),
      requisitos: expandirRequisitos(L.slice(iReq, fReq + 1).join(' ')),
      responsables: nombres(principal),
      apoyo: nombres(deApoyo),
      revisores: nombres(L[L.length - 1]),
    };
  });
}

/** Todas las personas que nombra §19, en orden de aparición. */
export function colaboradores(modulos) {
  return [...new Set(modulos.flatMap((m) => [...m.responsables, ...m.apoyo, ...m.revisores]))];
}

/** Roles de una persona: { responsable, apoyo, revisor } con los ids de módulo. */
export function rolesDe(nombre, modulos) {
  const es = (lista) => lista.some((n) => n.toLowerCase() === String(nombre).toLowerCase());
  return {
    responsable: modulos.filter((m) => es(m.responsables)).map((m) => m.id),
    apoyo: modulos.filter((m) => es(m.apoyo)).map((m) => m.id),
    revisor: modulos.filter((m) => es(m.revisores)).map((m) => m.id),
  };
}

/** Nombre tal como aparece en §19 (sin distinguir mayúsculas), o null si no es del equipo. */
export function normalizarNombre(nombre, modulos) {
  return colaboradores(modulos).find((n) => n.toLowerCase() === String(nombre ?? '').trim().toLowerCase()) ?? null;
}

const describir = (roles) => [
  roles.responsable.length ? `responsable de ${roles.responsable.join(', ')}` : '',
  roles.apoyo.length ? `apoyo en ${roles.apoyo.join(', ')}` : '',
  roles.revisor.length ? `revisa ${roles.revisor.join(', ')}` : '',
].filter(Boolean).join('; ') || 'sin rol en §19';

/**
 * Opciones de la pregunta «¿Qué colaborador eres?»: las personas con rol en los módulos de este repositorio
 * (primero responsables, luego apoyo y revisores), como máximo 4; el resto va en «otros» (respuesta libre).
 */
export function opciones(modulos, repoModulos, max = 4) {
  const enRepo = modulos.filter((m) => repoModulos.includes(m.id));
  const orden = [...new Set([...enRepo.flatMap((m) => m.responsables), ...enRepo.flatMap((m) => m.apoyo), ...enRepo.flatMap((m) => m.revisores)])];
  const todas = colaboradores(modulos);
  const lista = orden.slice(0, max).map((n) => {
    const r = rolesDe(n, modulos);
    const aqui = { responsable: r.responsable.filter((x) => repoModulos.includes(x)), apoyo: r.apoyo.filter((x) => repoModulos.includes(x)), revisor: r.revisor.filter((x) => repoModulos.includes(x)) };
    return { nombre: n, descripcion: `Aquí: ${describir(aqui)}. En todo el proyecto: ${describir(r)}.` };
  });
  return { opciones: lista, otros: todas.filter((n) => !lista.some((o) => o.nombre === n)) };
}

/** Módulos que contienen alguno de los identificadores (o que se nombran directamente como M-…). */
export function modulosDe(refs, modulos) {
  const lista = [...new Set(refs)];
  return modulos.filter((m) => lista.some((r) => r === m.id || m.requisitos.includes(r)));
}

/**
 * Alcance del trabajo para una persona. refs: identificadores (RF-05…) o módulos (M-MAPA).
 * → { propios, apoyo: [{modulo, responsables, apoyo, revisores, enRepo}], otroRepo, sinModulo }
 * Un identificador que está en un módulo propio no cuenta como apoyo aunque también esté en otro. Si un
 * identificador está en módulos de los dos repositorios (RF-05: M-MAPA y M-PUBLICACIÓN), cuenta el de este.
 */
export function evaluarAlcance({ nombre, refs, modulos, repoModulos }) {
  const roles = rolesDe(nombre, modulos);
  const mios = new Set([...roles.responsable, ...roles.apoyo]);
  const propios = new Set();
  const ajenos = new Map();
  const sinModulo = [];
  for (const r of new Set(refs)) {
    let ms = modulosDe([r], modulos);
    if (!ms.length) { sinModulo.push(r); continue; }
    if (ms.some((m) => repoModulos.includes(m.id))) ms = ms.filter((m) => repoModulos.includes(m.id));
    const mio = ms.filter((m) => mios.has(m.id));
    if (mio.length) { mio.forEach((m) => propios.add(m.id)); continue; }
    for (const m of ms) ajenos.set(m.id, m);
  }
  const apoyo = [...ajenos.values()].map((m) => ({ modulo: m.id, responsables: m.responsables, apoyo: m.apoyo, revisores: m.revisores, enRepo: repoModulos.includes(m.id) }));
  const mod = (id) => modulos.find((m) => m.id === id);
  const fuera = [...propios].filter((id) => !repoModulos.includes(id));
  return {
    propios: [...propios].filter((id) => repoModulos.includes(id)),
    // Tus módulos que viven en el otro repositorio: se hacen allí.
    propiosOtroRepo: fuera,
    apoyo: apoyo.filter((a) => a.enRepo),
    otroRepo: [...apoyo.filter((a) => !a.enRepo), ...fuera.map((id) => ({ modulo: id, responsables: mod(id).responsables, apoyo: mod(id).apoyo, revisores: mod(id).revisores, enRepo: false, propio: true }))],
    sinModulo,
  };
}

/** Aviso de apoyo a otro rol (o null). */
export function textoApoyo(alcance, nombre) {
  const partes = [];
  const yo = (lista) => lista.some((n) => n.toLowerCase() === String(nombre).toLowerCase());
  for (const a of alcance.apoyo) {
    partes.push(`${a.modulo} es de ${a.responsables.join(' y ')}${a.apoyo.length ? ` (con apoyo de ${a.apoyo.join(' y ')})` : ''}${yo(a.revisores) ? ' y tú lo revisas' : `, lo revisa ${a.revisores.join(' y ')}`}`);
  }
  const derivar = [];
  for (const a of alcance.otroRepo) {
    if (a.propio) derivar.push(`${a.modulo} es tuyo, pero vive en el otro repositorio: hazlo allí, no aquí`);
    else derivar.push(`${a.modulo} no está en este repositorio (es de ${a.responsables.join(' y ')}): derívalo al otro repositorio`);
  }
  const out = [];
  if (partes.length) out.push(`⚠ ${nombre}, vas a apoyar el rol de otra persona: ${partes.join('; ')}. Avísale a quien es responsable antes de avanzar y menciónalo en el issue y en la PR («Apoyo a <responsable> en <módulo>»).`);
  if (derivar.length) out.push(`↪ ${derivar.join('; ')}.`);
  return out.length ? out.join('\n') : null;
}

/** Identificadores del documento en un texto. */
export const idsEn = (texto) => [...new Set(String(texto ?? '').match(new RegExp(ID.source, 'g')) ?? [])];

// ------------------------------------------------------------------ Datos del repositorio (con efectos de lectura)

export function cargarEquipo(root) {
  const abs = path.join(root, DOCUMENTO);
  const modulos = fs.existsSync(abs) ? parsearEquipo(fs.readFileSync(abs, 'utf8')) : [];
  let repoModulos = [];
  try {
    repoModulos = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).uraqi?.modulos ?? [];
  } catch { /* sin package.json */ }
  return { modulos, repoModulos };
}

// ------------------------------------------------------------------ Identidad (solo en el clon, .git/)

const archivoIdentidad = (root) => path.join(root, execFileSync('git', ['rev-parse', '--git-path', 'uraqi-colaborador.json'], { cwd: root, encoding: 'utf8' }).trim());
export const VIGENCIA_SIN_SESION_MS = 12 * 60 * 60 * 1000;

export function leerIdentidad(root) {
  try {
    return JSON.parse(fs.readFileSync(archivoIdentidad(root), 'utf8'));
  } catch {
    return null;
  }
}

export function guardarIdentidad(root, { nombre, sesion }) {
  const previo = leerIdentidad(root);
  const datos = { nombre, fecha: Date.now() };
  // Conserva la sesión que anotó el hook si es la misma persona y se registró hace menos de un minuto.
  const s = sesion ?? (previo?.nombre === nombre && Date.now() - (previo.fecha ?? 0) < 60000 ? previo.sesion : undefined);
  if (s) datos.sesion = s;
  fs.writeFileSync(archivoIdentidad(root), JSON.stringify(datos));
  return datos;
}

export function olvidarIdentidad(root) {
  try { fs.rmSync(archivoIdentidad(root)); } catch { /* no había */ }
}

/** ¿La identidad vale para esta sesión? Con id de sesión, debe coincidir; sin él, vale 12 horas. */
export function identidadVigente(datos, sesion, ahora = Date.now()) {
  if (!datos?.nombre) return false;
  if (sesion) return datos.sesion === sesion;
  return ahora - (datos.fecha ?? 0) < VIGENCIA_SIN_SESION_MS;
}

/** Comando que registra la identidad: `node ai/scripts/equipo.mjs soy <Nombre>` → nombre o null. */
export function nombreDeComandoSoy(command) {
  return /\bai\/scripts\/equipo\.mjs["']?\s+soy\s+["']?([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/.exec(String(command ?? ''))?.[1]
    ?? /\bnpm\s+run\s+(?:-s\s+)?equipo:soy\s+--\s+["']?([A-Za-zÁÉÍÓÚÑáéíóúñ]+)/.exec(String(command ?? ''))?.[1]
    ?? null;
}

/** ¿La herramienta está cargando la skill vibecodear? (Skill en Claude; lectura de su SKILL.md en el resto). */
export function cargaVibecodear(tool, input) {
  const t = String(tool ?? '').toLowerCase();
  if (t === 'skill') return /^(?:[\w-]+:)?vibecodear$/.test(String(input?.skill ?? input?.name ?? ''));
  if (['read', 'read_file', 'view'].includes(t)) return /(?:^|[\\/])\.(?:agents|claude)[\\/]skills[\\/]vibecodear[\\/]SKILL\.md$/.test(String(input?.file_path ?? input?.path ?? input?.absolute_path ?? ''));
  return false;
}

// ------------------------------------------------------------------ Uso desde los hooks (nunca lanzan)

const raizDe = (cwd) => execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Guarda: si el asistente registra la identidad, anota la sesión; si carga vibecodear sin identidad, el motivo de bloqueo. */
export function guardaVibecodear({ tool, input, cwd, sesion }) {
  let root;
  try { root = raizDe(cwd); } catch { return null; }
  const equipo = cargarEquipo(root);
  if (!equipo.modulos.length) return null;
  const soy = normalizarNombre(nombreDeComandoSoy(input?.command), equipo.modulos);
  if (soy) { try { guardarIdentidad(root, { nombre: soy, sesion }); } catch { /* sin .git escribible */ } return null; }
  if (!cargaVibecodear(tool, input) || identidadVigente(leerIdentidad(root), sesion)) return null;
  return `[uraqi-guard:colaborador-sin-identificar] ${textoPedirIdentidad(equipo)}`;
}

/** Recordatorio para el mensaje del usuario: pide vibecodear y nadie se identificó en esta sesión. */
export function recordatorioVibecodear({ prompt, cwd, sesion }) {
  if (!/vibecode/i.test(String(prompt ?? ''))) return null;
  try {
    const root = raizDe(cwd);
    const equipo = cargarEquipo(root);
    if (!equipo.modulos.length || identidadVigente(leerIdentidad(root), sesion)) return null;
    return `[UraqiVision] Antes de vibecodear: ${textoPedirIdentidad(equipo)}`;
  } catch {
    return null;
  }
}

const archivoAvisos = (root) => path.join(root, execFileSync('git', ['rev-parse', '--git-path', 'uraqi-apoyo-avisado.json'], { cwd: root, encoding: 'utf8' }).trim());

/**
 * Aviso de apoyo a otro rol por los identificadores de un texto (lo editado o el mensaje de commit), si hay
 * identidad registrada. Con sesion, avisa una sola vez por módulo y sesión.
 */
export function avisoDeApoyo({ texto, cwd, sesion }) {
  try {
    const root = raizDe(cwd);
    const id = leerIdentidad(root);
    const refs = idsEn(texto);
    if (!id?.nombre || !refs.length) return null;
    const { modulos, repoModulos } = cargarEquipo(root);
    const alcance = evaluarAlcance({ nombre: id.nombre, refs, modulos, repoModulos });
    if (sesion) {
      let previos = {};
      try { previos = JSON.parse(fs.readFileSync(archivoAvisos(root), 'utf8')); } catch { previos = {}; }
      const vistos = new Set(previos.sesion === sesion ? previos.modulos : []);
      alcance.apoyo = alcance.apoyo.filter((a) => !vistos.has(a.modulo));
      alcance.otroRepo = alcance.otroRepo.filter((a) => !vistos.has(a.modulo));
      [...alcance.apoyo, ...alcance.otroRepo].forEach((a) => vistos.add(a.modulo));
      fs.writeFileSync(archivoAvisos(root), JSON.stringify({ sesion, modulos: [...vistos] }));
    }
    return textoApoyo(alcance, id.nombre);
  } catch {
    return null;
  }
}

/** Línea para el inicio de sesión: quién está registrado en el clon. */
export function lineaDeSesion(cwd) {
  try {
    const root = raizDe(cwd);
    const { modulos, repoModulos } = cargarEquipo(root);
    if (!modulos.length) return '';
    const id = leerIdentidad(root);
    if (!id?.nombre) return '[UraqiVision] Colaborador: sin identificar en este clon. vibecodear preguntará quién eres (§19).';
    const r = rolesDe(id.nombre, modulos);
    const aqui = [...r.responsable, ...r.apoyo].filter((m) => repoModulos.includes(m));
    return `[UraqiVision] Último colaborador registrado en este clon: ${id.nombre} (aquí: ${aqui.join(', ') || 'sin módulos propios'}). vibecodear vuelve a preguntarlo en cada sesión.`;
  } catch {
    return '';
  }
}

/** Mensaje para pedir la identificación (lo usan la guarda y el recordatorio del mensaje). */
export function textoPedirIdentidad({ modulos, repoModulos }) {
  const { opciones: ops, otros } = opciones(modulos, repoModulos);
  return [
    'vibecodear necesita saber primero qué colaborador es la persona (§19), para no desarrollar algo que no le corresponde.',
    'Pregúntaselo con una pregunta de OPCIÓN MÚLTIPLE (en Claude Code, la herramienta AskUserQuestion; en otros asistentes, una lista numerada) «¿Qué colaborador eres?» con estas opciones:',
    ...ops.map((o, i) => `  ${i + 1}. ${o.nombre} — ${o.descripcion}`),
    otros.length ? `  (otra persona del equipo, respuesta libre: ${otros.join(', ')})` : '',
    'No lo deduzcas del usuario de git ni lo respondas tú. Con la respuesta, regístrala: node ai/scripts/equipo.mjs soy <Nombre>',
    'Opciones en JSON: node ai/scripts/equipo.mjs opciones --json',
  ].filter(Boolean).join('\n');
}
