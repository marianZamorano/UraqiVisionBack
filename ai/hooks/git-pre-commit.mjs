#!/usr/bin/env node
// Hook de git pre-commit (PS-06, RNF-06): impide versionar archivos con secretos o líneas con claves.
// Se activa con: git config core.hooksPath .githooks
// También impide commitear directamente en dev, qa o main: el trabajo va en una rama tipo/N-descripcion y
// llega a esas ramas por PR.
// Variables de entorno: solo se versionan las plantillas permitidas (.env.example y las declaradas), sin valores
// sensibles; no puede haber archivos .env* no permitidos; .env y .env.example deben tener la misma estructura; y si
// el commit cambia la estructura de una plantilla, hay una PAUSA obligatoria para comunicarlo al equipo (el .env se
// copia a Descargas). Tras comunicarlo: URAQI_ENV_COMUNICADO=1 git commit …
// Ayuda al día: si el commit toca una fuente de las herramientas, ai/README.md y la configuración generada se
// regeneran solas; y las herramientas del commit deben ser coherentes con el documento maestro.
// SDD: si el commit toca sdd/*.md, los SDD deben seguir la estructura común (sdd/00-estructura.md).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { regenerarAyuda, coherenciaDeCambios, parseNameStatus } from './lib/herramientas-git.mjs';
import { cargarSdds, validar as validarSdd } from './lib/sdd.mjs';
import { cargarEquipo, colaboradores } from './lib/equipo.mjs';
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

// Ayuda (ai/README.md) y configuración generada al día: si el commit toca una fuente y están desactualizadas, se
// REGENERAN SOLAS (ai/sync.mjs); solo bloquea si el sync falla (fuente inválida). Si lo regenerado aún no está
// agregado, AVISA: así se pueden dividir los commits por tema; el hook pre-push impide subir la rama con generados
// sin commitear. ai/README.md sale de ai/docs/README.plantilla.md.
// Coherencia con el documento maestro: las herramientas de IA del commit no pueden citar identificadores (RF, RNF,
// MC, RN, CQ, VC, PS, DP, CU, HU) ni secciones (§N) que no existen (BLOQUEA); las decisiones pendientes se avisan.
const FUENTES = /^(\.agents\/skills\/|ai\/|\.githooks\/|\.github\/workflows\/|\.specify\/|specs\/|sdd\/|package\.json$|\.claude\/|\.gemini\/|\.codex\/|\.opencode\/|\.mcp\.json$|opencode\.json$)/;
const enIndice = parseNameStatus(git('diff', '--cached', '--name-status', '-M'));
if (enIndice.some((e) => FUENTES.test(e.path))) {
  const root = git('rev-parse', '--show-toplevel').trim();
  const ayuda = regenerarAyuda(root);
  if (ayuda.error) {
    process.stderr.write(`[uraqi-guard:ayuda-desactualizada] Commit bloqueado: no se pudo regenerar ai/README.md (la ayuda) ni la configuración generada.\n- ${ayuda.error}\nCorrige la fuente y ejecuta \`npm run ai:sync\`.\n`);
    process.exit(1);
  }
  if (ayuda.regenerado) process.stderr.write(`[uraqi] Ayuda y configuración regeneradas automáticamente (${ayuda.archivos.length} archivo(s)).\n`);

  const { errores, avisos } = coherenciaDeCambios(enIndice, { root, fuente: 'indice', diff: git('diff', '--cached', '-U0', '--no-color') });
  for (const a of avisos) process.stderr.write(`[uraqi] Aviso: ${a}\n`);
  if (errores.length) {
    process.stderr.write(`[uraqi-guard:incoherente-con-documento] Commit bloqueado: las herramientas de IA del commit no son coherentes con el documento maestro.\n- ${errores.join('\n- ')}\nBusca el identificador o la sección correctos en docs/UraqiVisionDocumentoMaestrov1.1.txt (skill documento-maestro).\n`);
    process.exit(1);
  }

  // SDD por área: si el commit toca sdd/*.md, todos los SDD deben conservar la estructura común.
  if (enIndice.some((e) => /^sdd\/[^/]+\.md$/.test(e.path))) {
    const { modulos, repoModulos } = cargarEquipo(root);
    const skills = fs.existsSync(path.join(root, '.agents/skills')) ? fs.readdirSync(path.join(root, '.agents/skills')) : [];
    const erroresSdd = validarSdd(cargarSdds(root), { colaboradores: colaboradores(modulos), repoModulos, skills });
    if (erroresSdd.length) {
      process.stderr.write(`[uraqi-guard:sdd-invalido] Commit bloqueado: los SDD de sdd/ no siguen la estructura común (sdd/00-estructura.md).\n- ${erroresSdd.slice(0, 15).join('\n- ')}\nRevísalo con: npm run sdd:validar\n`);
      process.exit(1);
    }
  }

  const sinAgregar = generadosSinCommitear(root, { soloSinAgregar: true });
  if (sinAgregar.length) process.stderr.write(`[uraqi] Aviso: hay archivos regenerados sin agregar (${sinAgregar.slice(0, 5).join(', ')}${sinAgregar.length > 5 ? ', …' : ''}). Inclúyelos en este commit o en uno siguiente: el push se bloquea mientras falten.\n`);
}
