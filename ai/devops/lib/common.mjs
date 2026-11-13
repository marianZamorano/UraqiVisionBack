// Utilidades compartidas por scripts, hooks y el MCP server del ecosistema DevOps.
// Sin dependencias externas: solo módulos nativos de Node.js (>= 20).
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const EXIT = { OK: 0, FINDINGS: 1, USAGE: 2 };

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', '.svelte-kit',
  '.vercel', '.turbo', '.cache', 'out', '.terraform', 'vendor', '__pycache__', '.venv', 'venv',
]);

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tgz|7z|rar|jar|woff2?|ttf|eot|otf|mp[34]|mov|avi|wasm|exe|dll|so|dylib|bin|lock)$/i;

/** Normaliza rutas a separador "/" (los hooks reciben rutas con "\" en Windows). */
export function toPosix(p) {
  return String(p ?? '').split(sep).join('/').replace(/\\/g, '/');
}

/** Recorre archivos de texto bajo `root`, omitiendo dependencias, builds y binarios. */
export function walkFiles(root, { maxBytes = 1_000_000, ignoredDirs = DEFAULT_IGNORED_DIRS } = {}) {
  const out = [];
  const stack = [resolve(root)];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (!ignoredDirs.has(e.name)) stack.push(full);
      } else if (e.isFile() && !BINARY_EXT.test(e.name)) {
        try {
          if (statSync(full).size <= maxBytes) out.push(full);
        } catch {
          /* archivo inaccesible: se omite */
        }
      }
    }
  }
  return out.sort();
}

export function rel(root, file) {
  return toPosix(relative(root, file)) || '.';
}

export function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function readJson(file) {
  const t = readText(file);
  if (t === null) return { ok: false, error: 'not-found' };
  try {
    return { ok: true, value: JSON.parse(t.replace(/^﻿/, '')) };
  } catch (err) {
    return { ok: false, error: `invalid-json: ${err.message}` };
  }
}

/** Comprueba si un ejecutable existe en PATH sin ejecutarlo de forma peligrosa. */
export function hasCommand(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, [cmd], { encoding: 'utf8', shell: false });
  return r.status === 0;
}

export function finding(severity, id, message, extra = {}) {
  return { severity, id, message, ...extra };
}

export function summarize(findings) {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

export function sortFindings(findings) {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

/** Un informe falla si contiene hallazgos con severidad >= `failOn`. */
export function failsAt(findings, failOn = 'high') {
  const limit = SEVERITY_ORDER.indexOf(failOn);
  return findings.some((f) => SEVERITY_ORDER.indexOf(f.severity) <= limit);
}

export function renderMarkdown(title, report) {
  const lines = [`# ${title}`, '', `Generado: ${new Date().toISOString()}`, ''];
  if (report.summary) {
    lines.push('| Severidad | Total |', '|---|---|');
    for (const [k, v] of Object.entries(report.summary)) lines.push(`| ${k} | ${v} |`);
    lines.push('');
  }
  const fs = report.findings ?? [];
  if (fs.length === 0) lines.push('Sin hallazgos.');
  else {
    lines.push('| Sev | Regla | Ubicación | Detalle |', '|---|---|---|---|');
    for (const f of sortFindings(fs)) {
      const loc = f.file ? `${f.file}${f.line ? `:${f.line}` : ''}` : '-';
      lines.push(`| ${f.severity} | ${f.id} | ${loc} | ${String(f.message).replace(/\|/g, '\\|')} |`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Emite el informe: JSON (--json), Markdown a archivo (--out) o texto legible.
 * Devuelve el código de salida según `failOn`.
 */
export function emit(title, report, { json = false, out = null, failOn = 'high' } = {}) {
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, out.endsWith('.json') ? JSON.stringify(report, null, 2) : renderMarkdown(title, report));
  }
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    process.stdout.write(`== ${title}\n`);
    for (const f of sortFindings(report.findings ?? [])) {
      const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : '';
      process.stdout.write(`  [${f.severity.toUpperCase()}] ${f.id}: ${f.message}${loc}\n`);
    }
    if (!(report.findings ?? []).length) process.stdout.write('  Sin hallazgos.\n');
    if (report.summary) process.stdout.write(`  Resumen: ${JSON.stringify(report.summary)}\n`);
    for (const n of report.notes ?? []) process.stdout.write(`  nota: ${n}\n`);
  }
  return failsAt(report.findings ?? [], failOn) ? EXIT.FINDINGS : EXIT.OK;
}

export function ensureDir(root) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    process.stderr.write(`Error: el directorio no existe: ${root}\n`);
    process.exit(EXIT.USAGE);
  }
  return resolve(root);
}

/** Opciones comunes de CLI: --root, --json, --out, --fail-on. */
export const COMMON_OPTIONS = {
  root: { type: 'string', default: '.' },
  json: { type: 'boolean', default: false },
  out: { type: 'string' },
  'fail-on': { type: 'string', default: 'high' },
  help: { type: 'boolean', short: 'h', default: false },
};
