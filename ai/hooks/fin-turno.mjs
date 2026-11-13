#!/usr/bin/env node
// Hook de fin de turno (Stop en Claude y Codex, AfterAgent en Gemini). Si un prompt del SDD se ejecutó en esta
// sesión y no quedó en el historial, pide al asistente que lo registre y que muestre a la persona el siguiente prompt
// listo para copiar y pegar. No insiste dos veces seguidas ni interrumpe si se espera una respuesta de la persona.
// Uso: node ai/hooks/fin-turno.mjs --platform=<claude|codex|gemini>
import { platform, readStdinJson, failOpen } from './lib/io.mjs';
import { motivoDeFinSdd } from './lib/sdd-hooks.mjs';

try {
  const event = await readStdinJson();
  const motivo = motivoDeFinSdd({ cwd: event.cwd || process.cwd(), sesion: event.session_id, stopHookActive: Boolean(event.stop_hook_active) });
  if (motivo) {
    // Claude y Codex: decision «block» con reason; Gemini (AfterAgent): «deny» con reason, que se envía como nuevo prompt.
    process.stdout.write(`${JSON.stringify({ decision: platform() === 'gemini' ? 'deny' : 'block', reason: motivo })}\n`);
  }
  process.exit(0);
} catch (err) {
  failOpen('fin-turno', err);
}
