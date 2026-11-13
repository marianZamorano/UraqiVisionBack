#!/usr/bin/env node
// Hook del mensaje del usuario (UserPromptSubmit en Claude y Codex, BeforeAgent en Gemini).
// 1) Si el mensaje contiene un secreto, no se envía al modelo.
// 2) Cada 10 minutos como máximo, revisa en GitHub si hay PR nuevas que esperan la aprobación de la persona
//    y, si hay novedades, se las indica al asistente para que avise (sin red o sin gh, no hace nada).
// 3) Si el mensaje pide vibecodear y nadie se identificó en esta sesión, recuerda preguntar con opción múltiple
//    qué colaborador es (§19) antes de empezar.
// 4) Si el mensaje trae un prompt del SDD («[SDD P-…]»), pide confirmarlo con la persona (opción múltiple), avisa de
//    dependencias, cambios, re-ejecuciones y de quién lo ejecuta, y recuerda registrar el resultado al terminar.
import { evaluatePrompt } from './lib/guard.mjs';
import { readStdinJson, block, failOpen, platform } from './lib/io.mjs';
import { avisoPRs } from './lib/prs-resumen.mjs';
import { recordatorioVibecodear } from './lib/equipo.mjs';
import { contextoDePromptSdd } from './lib/sdd-hooks.mjs';

try {
  const event = await readStdinJson();
  const prompt = event.prompt ?? event.user_prompt ?? '';
  const result = evaluatePrompt(prompt);
  if (result.decision === 'deny') block(result.reason);
  const aviso = [
    contextoDePromptSdd({ prompt, cwd: event.cwd || process.cwd(), sesion: event.session_id }),
    recordatorioVibecodear({ prompt, cwd: event.cwd || process.cwd(), sesion: event.session_id }),
    await avisoPRs({ modo: 'periodico', intervaloMin: 10 }),
  ].filter(Boolean).join('\n\n');
  if (aviso) {
    if (platform() === 'gemini') {
      process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'BeforeAgent', additionalContext: aviso } })}\n`);
    } else {
      process.stdout.write(`${aviso}\n`);
    }
  }
  process.exit(0);
} catch (err) {
  failOpen('prompt-guard', err);
}
