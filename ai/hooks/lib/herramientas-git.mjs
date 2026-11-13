// Cambios de herramientas de IA según git, regeneración automática de la ayuda y aviso local a cada colaborador.
// Lo usan los hooks de git (pre-commit, post-merge, post-checkout), el inicio de sesión de los asistentes y
// ai/scripts/herramientas.mjs. Nunca muestra valores de entorno.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { resumirCambios, textoResumen, coherencia, cargarDocumento, lineasAgregadas, esFuenteDeHerramienta } from './herramientas.mjs';
import { verificar, fallidas } from './verificacion.mjs';
import { textoGuia } from './guia-activacion.mjs';

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });

export const raiz = (cwd = process.cwd()) => git(['rev-parse', '--show-toplevel'], cwd).trim();

/** `git diff --name-status` → [{ status, path }] (en renombres, la ruta nueva). */
export function parseNameStatus(texto) {
  return String(texto).split('\n').filter(Boolean).map((l) => {
    const partes = l.split('\t');
    return { status: partes[0], path: partes[partes.length - 1] };
  });
}

/** Cambios entre dos commits. */
export function cambiosEntre(desde, hasta, cwd) {
  return parseNameStatus(git(['diff', '--name-status', '-M', desde, hasta], cwd));
}

/** Cambios del árbol de trabajo frente a una referencia (incluye archivos nuevos sin seguimiento). */
export function cambiosDeTrabajo(base, cwd) {
  const seguidos = parseNameStatus(git(['diff', '--name-status', '-M', base], cwd));
  const nuevos = git(['ls-files', '--others', '--exclude-standard'], cwd).split('\n').filter(Boolean).map((p) => ({ status: '??', path: p }));
  return [...seguidos, ...nuevos];
}

/** Texto de un archivo en una referencia (o en el índice con ref ':'), o null. */
export function textoEn(ref, ruta, cwd) {
  try {
    return git(['show', `${ref === ':' ? '' : ref}:${ruta}`], cwd);
  } catch {
    return null;
  }
}

/**
 * Coherencia de los archivos cambiados. fuente: 'trabajo' (árbol de trabajo), 'indice' (lo que se va a commitear)
 * o una referencia de git. diff: texto del diff unificado para detectar las líneas nuevas.
 */
export function coherenciaDeCambios(entries, { root, fuente = 'trabajo', diff = '' }) {
  const agregadas = lineasAgregadas(diff);
  const archivos = entries.filter((e) => !String(e.status).startsWith('D') && esFuenteDeHerramienta(e.path)).map((e) => {
    let texto = null;
    if (fuente === 'trabajo') texto = fs.existsSync(path.join(root, e.path)) ? fs.readFileSync(path.join(root, e.path), 'utf8') : null;
    else texto = textoEn(fuente === 'indice' ? ':' : fuente, e.path, root);
    return { path: e.path, texto, agregadas: agregadas.get(e.path) ?? (String(e.status).startsWith('A') || e.status === '??' ? texto : '') };
  });
  return coherencia(archivos, cargarDocumento(root));
}

/** Regenera la configuración y la ayuda si están desactualizadas. → { regenerado, error, archivos } */
export function regenerarAyuda(root) {
  const check = spawnSync(process.execPath, ['ai/sync.mjs', '--check'], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (check.status === 0) return { regenerado: false, error: null, archivos: [] };
  const r = spawnSync(process.execPath, ['ai/sync.mjs'], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) return { regenerado: false, error: `${r.stderr || r.stdout}`.trim().split('\n').slice(0, 6).join(' | '), archivos: [] };
  const archivos = r.stdout.split('\n').filter((l) => /^(escrito|borrado): /.test(l)).map((l) => l.replace(/^\w+: /, '').replace(/\\/g, '/'));
  return { regenerado: archivos.length > 0, error: null, archivos };
}

// ------------------------------------------------------------------ Registro de lo ya visto (por clon)

const registro = (root) => path.join(root, git(['rev-parse', '--git-path', 'uraqi-herramientas.json'], root).trim());

export function leerVisto(root) {
  try {
    return JSON.parse(fs.readFileSync(registro(root), 'utf8')).head ?? null;
  } catch {
    return null;
  }
}

export function guardarVisto(root, head) {
  try {
    fs.writeFileSync(registro(root), JSON.stringify({ head, fecha: new Date().toISOString() }));
  } catch {
    // sin permisos: no es crítico
  }
}

// ------------------------------------------------------------------ Avisos locales

/** Aviso para la persona: qué herramientas cambiaron, si la ayuda se regeneró y si todo sigue activo. */
export async function avisoDeCambios(entries, root, { titulo, rapido = true } = {}) {
  const resumen = resumirCambios(entries);
  if (!resumen.piezas.length) return '';
  const lineas = [`${titulo} (${resumen.piezas.length} pieza(s)):`, ...textoResumen(resumen)];
  const ayuda = regenerarAyuda(root);
  if (ayuda.error) lineas.push(`✘ No se pudo regenerar la ayuda: ${ayuda.error}`);
  else if (ayuda.regenerado) lineas.push(`↻ Ayuda y configuración regeneradas automáticamente (${ayuda.archivos.length} archivo(s)). Si son cambios tuyos, inclúyelos en un commit de tu rama.`);
  const { errores, avisos } = coherenciaDeCambios(entries, { root });
  for (const e of errores) lineas.push(`✘ Coherencia con el documento maestro: ${e}`);
  for (const a of avisos) lineas.push(`⚠ ${a}`);
  const r = await verificar(root, { rapido });
  const malas = r.filter((x) => !x.ok);
  lineas.push(malas.length ? textoGuia(malas, { titulo: 'Herramientas de IA que no están activas' }) : `✔ Verificación: las herramientas funcionan y están activas (${r.length} comprobaciones). Detalle: npm run ai:verificar`);
  lineas.push('Consulta qué hace cada pieza con la skill ayuda o npm run ayuda -- <tema>.');
  return lineas.join('\n');
}

/** Para los hooks post-merge y post-checkout: avisa de las herramientas que cambiaron entre dos commits. */
export async function avisarCambiosDeHerramientas(anterior, nuevo, cwd = process.cwd()) {
  const root = raiz(cwd);
  if (!anterior || !nuevo || anterior === nuevo || /^0+$/.test(anterior)) return '';
  const texto = await avisoDeCambios(cambiosEntre(anterior, nuevo, root), root, { titulo: '[uraqi] Cambiaron herramientas de IA' });
  guardarVisto(root, git(['rev-parse', 'HEAD'], root).trim());
  return texto;
}

/** Para el inicio de sesión de los asistentes: lo que cambió desde la última sesión y si todo sigue activo. */
export async function avisoDeSesion(cwd = process.cwd()) {
  const root = raiz(cwd);
  const head = git(['rev-parse', 'HEAD'], root).trim();
  const visto = leerVisto(root);
  let texto = '';
  if (visto && visto !== head) {
    try {
      texto = await avisoDeCambios(cambiosEntre(visto, head, root), root, { titulo: '[UraqiVision] Desde tu última sesión cambiaron herramientas de IA' });
    } catch {
      texto = ''; // el commit visto ya no existe (rebase o clon nuevo)
    }
  }
  if (!texto) {
    const malas = (await verificar(root, { rapido: true })).filter((x) => !x.ok);
    if (malas.length) texto = textoGuia(malas);
  }
  guardarVisto(root, head);
  return texto;
}

export { fallidas };
