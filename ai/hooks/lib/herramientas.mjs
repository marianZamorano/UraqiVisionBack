// Cambios en las herramientas de IA (skills, subagentes, MCP, hooks, guardas, workflows, scripts y ayuda) y su
// coherencia con el documento maestro (§28: no inventar identificadores; §29: decisiones pendientes).
// Funciones puras, salvo cargarDocumento, que lee la copia en texto del documento maestro.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

export const DOCUMENTO = 'docs/UraqiVisionDocumentoMaestrov1.0.txt';

/** Lo que genera ai/sync.mjs: no es una pieza propia, se regenera desde las fuentes. */
export const GENERADO = /^(ai\/README\.md$|\.claude\/|\.gemini\/|\.codex\/|\.opencode\/|\.mcp\.json$|opencode\.json$)/;

// [categoría, patrón, nombre de la pieza (del match), ¿es el archivo principal de la pieza?]
const PIEZAS = [
  ['Spec Kit', /^\.agents\/skills\/(speckit-[^/]+)\/(.+)$/, (m) => m[1], (m) => m[2] === 'SKILL.md'],
  ['Spec Kit', /^\.specify\/(.+)$/, (m) => m[1], () => true],
  ['skill', /^\.agents\/skills\/([^/]+)\/(.+)$/, (m) => m[1], (m) => m[2] === 'SKILL.md'],
  ['subagente', /^ai\/agents\/([^/]+)\.md$/, (m) => m[1], () => true],
  ['servidor MCP', /^ai\/mcp\/(.+)$/, (m) => m[1], () => true],
  ['servidor MCP', /^ai\/(?:qa|devops)\/mcp-servers\/([^/]+)\/(.+)$/, (m) => m[1], (m) => m[2] === 'server.mjs'],
  ['pruebas de las guardas', /^ai\/hooks\/test\/(.+)$/, (m) => m[1], () => true],
  ['guarda', /^ai\/hooks\/lib\/(.+)$/, (m) => m[1], () => true],
  ['hook de git', /^ai\/hooks\/(git-[^/]+)\.mjs$/, (m) => m[1].slice(4), () => true],
  ['hook de git', /^\.githooks\/([^/]+)$/, (m) => m[1], () => true],
  ['hook de los asistentes', /^ai\/hooks\/([^/]+)$/, (m) => m[1], () => true],
  ['workflow', /^\.github\/workflows\/([^/]+)$/, (m) => m[1], () => true],
  ['plantilla de GitHub', /^\.github\/(.+)$/, (m) => m[1], () => true],
  ['ayuda', /^ai\/docs\/(.+)$/, (m) => m[1], () => true],
  ['ayuda', /^ai\/(sync\.mjs)$/, (m) => m[1], () => true],
  ['script', /^ai\/scripts\/(.+)$/, (m) => m[1], () => true],
  ['herramienta de QA o DevOps', /^ai\/(qa|devops)\/(.+)$/, (m) => `${m[1]}/${m[2]}`, () => true],
  ['scripts npm', /^(package\.json|commitlint\.config\.mjs)$/, (m) => m[1], () => true],
  ['instrucciones de los asistentes', /^(AGENTS\.md|CLAUDE\.md|GEMINI\.md)$/, (m) => m[1], () => true],
];

/** { categoria, nombre, principal } de una ruta de herramienta; { generado: true } si la genera el sync; o null. */
export function clasificarHerramienta(ruta) {
  const p = String(ruta).replace(/\\/g, '/').replace(/^\.\//, '');
  if (GENERADO.test(p)) return { generado: true };
  for (const [categoria, re, nombre, principal] of PIEZAS) {
    const m = re.exec(p);
    if (m) return { categoria, nombre: nombre(m), principal: principal(m) };
  }
  return null;
}

export const esFuenteDeHerramienta = (ruta) => {
  const c = clasificarHerramienta(ruta);
  return Boolean(c && !c.generado);
};

const ESTADO = { A: 'nueva', '??': 'nueva', M: 'modificada', R: 'renombrada', C: 'copiada', D: 'borrada' };

/**
 * entries: [{ status: 'A'|'M'|'D'|'R'|'??', path }] → { piezas: [{categoria, nombre, estado, archivos}], generados, otros }
 * El estado de una pieza es el de su archivo principal (SKILL.md, server.mjs…); si no cambió, «modificada».
 */
export function resumirCambios(entries) {
  const piezas = new Map();
  let generados = 0;
  let otros = 0;
  for (const e of entries) {
    const c = clasificarHerramienta(e.path);
    if (!c) { otros += 1; continue; }
    if (c.generado) { generados += 1; continue; }
    const clave = `${c.categoria}\u0000${c.nombre}`;
    if (!piezas.has(clave)) piezas.set(clave, { categoria: c.categoria, nombre: c.nombre, estado: 'modificada', archivos: [] });
    const pieza = piezas.get(clave);
    pieza.archivos.push(e.path);
    if (c.principal) pieza.estado = ESTADO[String(e.status)[0] === '?' ? '??' : String(e.status)[0]] ?? 'modificada';
  }
  const lista = [...piezas.values()].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));
  return { piezas: lista, generados, otros };
}

