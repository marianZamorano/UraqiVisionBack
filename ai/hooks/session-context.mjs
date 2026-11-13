#!/usr/bin/env node
// Hook de inicio de sesión: recuerda al agente la fuente de verdad y las reglas clave, y avisa de las PR que
// esperan la aprobación de la persona (consulta GitHub con gh; si no hay red o sesión, lo omite). También avisa de
// las herramientas de IA que cambiaron desde la última sesión (con la ayuda regenerada si hacía falta y la
// coherencia con el documento maestro) y de cualquier herramienta que haya dejado de funcionar o de estar activa.
// Nunca bloquea.
// Uso: node ai/hooks/session-context.mjs --platform=<claude|codex|gemini>
import { execFileSync } from 'node:child_process';
import { platform } from './lib/io.mjs';
import { avisoPRs } from './lib/prs-resumen.mjs';
import { revisar } from './lib/entorno-git.mjs';
import { avisoDeSesion } from './lib/herramientas-git.mjs';

/** Avisos locales (sin red): ramas sin subir y problemas de entorno (solo nombres, nunca valores). */
function avisosLocales() {
  const lineas = [];
  try {
    const sinPush = execFileSync('git', ['for-each-ref', '--format=%(refname:short) %(upstream:short)', 'refs/heads'], { encoding: 'utf8' })
      .split('\n').map((l) => l.trim().split(' ')).filter(([rama, up]) => rama && !up).map(([rama]) => rama);
    if (sinPush.length) lineas.push(`Ramas locales sin subir (toda rama se sube): ${sinPush.join(', ')} → git push -u origin <rama>`);
  } catch {
    // sin git
  }
  try {
    const { errores } = revisar();
    if (errores.length) lineas.push(`Entorno: ${errores.join(' | ')} → npm run env:check / npm run env:sync`);
  } catch {
    // sin repositorio
  }
  return lineas.length ? `[UraqiVision] Pendientes locales\n- ${lineas.join('\n- ')}` : '';
}

export const CONTEXT = `[UraqiVision] Contexto del proyecto
- Fuente de verdad: docs/UraqiVisionDocumentoMaestrov1.0.pdf (busca en la copia .txt por identificador: RF-xx, RNF-xx, MC-xx, RN-xx, CQ-xx, VC-xx, PS-xx, DP-xx). Lo que no está en el documento no está decidido.
- Respeta el alcance MVP (§8); las decisiones pendientes DP-01 a DP-08 (§29) no se implementan hasta resolverse.
- No inventes datos, cifras, fuentes, DOI ni endpoints. Separa hechos, propuestas, hipótesis y pendientes.
- Ciencia: promedios en lineal y dB después; misma órbita y grilla (RN-01); sin dato nunca es cero (RN-13); causas como hipótesis (RN-05); hectáreas con rango (RN-06).
- Textos de interfaz en español e inglés (RNF-03). Ninguna clave en el código ni en el repo (RNF-06).
- Git (skill flujo-issues-y-pr): nunca commit, push ni merge directo en main, qa ni dev. Trabaja en una rama tipo/N-descripcion desde dev y abre una PR a dev con "Closes #N"; luego se promueve dev → qa (preproducción) → main (producción) por PR. Toda PR, en las tres ramas, lista todos los issues de sus commits.
- Aprobación de PR: hacia dev el autor puede fusionar su propia PR tras confirmar; hacia qa y main deben aprobar TODOS los colaboradores excepto el autor, sobre el último commit. Aprobar y fusionar solo con npm run pr:aprobar / pr:fusionar y con la confirmación de la persona.
- Commits en Conventional Commits con su issue: tipo(alcance): descripción en minúscula (RF-xx) #N. Sin Co-Authored-By de IA. commitlint y los hooks rechazan lo que no cumpla. Con muchos cambios, propone dividirlos por tema (node ai/scripts/dividir-commits.mjs) y PREGUNTA a la persona antes de dividir o de hacer un solo commit grande.
- Ramas: nunca se borran (son trazabilidad) y toda rama nueva se sube a origin.
- Entorno: solo .env (local) y .env.example (sin credenciales, misma estructura). Genera o actualiza el .env SOLO con npm run env:sync; nunca lo leas. Si cambias la estructura, PAUSA: la persona debe comunicarlo al equipo antes de continuar.
- Skills: documento-maestro, sdd-uraqivision y las de cada módulo. Subagentes revisores de solo lectura.
- Las guardas [uraqi-guard:<regla>] bloquean secretos, .env/.netrc y comandos destructivos.`;

try {
  const aviso = await avisoPRs({ modo: 'inicio' });
  let herramientas = '';
  try {
    herramientas = await avisoDeSesion();
  } catch {
    herramientas = '';
  }
  const texto = [CONTEXT, avisosLocales(), herramientas, aviso].filter(Boolean).join('\n\n');
  if (platform() === 'claude') {
    process.stdout.write(`${texto}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto } })}\n`);
  }
} catch {
  // SessionStart nunca bloquea.
}
process.exit(0);
