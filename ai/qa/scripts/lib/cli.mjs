// Utilidades comunes para los CLIs del ecosistema.
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

export const EXIT = Object.freeze({ OK: 0, CHECK_FAILED: 1, USAGE: 2, INTERNAL: 3 });

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Envuelve parseArgs y muestra ayuda con --help. */
export function cli({ name, usage, options = {}, allowPositionals = true }) {
  const opts = { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, ...options };
  let parsed;
  try {
    parsed = parseArgs({ options: opts, allowPositionals, strict: true });
  } catch (err) {
    process.stderr.write(`${name}: ${err.message}\n\n${usage}\n`);
    process.exit(EXIT.USAGE);
  }
  if (parsed.values.help) {
    process.stdout.write(`${usage}\n`);
    process.exit(EXIT.OK);
  }
  return parsed;
}

/** Ejecuta `main` con manejo de errores y códigos de salida consistentes. */
export async function run(name, main) {
  try {
    const code = await main();
    process.exitCode = typeof code === 'number' ? code : EXIT.OK;
  } catch (err) {
    if (err instanceof UsageError || err?.name === 'PathError') {
      process.stderr.write(`${name}: ${err.message}\n`);
      process.exitCode = EXIT.USAGE;
    } else {
      process.stderr.write(`${name}: error interno: ${err?.message ?? err}\n`);
      process.exitCode = EXIT.INTERNAL;
    }
  }
}

export function readJson(file, maxBytes = 20 * 1024 * 1024) {
  const st = fs.statSync(file);
  if (st.size > maxBytes) throw new UsageError(`Archivo demasiado grande: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new UsageError(`JSON inválido en ${file}: ${err.message}`);
  }
}

export function requireFile(file, label = 'archivo') {
  if (!file) throw new UsageError(`Falta ${label}`);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new UsageError(`No existe ${label}: ${file}`);
  return path.resolve(file);
}

/** Escribe la salida solo si el usuario pidió explícitamente --out; nunca sobrescribe sin --force. */
export function writeOutput(outPath, content, { force = false } = {}) {
  if (!outPath) {
    process.stdout.write(content.endsWith('\n') ? content : `${content}\n`);
    return null;
  }
  const abs = path.resolve(outPath);
  if (fs.existsSync(abs) && !force) throw new UsageError(`El archivo ya existe (usa --force para sobrescribir): ${outPath}`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  process.stderr.write(`Escrito: ${abs}\n`);
  return abs;
}

