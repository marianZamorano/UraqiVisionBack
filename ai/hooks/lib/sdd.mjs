// SDD por área: lee los archivos de sdd/ (un SDD por módulo de §19, más proyecto e integración), valida su
// estructura, calcula el estado de cada prompt a partir del historial (sdd/historial/, un JSON por entrada para que
// no haya conflictos de merge), detecta conflictos (prompt cambiado después de ejecutarse, dependencia re-ejecutada)
// y entrega el siguiente prompt listo para copiar y pegar en cada asistente.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const DIR = 'sdd';
export const HISTORIAL = 'sdd/historial';
export const SECCIONES = [
  '1. Ficha',
  '2. Alcance del documento maestro',
  '3. Reglas y decisiones que aplican',
  '4. Contratos e integración',
  '5. Calidad: pruebas y aceptación',
  '6. Herramientas del repositorio',
  '7. Riesgos y pendientes',
  '8. Secuencia de prompts',
  '9. Definición de terminado',
];
export const CLAVES = ['Orden', 'Fase', 'Comando', 'Ejecuta', 'Revisa', 'Depende de', 'Momento', 'Produce', 'Herramientas', 'Verificación'];
export const TIPOS = ['proyecto', 'modulo', 'integracion'];
export const RESULTADOS = ['hecho', 'parcial', 'conflicto', 'en-espera', 'omitido'];
export const DECISIONES = ['ejecutar', 'modificar', 'omitir'];
const ID_PROMPT = /^P-[A-Z]+-\d{2}$/;

export const hashPrompt = (texto) => crypto.createHash('sha1').update(String(texto).replace(/\r\n/g, '\n').trim()).digest('hex').slice(0, 10);

/** Frontmatter simple (clave: valor) de un SDD. */
function frontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) return null;
  return Object.fromEntries(m[1].split(/\r?\n/).map((l) => /^([\w-]+):\s*(.*)$/.exec(l)).filter(Boolean).map((x) => [x[1], x[2].trim()]));
}

