// Generado por ai/sync.mjs — no editar a mano; edita la fuente (ai/ o .agents/skills/) y ejecuta `node ai/sync.mjs`.
// Plugin de opencode: aplica las guardas compartidas de ai/hooks/lib/guard.mjs antes de cada herramienta.
// Lanzar un error bloquea la herramienta. Las aprobaciones ("ask") las resuelve "permission" de opencode.json.
import { evaluateTool, evaluatePrompt } from '../../ai/hooks/lib/guard.mjs';
import { currentBranch } from '../../ai/hooks/lib/git.mjs';
import { revisarPromocion } from '../../ai/hooks/lib/promocion.mjs';

export const UraqiGuardas = async ({ directory }) => ({
  'tool.execute.before': async (input, output) => {
    const result = evaluateTool(input.tool, output.args ?? {}, directory, { branch: currentBranch(directory) });
    if (result.decision === 'deny') throw new Error(result.reason);
    // PR hacia qa o main: revisor de código vivo (bloquea si hay código roto o muerto).
    const motivo = revisarPromocion(output.args?.command, directory);
    if (motivo) throw new Error(motivo);
  },
  'chat.message': async (_input, output) => {
    const text = (output?.parts ?? []).filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n');
    const result = text ? evaluatePrompt(text) : { decision: null };
    if (result.decision === 'deny') throw new Error(result.reason);
  },
});
