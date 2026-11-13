// Referencias de §31 del documento maestro: catálogo (ai/referencias/catalogo.json) validado contra §31, qué
// referencias aplican a cada requisito o módulo, bloques generados para las skills y los SDD, y revisión de que la
// implementación las tenga en cuenta (que se citen donde se implementan sus requisitos) y de que no aparezcan DOI que
// §31 no recoge (§28: no inventar referencias). Funciones puras salvo cargarCatalogo y avisoReferencias.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DOCUMENTO, analizarDocumento, esFuenteDeHerramienta, GENERADO } from './herramientas.mjs';

export const CATALOGO = 'ai/referencias/catalogo.json';
export const TIPOS = ['guia-oficial', 'software', 'articulo', 'fuente-boliviana', 'noticia', 'reto'];
export const MARCA_INICIO = '<!-- referencias:inicio (generado por ai/sync.mjs desde ai/referencias/catalogo.json; no editar a mano) -->';
export const MARCA_FIN = '<!-- referencias:fin -->';
const ID_DOC = /\b(?:RF|RNF|MC|RN|CQ|VC|PS)-\d{2,3}\b/g;

export function cargarCatalogo(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, CATALOGO), 'utf8')).referencias ?? []; } catch { return []; }
}

/** Texto de §31 (Referencias) del documento maestro. */
export function seccionReferencias(docTexto) {
  const lineas = String(docTexto).split(/\r?\n/);
  const i = lineas.findLastIndex((l) => /^31\.\s+Referencias/.test(l.trim()));
  return i < 0 ? '' : lineas.slice(i).filter((l) => !/^=== PAGE ===$|^\d+$/.test(l.trim())).join('\n');
}

