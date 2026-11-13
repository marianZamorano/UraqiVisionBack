#!/usr/bin/env node
// Hook de git post-checkout. Argumentos de git: <HEAD anterior> <HEAD nuevo> <1 si cambió de rama>.
// 1) Toda rama nueva se sube: si la rama actual no tiene upstream, hace `git push -u origin <rama>`
//    (o solo enlaza el upstream si la rama ya existe en origin). No actúa en dev, qa, main ni con HEAD desacoplado.
// 2) Variables de entorno: si .env.example cambió entre los dos commits, agrega al .env local las claves nuevas
//    vacías y avisa qué valores pedir al equipo (ver ai/scripts/entorno.mjs).
// 3) Herramientas de IA: si al cambiar de rama cambian skills, subagentes, MCP, hooks, workflows, scripts o la
//    ayuda, avisa qué cambió, regenera la ayuda si hace falta y verifica que todo siga funcionando y activo.
// Nunca bloquea: si no hay red, avisa para subir la rama después. URAQI_SIN_PUSH=1 desactiva el push.
import { execFileSync } from 'node:child_process';
import { currentBranch } from './lib/git.mjs';
import { PROTECTED_BRANCHES } from './lib/guard.mjs';
import { avisarCambiosDeEntorno } from './lib/entorno-git.mjs';
import { avisarCambiosDeHerramientas } from './lib/herramientas-git.mjs';

const [anterior, nuevo, esCambioDeRama] = process.argv.slice(2);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  avisarCambiosDeEntorno(anterior, nuevo);
} catch {
  // el aviso de entorno nunca impide cambiar de rama
}
if (esCambioDeRama === '1') {
  try {
    const aviso = await avisarCambiosDeHerramientas(anterior, nuevo);
    if (aviso) process.stderr.write(`${aviso}\n`);
  } catch {
    // el aviso de herramientas nunca impide cambiar de rama
  }
}

if (esCambioDeRama === '1' && process.env.URAQI_SIN_PUSH !== '1') {
  const rama = currentBranch();
  let tieneUpstream = true;
  try {
    git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  } catch {
    tieneUpstream = false;
  }
  if (rama && !PROTECTED_BRANCHES.includes(rama) && !tieneUpstream) {
    try {
      const remota = git('ls-remote', '--heads', 'origin', rama);
      if (remota) {
        git('fetch', '-q', 'origin', rama);
        git('branch', `--set-upstream-to=origin/${rama}`);
        process.stderr.write(`[uraqi] La rama ${rama} ya existía en origin: quedó enlazada.\n`);
      } else {
        execFileSync('git', ['push', '-u', 'origin', rama], { stdio: ['ignore', 'ignore', 'inherit'] });
        process.stderr.write(`[uraqi] Rama nueva ${rama} subida a origin (toda rama nueva se sube).\n`);
      }
    } catch {
      process.stderr.write(`[uraqi] Aviso: no se pudo subir la rama ${rama}. Súbela en cuanto puedas: git push -u origin ${rama}\n`);
    }
  }
}
process.exit(0);
