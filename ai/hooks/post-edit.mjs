#!/usr/bin/env node
// Hook posterior a cada edición (PostToolUse en Claude y Codex, AfterTool en Gemini). No bloquea: avisa al
// agente si un JSON/GeoJSON quedó inválido, si es.json y en.json tienen claves distintas (RNF-03) o si editó a
// mano ai/README.md, que es generado. Si editó una herramienta de IA (skill, subagente, MCP, hook, workflow,
// script o la plantilla de la ayuda), regenera sola la ayuda y la configuración (ai/sync.mjs) y revisa que el
// cambio sea coherente con el documento maestro (identificadores y secciones que existen, decisiones pendientes).
// Uso: node ai/hooks/post-edit.mjs --platform=<claude|codex|gemini>
import fs from 'node:fs';
import path from 'node:path';
import { normalize } from './lib/guard.mjs';
import { clasificar } from './lib/entorno.mjs';
import { esFuenteDeHerramienta } from './lib/herramientas.mjs';
import { raiz, regenerarAyuda, coherenciaDeCambios } from './lib/herramientas-git.mjs';
import { platform, readStdinJson, failOpen } from './lib/io.mjs';

function flatKeys(obj, prefix = '', out = new Set()) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) flatKeys(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out.add(prefix);
  }
  return out;
}

/** Devuelve la ruta del archivo de traducción del otro idioma, o null si no parece un archivo de idioma. */
export function counterpart(file) {
  const p = file.replace(/\\/g, '/');
  const swap = { es: 'en', en: 'es' };
  let m = /^(.*\/)(es|en)(\.json)$/i.exec(p) || /^()(es|en)(\.json)$/i.exec(p);
  if (m) return { other: `${m[1]}${swap[m[2].toLowerCase()]}${m[3]}`, lang: m[2].toLowerCase() };
  m = /^(.*\/)(es|en)(\/[^/]+\.json)$/i.exec(p);
  if (m) return { other: `${m[1]}${swap[m[2].toLowerCase()]}${m[3]}`, lang: m[2].toLowerCase() };
  return null;
}

function checkFile(file, cwd) {
  const abs = path.resolve(cwd, file);
  if (!/\.(json|geojson)$/i.test(abs) || !fs.existsSync(abs)) return [];
  const msgs = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    return [`${file}: JSON inválido (${err.message}).`];
  }
  const pair = counterpart(file);
  if (pair) {
    const otherAbs = path.resolve(cwd, pair.other);
    if (!fs.existsSync(otherAbs)) {
      msgs.push(`${file}: no existe todavía su par ${pair.other}. Todo texto debe estar en español e inglés (RNF-03).`);
    } else {
      try {
        const mine = flatKeys(data);
        const theirs = flatKeys(JSON.parse(fs.readFileSync(otherAbs, 'utf8')));
        const missingThere = [...mine].filter((k) => !theirs.has(k));
        const missingHere = [...theirs].filter((k) => !mine.has(k));
        const show = (list) => list.slice(0, 15).join(', ') + (list.length > 15 ? ` (+${list.length - 15})` : '');
        if (missingThere.length) msgs.push(`Faltan en ${pair.other}: ${show(missingThere)}.`);
        if (missingHere.length) msgs.push(`Faltan en ${file}: ${show(missingHere)}.`);
      } catch {
        // El par está mal formado: lo avisará el hook cuando se edite ese archivo.
      }
    }
  }
  return msgs;
}

try {
  const event = await readStdinJson();
  const cwd = event.cwd || process.cwd();
  const files = normalize(event.tool_name, event.tool_input).filter((e) => e.kind === 'write' && e.path).map((e) => e.path);
  const msgs = files.flatMap((f) => checkFile(f, cwd));
  // Plantilla de entorno editada: pausa para que la persona comunique el cambio de estructura al equipo.
  for (const f of files) {
    if (String(clasificar(path.basename(f), ['*'])).startsWith('plantilla') || /^\.env(\.[\w-]+)?\.example$/.test(path.basename(f))) {
      msgs.push(`⏸ PAUSA: editaste ${path.basename(f)} (estructura del .env). Detente y dile a la persona que debe comunicar este cambio a su equipo antes de continuar. Luego ejecuta \`npm run env:sync\` para alinear su .env (no leas el .env) y \`npm run env:compartir\` si debe compartir valores nuevos.`);
    }
  }
  // ai/README.md es generado: una edición a mano se pierde en el siguiente sync.
  for (const f of files) {
    if (path.relative(cwd, path.resolve(cwd, f)).replace(/\\/g, '/') === 'ai/README.md') {
      msgs.push('ai/README.md lo genera ai/sync.mjs: esta edición se perderá. Edita ai/docs/README.plantilla.md (texto) o la fuente de la pieza (skill, subagente, MCP, hook, workflow o package.json → uraqi.scripts) y ejecuta `npm run ai:sync`.');
    }
  }
  // Herramienta de IA editada: ayuda y configuración regeneradas solas, y coherencia con el documento maestro.
  const root = (() => { try { return raiz(cwd); } catch { return null; } })();
  const herramientas = root ? files.map((f) => path.relative(root, path.resolve(cwd, f)).replace(/\\/g, '/')).filter(esFuenteDeHerramienta) : [];
  if (herramientas.length) {
    const ayuda = regenerarAyuda(root);
    if (ayuda.error) msgs.push(`No se pudo regenerar la ayuda (ai/sync.mjs): ${ayuda.error}. Corrige la fuente; se reintenta en la siguiente edición.`);
    else if (ayuda.regenerado) msgs.push(`Ayuda y configuración regeneradas automáticamente (${ayuda.archivos.slice(0, 4).join(', ')}${ayuda.archivos.length > 4 ? ', …' : ''}): inclúyelas en el commit.`);
    const { errores, avisos } = coherenciaDeCambios(herramientas.map((p) => ({ status: 'M', path: p })), { root });
    for (const e of errores) msgs.push(`Incoherente con el documento maestro: ${e}`);
    for (const a of avisos) msgs.push(a);
  }
  if (msgs.length) {
    const reason = `[uraqi-guard:post-edit] Revisa antes de seguir:\n- ${msgs.join('\n- ')}`;
    const out = platform() === 'gemini'
      ? { hookSpecificOutput: { hookEventName: 'AfterTool', additionalContext: reason } }
      : { decision: 'block', reason };
    process.stdout.write(`${JSON.stringify(out)}\n`);
  }
  process.exit(0);
} catch (err) {
  failOpen('post-edit', err);
}
