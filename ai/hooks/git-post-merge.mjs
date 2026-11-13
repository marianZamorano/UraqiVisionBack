#!/usr/bin/env node
// Hook de git post-merge (pull o merge). Nunca bloquea ni muestra valores.
// 1) Si cambió .env.example, agrega al .env local las claves nuevas vacías y avisa qué valores pedir al equipo.
// 2) Si cambiaron herramientas de IA (skills, subagentes, MCP, hooks, workflows, scripts o la ayuda), avisa qué
//    cambió, regenera la ayuda y la configuración si hace falta, revisa la coherencia con el documento maestro y
//    verifica que todo siga funcionando y activo.
import { avisarCambiosDeEntorno } from './lib/entorno-git.mjs';
import { avisarCambiosDeHerramientas } from './lib/herramientas-git.mjs';

try {
  avisarCambiosDeEntorno('ORIG_HEAD', 'HEAD');
} catch {
  // el aviso nunca impide el merge
}
try {
  const { execFileSync } = await import('node:child_process');
  const sha = (ref) => execFileSync('git', ['rev-parse', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const aviso = await avisarCambiosDeHerramientas(sha('ORIG_HEAD'), sha('HEAD'));
  if (aviso) process.stderr.write(`${aviso}\n`);
} catch {
  // el aviso nunca impide el merge
}
process.exit(0);