/** Errores del catálogo frente a §31 y al resto del documento. modulos: ids de §19. */
export function validarCatalogo(catalogo, docTexto, { modulos = [] } = {}) {
  const e = [];
  const s31 = seccionReferencias(docTexto);
  if (!s31) return ['No se encontró §31 (Referencias) en la copia en texto del documento maestro.'];
  const compacto = s31.replace(/\s+/g, '');
  const enlaces31 = (compacto.match(/https?:\/\//g) ?? []).length;
  if (enlaces31 !== catalogo.length) e.push(`§31 tiene ${enlaces31} enlaces y el catálogo ${catalogo.length} referencias: deben coincidir una a una.`);
  const doc = analizarDocumento(docTexto);
  const vistos = new Set();
  for (const r of catalogo) {
    const d = `${CATALOGO} → ${r.id ?? '(sin id)'}`;
    if (!r.id || vistos.has(r.id)) e.push(`${d}: id vacío o repetido`);
    vistos.add(r.id);
    for (const k of ['corta', 'tipo', 'enlace', 'comoConsiderarla']) if (!r[k]) e.push(`${d}: falta «${k}»`);
    if (r.tipo && !TIPOS.includes(r.tipo)) e.push(`${d}: tipo debe ser ${TIPOS.join(', ')}`);
    if (r.enlace && !compacto.includes(r.enlace)) e.push(`${d}: el enlace ${r.enlace} no está en §31 tal cual`);
    if (!r.claves?.length) e.push(`${d}: necesita al menos una clave para reconocer su cita`);
    const ids = [...(r.aplicaA?.ids ?? []), ...(r.citadaEn ?? []).flatMap((c) => c.ids ?? [])];
    const inexistentes = ids.filter((i) => !doc.ids.has(i));
    if (inexistentes.length) e.push(`${d}: cita ${inexistentes.join(', ')}, que no existe(n) en el documento`);
    for (const c of r.citadaEn ?? []) if (!doc.secciones.has(String(c.seccion).replace('§', ''))) e.push(`${d}: la sección ${c.seccion} no existe en el documento`);
    if (modulos.length) for (const m of r.aplicaA?.modulos ?? []) if (!modulos.includes(m)) e.push(`${d}: el módulo ${m} no figura en §19`);
    if (!(r.aplicaA?.ids?.length || r.aplicaA?.modulos?.length)) e.push(`${d}: aplicaA necesita requisitos o módulos`);
  }
  return e;
}

/** Referencias que aplican a unos requisitos, módulos o skills. */
export function referenciasPara({ ids = [], modulos = [], skills = [] }, catalogo) {
  return catalogo.filter((r) => (r.aplicaA?.ids ?? []).some((i) => ids.includes(i))
    || (r.aplicaA?.modulos ?? []).some((m) => modulos.includes(m))
    || (r.aplicaA?.skills ?? []).some((s) => skills.includes(s)));
}

const citada = (r) => (r.citadaEn?.length ? r.citadaEn.map((c) => `${c.seccion}${c.ids?.length ? ` (${c.ids.join(', ')})` : ''}`).join(', ') : 'no la cita el cuerpo del documento (relación propuesta por el equipo)');

/** Lista en markdown de unas referencias, con su enlace, dónde las cita el documento y cómo considerarlas. */
export function listaReferencias(refs) {
  return refs.map((r) => `- **${r.corta}** — <${r.enlace}>\n  Citada en: ${citada(r)}. Aplica a: ${(r.aplicaA?.ids ?? []).join(', ') || '—'}. ${r.comoConsiderarla}`).join('\n');
}

/** Bloque generado para una skill o un SDD (vacío si no hay referencias). */
export function bloqueReferencias(refs, { encabezado = '## Referencias del documento maestro (§31)' } = {}) {
  if (!refs.length) return '';
  return [
    encabezado,
    '',
    MARCA_INICIO,
    '',
    'Enlaces de §31 que aplican aquí. Cítalos (APA 7) donde implementes lo que respaldan y consulta la fuente antes de',
    'usar una afirmación concreta: el contenido de cada enlace no se resume aquí. Detalle: skill `referencias-documento`',
    'y `npm run referencias:revisar`.',
    '',
    listaReferencias(refs),
    '',
    MARCA_FIN,
  ].join('\n');
}

/** Inserta o reemplaza el bloque en un texto. Si no hay marcas, lo agrega al final (o antes de antesDe). */
export function inyectarBloque(texto, bloque, { antesDe = null } = {}) {
  const t = String(texto).replace(/\r\n/g, '\n');
  const i = t.indexOf(MARCA_INICIO);
  const f = t.indexOf(MARCA_FIN);
  if (i >= 0 && f > i) {
    // Reemplaza desde el encabezado del bloque (la línea con «Referencias del documento maestro») hasta la marca de fin.
    const inicioBloque = t.lastIndexOf('\n', t.lastIndexOf('Referencias del documento maestro (§31)', i)) + 1;
    const desde = inicioBloque > 0 && inicioBloque < i ? inicioBloque : i;
    const resto = t.slice(f + MARCA_FIN.length).replace(/^\n+/, '');
    const previo = t.slice(0, desde).replace(/\n+$/, '');
    if (!bloque) return `${previo}\n${resto ? `\n${resto}` : ''}`;
    return `${previo}\n\n${bloque}\n${resto ? `\n${resto}` : ''}`;
  }
  if (!bloque) return t;
  if (antesDe && t.includes(antesDe)) {
    const k = t.indexOf(antesDe);
    return `${t.slice(0, k).replace(/\n+$/, '')}\n\n${bloque}\n\n${t.slice(k)}`;
  }
  return `${t.replace(/\n+$/, '')}\n\n${bloque}\n`;
}

// ------------------------------------------------------------------ Revisión de la implementación

const TEXTO = /\.(m?[jt]sx?|cjs|py|ipynb|md|json|geojson|csv|ya?ml|toml|html|txt)$/i;
const DOI = /\b10\.\d{4,9}\/[^\s"'<>()[\]{},;]+/g;

/** ¿Es un artefacto del producto (código, specs, notebooks, datos publicados), no de las herramientas ni el documento? */
export function esArtefactoDelProducto(ruta) {
  const p = String(ruta).replace(/\\/g, '/');
  if (!TEXTO.test(p) || /(^|\/)(node_modules|dist|build|coverage|\.venv|__pycache__)\//.test(p)) return false;
  if (/^(docs|ai|sdd|\.specify|\.github|\.githooks|\.agents)\//.test(p) || GENERADO.test(p) || esFuenteDeHerramienta(p)) return false;
  return !/^(README\.md|AGENTS\.md|CLAUDE\.md|package(-lock)?\.json|commitlint\.config\.mjs|opencode\.json|\.mcp\.json)$/.test(p);
}

/**
 * Revisa la implementación. archivos: rutas; leer(ruta) → texto.
 * → { referencias: [{ id, corta, estado: 'considerada'|'sin-citar'|'sin-implementar', archivos }], doisFuera: [{ archivo, doi }] }
 */
export function revisarImplementacion({ archivos, leer, catalogo }) {
  const producto = archivos.filter(esArtefactoDelProducto).map((f) => ({ f, t: leer(f) ?? '' }));
  const referencias = catalogo.map((r) => {
    const ids = r.aplicaA?.ids ?? [];
    const implementan = producto.filter(({ t }) => ids.some((i) => new RegExp(`\\b${i}\\b`).test(t)));
    if (!implementan.length) return { id: r.id, corta: r.corta, estado: 'sin-implementar', archivos: [] };
    const citan = implementan.filter(({ t }) => r.claves.some((k) => t.includes(k)));
    return citan.length
      ? { id: r.id, corta: r.corta, estado: 'considerada', archivos: citan.map((x) => x.f) }
      : { id: r.id, corta: r.corta, estado: 'sin-citar', archivos: implementan.map((x) => x.f), enlace: r.enlace, comoConsiderarla: r.comoConsiderarla, ids: ids.filter((i) => implementan.some(({ t }) => new RegExp(`\\b${i}\\b`).test(t))) };
  });
  const conocidos = new Set(catalogo.map((r) => (/doi\.org\/(.+)$/.exec(r.enlace)?.[1] ?? '').toLowerCase()).filter(Boolean));
  const doisFuera = [];
  for (const f of archivos) {
    const p = String(f).replace(/\\/g, '/');
    if (!TEXTO.test(p) || /^docs\//.test(p) || p === CATALOGO || GENERADO.test(p) || /node_modules\//.test(p) || /^ai\/hooks\/test\//.test(p)) continue;
    for (const m of (leer(f) ?? '').matchAll(DOI)) {
      const doi = m[0].replace(/[.,;:]+$/, '');
      if (!conocidos.has(doi.toLowerCase())) doisFuera.push({ archivo: p, doi });
    }
  }
  return { referencias, doisFuera };
}

/** Informe en markdown de la revisión. */
export function textoRevision({ referencias, doisFuera }, errores = []) {
  const n = (e) => referencias.filter((r) => r.estado === e);
  const sinCitar = n('sin-citar');
  const out = [
    `### Referencias de §31 · ${errores.length ? `✘ catálogo con ${errores.length} error(es)` : '✔ catálogo coherente con §31'}${sinCitar.length ? ` · ⚠ ${sinCitar.length} sin citar donde se implementan` : ''}${doisFuera.length ? ` · ⚠ ${doisFuera.length} DOI fuera de §31` : ''}`,
    '',
    `${referencias.length} referencias: ${n('considerada').length} consideradas, ${sinCitar.length} sin citar, ${n('sin-implementar').length} todavía sin implementación que las use.`,
  ];
  for (const e of errores) out.push(`- ✘ ${e}`);
  if (sinCitar.length) {
    out.push('', '**Sin citar donde se implementan** (cítala en el código, la spec o la página que implementa sus requisitos):');
    for (const r of sinCitar) out.push(`- ⚠ ${r.corta} — <${r.enlace}> · ${r.ids.join(', ')} en ${r.archivos.slice(0, 4).join(', ')}${r.archivos.length > 4 ? ', …' : ''}. ${r.comoConsiderarla}`);
  }
  if (doisFuera.length) {
    out.push('', '**DOI que no están en §31** (§28: no inventes referencias; si es real, agrégala al documento maestro):');
    for (const d of doisFuera.slice(0, 15)) out.push(`- ⚠ \`${d.archivo}\`: ${d.doi}`);
  }
  return out.join('\n');
}

// ------------------------------------------------------------------ Aviso para los hooks

const archivoAvisadas = (root) => path.join(root, execFileSync('git', ['rev-parse', '--git-path', 'uraqi-referencias-avisadas.json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());

/** Referencias que aplican a los requisitos de un texto (lo editado), una vez por referencia y sesión. Nunca lanza. */
export function avisoReferencias({ texto, cwd, sesion }) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const ids = [...new Set(String(texto ?? '').match(ID_DOC) ?? [])];
    if (!ids.length) return null;
    let refs = referenciasPara({ ids }, cargarCatalogo(root));
    if (sesion) {
      let previas = {};
      try { previas = JSON.parse(fs.readFileSync(archivoAvisadas(root), 'utf8')); } catch { previas = {}; }
      const vistas = new Set(previas.sesion === sesion ? previas.ids : []);
      refs = refs.filter((r) => !vistas.has(r.id));
      fs.writeFileSync(archivoAvisadas(root), JSON.stringify({ sesion, ids: [...vistas, ...refs.map((r) => r.id)] }));
    }
    if (!refs.length) return null;
    return `Referencias de §31 que aplican a lo que estás implementando (${ids.join(', ')}): tenlas en cuenta y cítalas donde corresponda; consulta la fuente antes de usar una afirmación concreta.\n${listaReferencias(refs)}`;
  } catch {
    return null;
  }
}

/** Texto del documento maestro del repositorio (o ''). */
export function leerDocumento(root) {
  try { return fs.readFileSync(path.join(root, DOCUMENTO), 'utf8'); } catch { return ''; }
}