/** Líneas de texto (markdown) con las piezas agrupadas por categoría. */
export function textoResumen({ piezas }) {
  const porCategoria = new Map();
  for (const p of piezas) {
    if (!porCategoria.has(p.categoria)) porCategoria.set(p.categoria, []);
    porCategoria.get(p.categoria).push(`\`${p.nombre}\` (${p.estado})`);
  }
  return [...porCategoria.entries()].map(([c, l]) => `- ${c}: ${l.join(', ')}`);
}

// ------------------------------------------------------------------ Documento maestro

/** Identificadores del documento maestro (§28 regla 5). OE y OG se citan sin guion (OE3), no se validan. */
export const ID = /\b(RF|RNF|MC|RN|CQ|VC|PS|DP|CU|HU)-\d{2,3}\b/g;
const SECCION = /§\s?(\d{1,2}(?:\.\d{1,2})*)(?![\d.]*\d)/g;

/** { ids: Set, secciones: Set, pendientes: Set } a partir del texto del documento maestro. */
export function analizarDocumento(texto) {
  const ids = new Set(String(texto).match(ID) ?? []);
  const secciones = new Set();
  for (const m of String(texto).matchAll(/^(\d{1,2}(?:\.\d{1,2})*)\.?[ \t]+\S/gm)) secciones.add(m[1]);
  const pendientes = new Set([...ids].filter((i) => i.startsWith('DP-')));
  return { ids, secciones, pendientes };
}

/** Lee el documento maestro del repositorio, o null si no existe. */
export function cargarDocumento(root) {
  const abs = path.join(root, DOCUMENTO);
  return fs.existsSync(abs) ? analizarDocumento(fs.readFileSync(abs, 'utf8')) : null;
}

