// En Windows, un proceso sin consola (la verificación en segundo plano de la vigilancia) abriría una ventana de
// terminal visible por cada subproceso que lanza (git, node, gh, python, servidores MCP). Importar este módulo
// PRIMERO hace que todos los subprocesos de este proceso se creen ocultos (windowsHide), también los que lanzan las
// librerías que importan child_process por nombre (se actualizan con syncBuiltinESMExports). En otros sistemas no
// cambia nada.
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

export const FUNCIONES = ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync'];

/** Argumentos con windowsHide: true en las opciones (sin pisar un valor explícito). Pura. */
export function conVentanaOculta(args) {
  const a = [...args];
  const i = a.findIndex((x, k) => k > 0 && x && typeof x === 'object' && !Array.isArray(x));
  if (i >= 0) {
    a[i] = { windowsHide: true, ...a[i] };
    return a;
  }
  let pos = a.length;
  if (typeof a[pos - 1] === 'function') pos -= 1;
  a.splice(pos, 0, { windowsHide: true });
  return a;
}

if (process.platform === 'win32' && !cp.__uraqiSinVentanas) {
  for (const nombre of FUNCIONES) {
    const original = cp[nombre];
    cp[nombre] = function sinVentana(...args) {
      return original.apply(this, conVentanaOculta(args));
    };
  }
  cp.__uraqiSinVentanas = true;
  syncBuiltinESMExports();
}