/** Un archivo SDD → { archivo, meta, secciones, prompts: [{ id, titulo, datos, texto, hash, linea }] } */
export function parsearSdd(texto, archivo) {
  const t = String(texto).replace(/\r\n/g, '\n');
  const meta = frontmatter(t);
  const secciones = [...t.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  const prompts = [];
  const lineas = t.split('\n');
  for (let i = 0; i < lineas.length; i += 1) {
    const h = /^### (P-[A-Z]+-\d{2}) · (.+)$/.exec(lineas[i]);
    if (!h) continue;
    const p = { id: h[1], titulo: h[2].trim(), datos: {}, texto: null, linea: i + 1 };
    let j = i + 1;
    for (; j < lineas.length && !/^#{2,3} /.test(lineas[j]); j += 1) {
      const kv = /^- \*\*([^*]+):\*\* (.+)$/.exec(lineas[j]);
      if (kv) p.datos[kv[1].trim()] = kv[2].trim();
      if (lineas[j].startsWith('```text') && p.texto === null) {
        const fin = lineas.findIndex((l, k) => k > j && l.startsWith('```'));
        p.texto = lineas.slice(j + 1, fin < 0 ? undefined : fin).join('\n').trim();
        j = fin < 0 ? lineas.length : fin;
      }
    }
    p.hash = p.texto ? hashPrompt(p.texto) : null;
    p.dependencias = (p.datos['Depende de'] ?? '').match(/P-[A-Z]+-\d{2}/g) ?? [];
    p.ejecutores = (p.datos.Ejecuta ?? '').replace(/\(.*?\)/g, '').split(/,|\s+y\s+|\//).map((n) => n.trim()).filter(Boolean);
    p.orden = Number(p.datos.Orden);
    p.sdd = meta?.id;
    p.archivo = archivo;
    prompts.push(p);
    i = j - 1;
  }
  return { archivo, meta, secciones, prompts };
}

/** Todos los SDD del repositorio. leer(ruta) → texto; lista los .md de sdd/ salvo README y la plantilla. */
export function cargarSdds(root) {
  const dir = path.join(root, DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.md$/.test(f) && !/^(README|00-estructura)\.md$/i.test(f)).sort()
    .map((f) => parsearSdd(fs.readFileSync(path.join(dir, f), 'utf8'), `${DIR}/${f}`));
}

export const todosLosPrompts = (sdds) => sdds.flatMap((s) => s.prompts).sort((a, b) => a.orden - b.orden);

/**
 * Valida la estructura. contexto: { colaboradores, repoModulos, skills } (para comprobar nombres, módulos y comandos).
 * → [errores]
 */
export function validar(sdds, { colaboradores = [], repoModulos = [], skills = [] } = {}) {
  const e = [];
  const ids = new Map();
  const ordenes = new Map();
  for (const s of sdds) {
    const a = s.archivo;
    if (!s.meta) { e.push(`${a}: falta el frontmatter (id, titulo, tipo, prefijo, spec)`); continue; }
    for (const k of ['id', 'titulo', 'tipo', 'prefijo', 'spec']) if (!s.meta[k]) e.push(`${a}: falta «${k}» en el frontmatter`);
    if (s.meta.tipo && !TIPOS.includes(s.meta.tipo)) e.push(`${a}: tipo debe ser ${TIPOS.join(', ')}`);
    if (s.meta.tipo === 'modulo' && repoModulos.length && !repoModulos.includes(s.meta.id)) e.push(`${a}: el módulo ${s.meta.id} no es de este repositorio (package.json → uraqi.modulos)`);
    const faltan = SECCIONES.filter((x) => !s.secciones.includes(x));
    if (faltan.length) e.push(`${a}: faltan secciones obligatorias: ${faltan.join(' | ')}`);
    else if (SECCIONES.some((x, i) => s.secciones.indexOf(x) < (i ? s.secciones.indexOf(SECCIONES[i - 1]) : -1))) e.push(`${a}: las secciones obligatorias deben ir en orden (${SECCIONES.join(' → ')})`);
    if (!s.prompts.length) e.push(`${a}: no tiene prompts en «8. Secuencia de prompts»`);
    for (const p of s.prompts) {
      const donde = `${a}:${p.linea} ${p.id}`;
      if (!ID_PROMPT.test(p.id) || (s.meta.prefijo && !p.id.startsWith(`P-${s.meta.prefijo}-`))) e.push(`${donde}: el identificador debe ser P-${s.meta.prefijo}-NN`);
      if (ids.has(p.id)) e.push(`${donde}: identificador repetido (también en ${ids.get(p.id)})`);
      ids.set(p.id, a);
      for (const k of CLAVES) if (!p.datos[k]) e.push(`${donde}: falta «- **${k}:** …»`);
      if (!Number.isInteger(p.orden) || p.orden < 1) e.push(`${donde}: Orden debe ser un entero positivo`);
      else if (ordenes.has(p.orden)) e.push(`${donde}: Orden ${p.orden} repetido (también ${ordenes.get(p.orden)})`);
      else ordenes.set(p.orden, p.id);
      if (!p.texto) e.push(`${donde}: falta el bloque \`\`\`text con el prompt`);
      else if (!p.texto.startsWith(`[SDD ${p.id}]`)) e.push(`${donde}: el prompt debe empezar con «[SDD ${p.id}]»`);
      const cmd = (p.datos.Comando ?? '').replace(/`/g, '').trim();
      if (cmd && cmd !== '—' && skills.length && !skills.includes(cmd)) e.push(`${donde}: el comando «${cmd}» no es una skill del repositorio`);
      if (p.texto && cmd && cmd !== '—' && !p.texto.includes(`/${cmd}`)) e.push(`${donde}: el prompt no invoca /${cmd}`);
      for (const n of p.ejecutores) if (n !== 'Equipo' && colaboradores.length && !colaboradores.includes(n)) e.push(`${donde}: «${n}» no figura en §19 (usa un nombre del equipo o «Equipo»)`);
    }
  }
  const porId = new Map(sdds.flatMap((s) => s.prompts).map((p) => [p.id, p]));
  for (const p of porId.values()) {
    for (const d of p.dependencias) {
      if (!porId.has(d)) e.push(`${p.archivo}:${p.linea} ${p.id}: depende de ${d}, que no existe`);
      else if (porId.get(d).orden >= p.orden) e.push(`${p.archivo}:${p.linea} ${p.id}: depende de ${d}, que va después (Orden ${porId.get(d).orden} ≥ ${p.orden})`);
    }
  }
  return e;
}

// ------------------------------------------------------------------ Historial y estado

/** Entradas del historial ordenadas por fecha. */
export function leerHistorial(root) {
  const dir = path.join(root, HISTORIAL);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => { try { return { ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), archivo: `${HISTORIAL}/${f}` }; } catch { return null; } })
    .filter(Boolean).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

/** Escribe una entrada: un archivo por entrada (sin conflictos al fusionar ramas). */
export function escribirEntrada(root, entrada) {
  const dir = path.join(root, HISTORIAL);
  fs.mkdirSync(dir, { recursive: true });
  const fecha = entrada.fecha ?? new Date().toISOString();
  const nombre = `${fecha.replace(/[:.]/g, '-')}_${entrada.id}_${(entrada.colaborador ?? 'sin-identificar').replace(/[^\w-]/g, '')}_${entrada.tipo}.json`;
  fs.writeFileSync(path.join(dir, nombre), `${JSON.stringify({ ...entrada, fecha }, null, 2)}\n`);
  return `${HISTORIAL}/${nombre}`;
}

/**
 * Estado de cada prompt: { estado: 'pendiente'|RESULTADOS, ultima, hecho, conflictos: [] }.
 * Conflictos: resultado «conflicto»; el prompt cambió después de ejecutarse; una dependencia se ejecutó de nuevo
 * después que este prompt.
 */
export function estados(prompts, historial) {
  const res = new Map();
  for (const p of prompts) {
    const propias = historial.filter((h) => h.id === p.id && h.tipo === 'resultado');
    const ultima = propias.at(-1) ?? null;
    const hecho = [...propias].reverse().find((h) => h.resultado === 'hecho') ?? null;
    res.set(p.id, { estado: ultima?.resultado ?? 'pendiente', ultima, hecho, conflictos: [] });
  }
  for (const p of prompts) {
    const s = res.get(p.id);
    if (s.estado === 'conflicto') s.conflictos.push(`marcado como conflicto: ${s.ultima?.nota ?? 'sin nota'}`);
    if (s.hecho && s.hecho.hash && p.hash && s.hecho.hash !== p.hash) s.conflictos.push(`el prompt cambió después de ejecutarse (${s.hecho.fecha.slice(0, 16)}): revisa si hay que ejecutarlo de nuevo`);
    for (const d of p.dependencias) {
      const ds = res.get(d);
      if (s.hecho && ds?.hecho && ds.hecho.fecha > s.hecho.fecha) s.conflictos.push(`${d} se ejecutó de nuevo después: revisa si este resultado sigue vigente`);
    }
  }
  return res;
}

const resuelto = (s) => s && ['hecho', 'omitido'].includes(s.estado);

/**
 * Siguiente prompt. despues: id recién ejecutado (prioriza la misma secuencia). persona: solo los que ejecuta esa
 * persona (o «Equipo»). → { prompt, bloqueadoPor: [ids] } o null si no queda ninguno.
 */
export function siguiente(prompts, est, { despues, persona } = {}) {
  const deLaPersona = (p) => !persona || p.ejecutores.includes(persona) || p.ejecutores.includes('Equipo');
  const listo = (p) => p.dependencias.every((d) => resuelto(est.get(d)));
  const base = despues ? prompts.find((p) => p.id === despues) : null;
  // El prompt recién ejecutado quedó parcial, en espera o en conflicto: lo que sigue es continuarlo.
  if (base && !resuelto(est.get(base.id))) return { prompt: base, bloqueadoPor: [], continuar: true };
  const candidatos = prompts.filter((p) => !resuelto(est.get(p.id)) && deLaPersona(p));
  const ordenados = base
    ? [...candidatos.filter((p) => p.sdd === base.sdd), ...candidatos.filter((p) => p.sdd !== base.sdd)]
    : candidatos;
  const elegido = ordenados.find(listo);
  if (elegido) return { prompt: elegido, bloqueadoPor: [] };
  const primero = ordenados[0];
  return primero ? { prompt: primero, bloqueadoPor: primero.dependencias.filter((d) => !resuelto(est.get(d))) } : null;
}

// ------------------------------------------------------------------ Formato por asistente

/** Adapta los comandos al asistente: Claude /speckit-x · Codex $speckit-x · Gemini y opencode /speckit.x */
export function paraAsistente(texto, asistente = 'claude') {
  const t = String(texto);
  if (asistente === 'codex') return t.replace(/(^|\s)\/((?:speckit|sdd)[\w-]*)/g, '$1$$$2');
  if (asistente === 'gemini' || asistente === 'opencode') return t.replace(/(^|\s)\/speckit-([\w-]+)/g, '$1/speckit.$2');
  return t;
}

/** Bloque del siguiente prompt, listo para copiar y pegar. */
export function textoSiguiente(r, est, { asistente = 'claude', titulo = 'Siguiente prompt' } = {}) {
  if (!r) return '✔ No quedan prompts pendientes en el SDD.';
  const p = r.prompt;
  const deps = p.dependencias.length ? p.dependencias.map((d) => `${d} ${resuelto(est.get(d)) ? '✔' : '⏳'}`).join(', ') : '—';
  return [
    `▶ ${r.continuar ? `Continúa el mismo prompt (quedó «${est.get(p.id)?.estado}»)` : titulo}: ${p.id} · ${p.titulo} (${p.sdd}) — ejecuta ${p.datos.Ejecuta}`,
    `  Depende de: ${deps}${r.bloqueadoPor.length ? `  ⚠ todavía falta: ${r.bloqueadoPor.join(', ')}` : ''}`,
    `  Momento (§25): ${p.datos.Momento} · Produce: ${p.datos.Produce}`,
    '',
    'Cópialo y pégalo tal cual en tu asistente:',
    '',
    '```text',
    paraAsistente(p.texto, asistente),
    '```',
  ].join('\n');
}

/** Tabla del orden global (bloque generado del README). */
export function tablaOrden(sdds) {
  const filas = todosLosPrompts(sdds).map((p) => `| ${p.orden} | \`${p.id}\` | ${p.titulo} | [${p.sdd}](${path.posix.basename(p.archivo)}) | ${(p.datos.Comando ?? '').replace(/`/g, '') === '—' ? '—' : `\`${(p.datos.Comando ?? '').replace(/`/g, '')}\``} | ${p.datos.Ejecuta} | ${p.dependencias.join(', ') || '—'} | ${p.datos.Momento} |`);
  return ['| # | Prompt | Paso | SDD | Comando | Ejecuta | Depende de | Momento (§25) |', '|---|---|---|---|---|---|---|---|', ...filas].join('\n');
}

export const MARCA_INICIO = '<!-- sdd:orden (generado por ai/sync.mjs desde sdd/*.md; no editar a mano) -->';
export const MARCA_FIN = '<!-- /sdd:orden -->';

/** README con el bloque del orden regenerado (o null si el README no tiene las marcas). */
export function readmeConOrden(readme, sdds) {
  const i = readme.indexOf(MARCA_INICIO);
  const f = readme.indexOf(MARCA_FIN);
  if (i < 0 || f < i) return null;
  return `${readme.slice(0, i + MARCA_INICIO.length)}\n\n${tablaOrden(sdds)}\n\n${readme.slice(f)}`;
}

// ------------------------------------------------------------------ Prompt en curso (por clon, .git/)

const archivoEnCurso = (root) => path.join(root, execFileSync('git', ['rev-parse', '--git-path', 'uraqi-sdd-en-curso.json'], { cwd: root, encoding: 'utf8' }).trim());

export function leerEnCurso(root) {
  try { return JSON.parse(fs.readFileSync(archivoEnCurso(root), 'utf8')); } catch { return null; }
}

export function guardarEnCurso(root, datos) {
  fs.writeFileSync(archivoEnCurso(root), JSON.stringify({ ...datos, actualizado: new Date().toISOString() }));
}

export function borrarEnCurso(root) {
  try { fs.rmSync(archivoEnCurso(root)); } catch { /* no había */ }
}

/** Identificador de prompt SDD pegado en un mensaje: «[SDD P-MAPA-01]». */
export const idEnMensaje = (texto) => /\[SDD (P-[A-Z]+-\d{2})\]/.exec(String(texto ?? ''))?.[1] ?? null;

/** ¿El texto pegado difiere del prompt registrado? (ignora espacios y el formato de comando del asistente) */
export function difiere(pegado, registrado) {
  const norm = (s) => String(s).replace(/\$(speckit|sdd)/g, '/$1').replace(/\/speckit\.([\w-]+)/g, '/speckit-$1').replace(/\s+/g, ' ').trim();
  const desde = String(pegado).indexOf('[SDD ');
  return norm(desde >= 0 ? String(pegado).slice(desde) : pegado) !== norm(registrado);
}