/** Archivos de herramientas cuyo texto se revisa (no binarios, no generados, no las pruebas con datos inventados). */
export function revisable(ruta) {
  const p = String(ruta).replace(/\\/g, '/');
  if (!esFuenteDeHerramienta(p) || /^ai\/hooks\/test\//.test(p) || /(^|\/)test(s)?\/|\.test\.m?js$|fixtures?\//.test(p)) return false;
  return /\.(md|mjs|js|cjs|json|ya?ml|toml|sh|py|txt)$|^\.githooks\//.test(p);
}

/**
 * Coherencia de archivos de herramientas con el documento maestro y con las reglas de las piezas.
 * archivos: [{ path, texto, agregadas? }] (agregadas: solo las líneas nuevas; para avisos de decisiones pendientes).
 * doc: resultado de analizarDocumento (o null si no existe el documento).
 * → { errores: [string], avisos: [string] }
 */
export function coherencia(archivos, doc) {
  const errores = [];
  const avisos = [];
  if (!doc) {
    errores.push(`No existe ${DOCUMENTO}: sin la copia en texto del documento maestro no se puede comprobar la coherencia (ai/scripts/extraer_documento.py la regenera).`);
    return { errores, avisos };
  }
  for (const { path: ruta, texto, agregadas } of archivos) {
    const p = String(ruta).replace(/\\/g, '/');
    if (!revisable(p) || texto == null) continue;

    const inexistentes = [...new Set(String(texto).match(ID) ?? [])].filter((i) => !doc.ids.has(i));
    if (inexistentes.length) errores.push(`${p}: cita ${inexistentes.join(', ')}, que no existe(n) en el documento maestro (§28: no inventes identificadores).`);

    const secciones = [...new Set([...String(texto).matchAll(SECCION)].map((m) => m[1]))].filter((s) => !doc.secciones.has(s));
    if (secciones.length) errores.push(`${p}: cita ${secciones.map((s) => `§${s}`).join(', ')}, que no existe(n) en el documento maestro.`);

    const pendientes = [...new Set(String(agregadas ?? texto).match(ID) ?? [])].filter((i) => doc.pendientes.has(i));
    if (pendientes.length) avisos.push(`${p}: menciona ${pendientes.join(', ')}, decisión(es) pendiente(s) (§29): no la(s) des por resuelta(s) ni implementes lo que depende de ella(s).`);

    const skill = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(p);
    const agente = /^ai\/agents\/([^/]+)\.md$/.exec(p);
    if (skill || agente) {
      try {
        const { data } = parseFrontmatter(String(texto), p);
        const esperado = (skill ?? agente)[1];
        if (data.name !== esperado) errores.push(`${p}: el name del frontmatter («${data.name}») debe ser «${esperado}».`);
        if (agente && data.access && !['read', 'write'].includes(data.access)) errores.push(`${p}: access debe ser read o write (contrato supervisado, §28).`);
      } catch (err) {
        errores.push(err.message);
      }
    }

    if (p === 'ai/mcp/servers.json') {
      try {
        for (const [n, s] of Object.entries(JSON.parse(String(texto)).servers ?? {})) {
          if (!s.description) errores.push(`${p}: el servidor MCP «${n}» necesita description.`);
          if (typeof s.effects !== 'boolean') errores.push(`${p}: el servidor MCP «${n}» debe declarar effects (true si tiene efectos y pide aprobación; contrato supervisado, §28).`);
        }
      } catch (err) {
        errores.push(`${p}: JSON inválido (${err.message}).`);
      }
    }
  }
  return { errores, avisos };
}

// ------------------------------------------------------------------ Aviso a los colaboradores (GitHub)

export const MARCA_REVISION = '<!-- uraqi-herramientas-revision -->';
export const MARCA_AVISO = '<!-- uraqi-herramientas-aviso -->';

/** Comentario de aviso. Las menciones en un comentario NUEVO notifican a cada persona (editar uno no notifica). */
export function textoAviso({ numero, titulo, autor, base, menciones, lineas, errores = [], avisos = [] }) {
  return [
    MARCA_AVISO,
    `### 📣 Cambiaron herramientas de IA en \`${base}\``,
    '',
    `${menciones.length ? `${menciones.map((m) => `@${m}`).join(' ')} — l` : 'L'}a PR #${numero} («${titulo}») de @${autor} cambió:`,
    '',
    ...lineas,
    '',
    errores.length ? `**✘ Coherencia con el documento maestro:**\n${errores.map((e) => `- ${e}`).join('\n')}` : '✔ Coherente con el documento maestro (identificadores, secciones, frontmatter y MCP).',
    ...avisos.map((a) => `- ⚠ ${a}`),
    '',
    `**Qué hacer**: \`git switch ${base} && git pull\`. Los hooks regeneran la ayuda (\`ai/README.md\`, skill \`ayuda\`) y`,
    'verifican que todo funcione y esté activo; tu asistente te lo resume al iniciar sesión. Comprobación manual:',
    '`npm run ai:verificar`. Qué hace cada pieza: skill `ayuda` o `npm run ayuda -- <tema>`.',
  ].join('\n');
}

/** Líneas agregadas de un diff unificado (sin las cabeceras +++), por archivo. */
export function lineasAgregadas(diff) {
  const porArchivo = new Map();
  let actual = null;
  for (const l of String(diff).split('\n')) {
    if (l.startsWith('+++ ')) {
      actual = l.startsWith('+++ b/') ? l.slice(6) : null;
      if (actual && !porArchivo.has(actual)) porArchivo.set(actual, []);
    } else if (actual && l.startsWith('+')) porArchivo.get(actual).push(l.slice(1));
  }
  return new Map([...porArchivo].map(([k, v]) => [k, v.join('\n')]));
}
