#!/usr/bin/env node
// Hook de git pre-commit (PS-06, RNF-06): impide versionar archivos con secretos o líneas con claves.
// Se activa con: git config core.hooksPath .githooks
// También impide commitear directamente en dev, qa o main: el trabajo va en una rama tipo/N-descripcion y
// llega a esas ramas por PR.
// Variables de entorno: solo se versionan las plantillas permitidas (.env.example y las declaradas), sin valores
// sensibles; no puede haber archivos .env* no permitidos; .env y .env.example deben tener la misma estructura; y si
// el commit cambia la estructura de una plantilla, hay una PAUSA obligatoria para comunicarlo al equipo (el .env se
// copia a Descargas). Tras comunicarlo: URAQI_ENV_COMUNICADO=1 git commit …
// Ayuda al día: si el commit toca una fuente de las herramientas, ai/README.md y la configuración generada deben
// estar regenerados (npm run ai:sync) y agregados al commit.
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { findSecrets, isSecretPath, PROTECTED_BRANCHES } from './lib/guard.mjs';
import { currentBranch, generadosSinCommitear } from './lib/git.mjs';
import { clasificar, compararClaves, sensiblesConValor, mensajePausa, parseClaves } from './lib/entorno.mjs';
import { permitidos, revisar, compartir, clavesEn } from './lib/entorno-git.mjs';

const branch = currentBranch();
if (PROTECTED_BRANCHES.includes(branch)) {
  process.stderr.write(`[uraqi-guard:commit-en-main] No se commitea directamente en ${branch}.\nCrea una rama para el issue desde dev: git switch -c feat/<N>-descripcion (los cambios sin confirmar se mueven con ella).\n`);
  process.exit(1);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const problems = [];
const perm = permitidos();
const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);

for (const file of staged) {
  const tipo = clasificar(path.basename(file), perm);
  if (tipo && !['plantilla', 'plantilla-permitida'].includes(tipo)) {
    problems.push(`${file}: no se versiona. Solo se sube .env.example (y los .env.<x>.example declarados en "uraqi.envPermitidos").`);
  } else if (!tipo && isSecretPath(file)) problems.push(`${file}: archivo con secretos.`);
}

// Entorno: archivos no permitidos y estructura .env ↔ .env.example (sin mostrar valores).
const entorno = revisar();
problems.push(...entorno.errores.map((e) => `Entorno: ${e}`));

// Plantillas en el commit: sin valores sensibles y, si cambia su estructura, pausa para comunicarlo.
const plantillasStaged = staged.filter((f) => ['plantilla', 'plantilla-permitida'].includes(clasificar(path.basename(f), perm)));
const cambiosEstructura = [];
for (const f of plantillasStaged) {
  const nuevo = git('show', `:${f}`);
  const sens = sensiblesConValor(nuevo);
  if (sens.length) problems.push(`${f}: las claves sensibles deben ir vacías (${sens.join(', ')}).`);
  const d = compararClaves(clavesEn('HEAD', f) ?? [], parseClaves(nuevo));
  cambiosEstructura.push(...d.faltanEnLocal, ...d.faltanEnPlantilla);
}
if (!problems.length && cambiosEstructura.length && process.env.URAQI_ENV_COMUNICADO !== '1') {
  let copia = null;
  try {
    copia = compartir();
  } catch {
    copia = null;
  }
  process.stderr.write(`${mensajePausa(cambiosEstructura, copia)}\n`);
  process.exit(1);
}

let currentFile = '';
let lineNo = 0;
for (const line of git('diff', '--cached', '-U0', '--no-color', '--diff-filter=ACMR').split('\n')) {
  if (line.startsWith('+++ b/')) currentFile = line.slice(6);
  else if (line.startsWith('@@')) lineNo = Number(/\+(\d+)/.exec(line)?.[1] ?? 0) - 1;
  else if (line.startsWith('+') && !line.startsWith('+++')) {
    lineNo += 1;
    const found = findSecrets(line.slice(1));
    if (found.length) problems.push(`${currentFile}:${lineNo}: posible secreto (${found.join(', ')}).`);
  }
}

if (problems.length) {
  process.stderr.write(`[uraqi-guard:pre-commit] Commit bloqueado (RNF-06):\n- ${problems.join('\n- ')}\nQuita el secreto, rótalo si llegó a compartirse y vuelve a intentar.\n`);
  process.exit(1);
}

// Ayuda (ai/README.md) y configuración generada al día: si el commit toca una fuente, ai/sync.mjs --check debe pasar
// (BLOQUEA). Si lo regenerado aún no está agregado, solo AVISA: así se pueden dividir los commits por tema; el hook
// pre-push impide subir la rama con generados sin commitear. ai/README.md sale de ai/docs/README.plantilla.md.
const FUENTES = /^(\.agents\/skills\/|ai\/|\.githooks\/|\.github\/workflows\/|\.specify\/|specs\/|package\.json$|\.claude\/|\.gemini\/|\.codex\/|\.opencode\/|\.mcp\.json$|opencode\.json$)/;
if (git('diff', '--cached', '--name-only').split('\n').some((f) => FUENTES.test(f))) {
  const root = git('rev-parse', '--show-toplevel').trim();
  const r = spawnSync(process.execPath, [path.join(root, 'ai', 'sync.mjs'), '--check'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    const detalle = `${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').filter((l) => /desactualizado|sobra|no se puede generar|^- /.test(l)).slice(0, 12);
    process.stderr.write(`[uraqi-guard:ayuda-desactualizada] Commit bloqueado: ai/README.md (la ayuda) o la configuración generada no están al día con las fuentes.\n- ${detalle.join('\n- ')}\nEjecuta \`npm run ai:sync\`, revisa el resultado y agrégalo al commit.\n`);
    process.exit(1);
  }
  const sinAgregar = generadosSinCommitear(root, { soloSinAgregar: true });
  if (sinAgregar.length) process.stderr.write(`[uraqi] Aviso: hay archivos regenerados sin agregar (${sinAgregar.slice(0, 5).join(', ')}${sinAgregar.length > 5 ? ', …' : ''}). Inclúyelos en este commit o en uno siguiente: el push se bloquea mientras falten.\n`);
}
