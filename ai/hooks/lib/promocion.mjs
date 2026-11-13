// Revisor de código vivo al pedir una promoción: cuando un asistente va a crear una PR hacia qa o main, analiza el
// repositorio y devuelve el motivo de bloqueo (con el plan de solución) si hay errores; si no, null.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { analizar, informe } from './codigo-vivo.mjs';
import { revisarCicd, textoCicd } from './cicd.mjs';

/** ¿El comando crea una PR hacia qa o main? Devuelve la rama destino o null. */
export function destinoDePromocion(command) {
  const c = String(command ?? '');
  if (!/\bgh\s+pr\s+create\b/.test(c)) return null;
  return /(?:--base|-B)[=\s]+["']?(qa|main)["']?(?=\s|$)/.exec(c)?.[1] ?? null;
}

export function revisarPromocion(command, cwd = process.cwd()) {
  const destino = destinoDePromocion(command);
  if (!destino) return null;
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  const ls = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  const archivos = [...new Set([...ls(['ls-files']), ...ls(['ls-files', '--others', '--exclude-standard'])])].filter((f) => fs.existsSync(path.join(root, f)));
  const leer = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; } };
  const r = analizar({ archivos, leer });
  const cicd = revisarCicd({ archivos, leer });
  const errores = r.hallazgos.filter((h) => h.nivel === 'error').length + cicd.hallazgos.filter((h) => h.nivel === 'error').length;
  if (!errores) return null;
  return `[uraqi-guard:codigo-no-vivo] PR hacia ${destino} detenida: el revisor de código vivo encontró código que no funciona o que no está conectado.\n\n${informe(r, { titulo: 'Revisor de código vivo' })}\n\n${textoCicd(cicd)}\n\nMuéstrale a la persona estos hallazgos y el plan, corrígelos en una rama desde dev (con su issue) y vuelve a pedir la promoción. Detalle: npm run codigo:revisar.`;
}
