#!/usr/bin/env node
// Hook previo a cada herramienta (PreToolUse en Claude y Codex, BeforeTool en Gemini).
// Bloquea secretos, rutas protegidas, comandos destructivos y push o merge directo a main.
// Al crear una PR hacia qa o main (promoción pedida de forma explícita) activa el revisor de código vivo: si hay
// código roto o muerto, o el CI/CD exigible está incompleto, bloquea y muestra el plan de solución.
// Uso: node ai/hooks/pre-tool.mjs --platform=<claude|codex|gemini>
import { evaluateTool } from './lib/guard.mjs';
import { currentBranch } from './lib/git.mjs';
import { readStdinJson, block, failOpen } from './lib/io.mjs';
import { revisarPromocion } from './lib/promocion.mjs';

try {
  const event = await readStdinJson();
  const cwd = event.cwd || process.cwd();
  const result = evaluateTool(event.tool_name, event.tool_input, cwd, { branch: currentBranch(cwd) });
  if (result.decision === 'deny') block(result.reason);
  const motivo = revisarPromocion(event.tool_input?.command, cwd);
  if (motivo) block(motivo);
  process.exit(0);
} catch (err) {
  failOpen('pre-tool', err);
}
