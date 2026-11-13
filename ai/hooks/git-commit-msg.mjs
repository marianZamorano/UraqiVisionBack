#!/usr/bin/env node
// Hook de git commit-msg: trazabilidad commit → issue.
// - BLOQUEA si el mensaje no cita su issue (#12, GH-12 o la URL del issue). Exentos: merges, reverts,
//   fixup!/squash!/amend!. En ramas tipo/N-descripcion, prepare-commit-msg ya agregó "Refs #N".
// - AVISA si no cita un identificador del documento maestro (§1, §28) o si trae Co-Authored-By de IA.
// - AVISA si cita requisitos del módulo de otra persona según §19 (apoyo a su rol), con la identidad del clon.
// - Commits grandes (varios temas mezclados): muestra la división propuesta y termina con código 3 para que el
//   wrapper .githooks/commit-msg PREGUNTE en la terminal. Sin terminal (agentes, IDE) bloquea y pide preguntar.
//   Se acepta un solo commit con URAQI_UN_COMMIT=1 o con la línea "Commit-grande: aprobado" en el mensaje.
import fs from 'node:fs';
import { ISSUE_REF, EXEMPT_MESSAGE, git } from './lib/git.mjs';
import { agrupar, esGrande, describirPlan, parseNameStatus } from './lib/commit-groups.mjs';
import { avisoDeApoyo } from './lib/equipo.mjs';

const file = process.argv[2];
const msg = file ? fs.readFileSync(file, 'utf8').replace(/^# .*$|^#$/gm, '').trim() : '';
if (!msg || EXEMPT_MESSAGE.test(msg)) process.exit(0);

const ID = /\b(?:RF|RNF|MC|RN|CQ|VC|PS|CU|HU|OE|DP)-\d{2}\b|\bM-[A-ZÁÉÍÓÚ]{4,}\b/;
const AI_COAUTHOR = /^Co-Authored-By:.*\b(?:Claude|Anthropic|Gemini|Codex|OpenAI|ChatGPT|opencode|Copilot)\b/im;

if (!ISSUE_REF.test(msg)) {
  process.stderr.write([
    '[uraqi-guard:commit-sin-issue] Commit bloqueado: cada commit debe citar su issue para que haya trazabilidad.',
    'Agrega la referencia al mensaje, por ejemplo:',
    '  feat(mapa): deslizador antes/después (RF-06) #12',
    'o trabaja en una rama tipo/N-descripcion (feat/12-deslizador) y se agregará "Refs #12" solo.',
    'Si el trabajo no tiene issue, créalo primero: gh issue create (skill flujo-issues-y-pr).',
    '',
  ].join('\n'));
  process.exit(1);
}
const aprobado = process.env.URAQI_UN_COMMIT === '1' || /^Commit-grande:\s*aprobado\s*$/im.test(msg);
if (!aprobado) {
  let grupos = [];
  try {
    grupos = agrupar(parseNameStatus(git(['diff', '--cached', '--name-status', '-M'])));
  } catch {
    grupos = [];
  }
  if (esGrande(grupos)) {
    const issue = (msg.match(/#(\d+)\b/) ?? [])[1];
    process.stderr.write([
      '[uraqi-guard:commit-grande] Este commit mezcla varios temas.',
      describirPlan(grupos, issue),
      '',
      'Opciones (decide la persona, no el agente):',
      '  - Dividir: cancela este commit y ejecuta `npm run commits:dividir` (muestra la propuesta y pregunta antes de aplicar).',
      '  - Mantener un solo commit: respóndelo aquí si estás en una terminal; si no, repite el commit con',
      '    URAQI_UN_COMMIT=1 o agrega la línea "Commit-grande: aprobado" al mensaje.',
      'Agentes de IA: muestra esta propuesta a la persona y pregúntale; no elijas por tu cuenta.',
      '',
    ].join('\n'));
    process.exit(3);
  }
}
if (!ID.test(msg)) {
  process.stderr.write('[uraqi] Aviso: el mensaje no cita ningún identificador (RF-xx, RNF-xx, MC-xx, RN-xx, CQ-xx, VC-xx, PS-xx, M-MODULO). Si el commit resuelve un requisito, cítalo.\n');
}
if (AI_COAUTHOR.test(msg)) {
  process.stderr.write('[uraqi] Aviso: el mensaje incluye un Co-Authored-By de un asistente de IA; la convención del equipo es no incluirlo.\n');
}
// §19: si el commit cita requisitos del módulo de otra persona, avisa que es apoyo a su rol (no bloquea).
const apoyo = avisoDeApoyo({ texto: msg, cwd: process.cwd() });
if (apoyo) process.stderr.write(`[uraqi] ${apoyo}\n`);
process.exit(0);
