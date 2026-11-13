// Utilidades de git para los hooks (con efectos de lectura: ejecutan git). Las reglas puras están en guard.mjs.
import { execFileSync } from 'node:child_process';

const run = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Rama actual, o null si HEAD está desacoplado o no es un repositorio. */
export function currentBranch(cwd = process.cwd()) {
  try {
    return run(['symbolic-ref', '--short', '-q', 'HEAD'], cwd) || null;
  } catch {
    return null;
  }
}

/** Referencia a un issue en un mensaje de commit o de PR: #12, GH-12 o la URL del issue. */
export const ISSUE_REF = /(?:^|[\s(,:])#\d+\b|\bGH-\d+\b|\/issues\/\d+\b/i;

/** Número de issue en el nombre de la rama, con la convención tipo/N-descripcion (feat/12-deslizador). */
export function issueFromBranch(branch) {
  const m = /^[a-z]+\/(\d+)-/i.exec(branch ?? '');
  return m ? m[1] : null;
}

/** Mensajes que no necesitan issue: merges, reverts y commits de autosquash. */
export const EXEMPT_MESSAGE = /^(Merge |Revert "|fixup! |squash! |amend! )/;

/** Salida de git sin recortar: necesaria para formatos donde el espacio inicial importa (status --porcelain). */
export const gitRaw = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** Lo que genera ai/sync.mjs, incluida la ayuda ai/README.md. */
export const GENERADOS = ['ai/README.md', '.claude', '.gemini', '.codex', '.opencode', '.mcp.json', 'opencode.json'];

/**
 * Archivos generados con cambios sin commitear (modificados, nuevos o borrados). Con soloSinAgregar, solo los que
 * aún no están en el índice (lo que quedaría fuera del commit).
 */
export function generadosSinCommitear(cwd = process.cwd(), { soloSinAgregar = false } = {}) {
  try {
    return gitRaw(['status', '--porcelain', '--untracked-files=all', '--', ...GENERADOS], cwd)
      .split('\n').filter(Boolean)
      .filter((l) => !soloSinAgregar || l.startsWith('??') || l[1] !== ' ')
      .map((l) => l.slice(3));
  } catch {
    return [];
  }
}

export { run as git };
