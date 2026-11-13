// CI/CD por rama: cada rama (dev, qa, main) debe tener un pipeline que verifique conflictos, código vivo (sin código
// roto ni muerto), pruebas, build y que el proyecto vuelva a levantar. Mientras no exista una aplicación que construir
// ni un despliegue (hospedaje pendiente, DP-06), lo que falta se reporta como pendiente; cuando existan, es error.
// Funciones puras: reciben los archivos y su texto.
import path from 'node:path';

const P = path.posix;
export const RAMAS = ['dev', 'qa', 'main'];

// Etapa → patrones que la cumplen en los comandos `run:` de un workflow.
export const ETAPAS = {
  conflictos: { que: 'sin conflictos con la rama destino', re: /buenas-practicas-pr\.mjs|mergeable|git merge --no-commit|git merge-tree/ },
  'codigo-vivo': { que: 'sin código roto ni muerto', re: /codigo-vivo\.mjs\s+revisar|npm run -?s? ?codigo:revisar/ },
  pruebas: { que: 'pruebas en verde', re: /npm (?:run -?s? ?)?test\b|npm run -?s? ?test:|vitest|playwright test|pytest|node --test/ },
  build: { que: 'build del proyecto', re: /npm run -?s? ?build\b|vite build|tsc\b(?! --version)|python -m build|pip install (?:-e )?\.|codigo-vivo\.mjs\s+levantar|npm run -?s? ?codigo:levantar/ },
  levantar: { que: 'el proyecto vuelve a levantar', re: /codigo-vivo\.mjs\s+levantar|npm run -?s? ?codigo:levantar|npm run -?s? ?(?:preview|start)\b|wait-on|curl[^\n]*localhost/ },
};

/** Ramas que dispara un workflow (pull_request o push). Sin filtro de ramas: todas. */
export function ramasDeWorkflow(texto) {
  const on = /^on:\s*\r?\n((?:[ \t]+.*\r?\n?|\s*\r?\n)+)/m.exec(texto)?.[1] ?? '';
  const out = new Set();
  for (const evento of ['pull_request', 'push', 'pull_request_target']) {
    const bloque = new RegExp(`^ {2}${evento}:\\s*\\r?\\n((?: {4,}.*\\r?\\n?)*)`, 'm').exec(on);
    const enLinea = new RegExp(`^ {2}${evento}:\\s*$`, 'm').test(on) || new RegExp(`^on:\\s*\\[?[^\\n]*\\b${evento}\\b`, 'm').test(texto);
    if (!bloque && !enLinea) continue;
    const ramas = /branches:\s*\[([^\]]*)\]/.exec(bloque?.[1] ?? '')?.[1];
    const lista = ramas ? ramas.split(',').map((r) => r.trim().replace(/['"]/g, '')) : (/branches:\s*\r?\n((?:\s+- .*\r?\n?)+)/.exec(bloque?.[1] ?? '')?.[1] ?? '').split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/['"]/g, '')).filter(Boolean);
    for (const r of (lista.length ? lista : RAMAS)) if (RAMAS.includes(r) || r === '**' || r === '*') (r.includes('*') ? RAMAS : [r]).forEach((x) => out.add(x));
  }
  return out;
}

/** ¿Hay una aplicación que construir? (package.json con build, o proyecto Python). */
export function aplicaciones(archivos, leer) {
  const out = [];
  for (const f of archivos) {
    if (/(^|\/)(node_modules|fixtures?)\//.test(f)) continue;
    if (P.basename(f) === 'package.json') {
      try {
        const s = JSON.parse(leer(f) ?? '{}').scripts ?? {};
        if (s.build) out.push({ tipo: 'node', dir: P.dirname(f), build: true, levantar: Boolean(s.preview || s.start) });
      } catch { /* inválido */ }
    }
    if (/(^|\/)pyproject\.toml$/.test(f)) out.push({ tipo: 'python', dir: P.dirname(f), build: true, levantar: false });
  }
  return out;
}

/** ¿Hay despliegue configurado? */
export function despliegues(archivos, leer) {
  const out = [];
  for (const f of archivos) {
    if (/(^|\/)(vercel\.json|netlify\.toml)$/.test(f) && !/fixtures?\//.test(f)) out.push(f);
    else if (/^\.github\/workflows\/.+\.ya?ml$/.test(f) && /actions\/deploy-pages|vercel (?:deploy|--prod)|amondnet\/vercel-action|deploy-pages|environment:\s*\n?\s*(?:name:\s*)?(?:production|preproduccion|preproducción|staging|qa)/i.test(leer(f) ?? '')) out.push(f);
  }
  return out;
}

/**
 * Revisa el CI/CD de cada rama. → { estado: 'pendiente'|'completo'|'incompleto', ramas: {rama: {etapa: [workflows]}}, faltan: [{rama, etapa}], hallazgos }
 * hallazgos: [{ nivel, rama, etapa, detalle, plan }] (aviso si aún no hay aplicación ni despliegue; error si los hay).
 */
export function revisarCicd({ archivos, leer }) {
  const workflows = archivos.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f));
  const ramas = Object.fromEntries(RAMAS.map((r) => [r, Object.fromEntries(Object.keys(ETAPAS).map((e) => [e, []]))]));
  for (const w of workflows) {
    const texto = leer(w) ?? '';
    const comandos = [...texto.matchAll(/run:\s*(\|[^\n]*\n((?:\s{6,}.*\n?)*)|.+)/g)].map((m) => m[2] ?? m[1]).join('\n');
    for (const r of ramasDeWorkflow(texto)) {
      for (const [e, { re }] of Object.entries(ETAPAS)) if (re.test(comandos)) ramas[r][e].push(P.basename(w));
    }
  }
  const apps = aplicaciones(archivos, leer);
  const deploys = despliegues(archivos, leer);
  const exigible = apps.length > 0 || deploys.length > 0;
  const faltan = [];
  for (const r of RAMAS) for (const e of Object.keys(ETAPAS)) if (!ramas[r][e].length) faltan.push({ rama: r, etapa: e });
  const hallazgos = faltan.map(({ rama, etapa }) => ({
    nivel: exigible ? 'error' : 'aviso',
    rama,
    etapa,
    detalle: `la rama ${rama} no tiene un workflow que verifique «${ETAPAS[etapa].que}»`,
    plan: `Agrega a un workflow que se dispare en las PR hacia ${rama} el paso de ${etapa}${etapa === 'build' || etapa === 'levantar' ? ' (node ai/scripts/codigo-vivo.mjs levantar construye y arranca lo que exista)' : etapa === 'codigo-vivo' ? ' (node ai/scripts/codigo-vivo.mjs revisar)' : ''}.`,
  }));
  if (deploys.length && !deploys.some((d) => /qa|preprod|staging/i.test(leer(d) ?? ''))) {
    hallazgos.push({ nivel: 'aviso', rama: 'qa', etapa: 'despliegue', detalle: 'hay despliegue configurado pero ninguno de preproducción para qa', plan: 'qa debe tener su propio despliegue, separado de producción (AGENTS.md, entornos por rama).' });
  }
  const estado = !exigible ? 'pendiente' : faltan.length ? 'incompleto' : 'completo';
  return { estado, ramas, faltan, apps, deploys, hallazgos };
}

/** Texto en markdown del estado del CI/CD. */
export function textoCicd(r) {
  const cab = r.estado === 'pendiente'
    ? '### CI/CD · ⏳ pendiente: todavía no hay aplicación que construir ni despliegue (hospedaje: DP-06)'
    : r.estado === 'completo' ? '### CI/CD · ✔ cada rama verifica conflictos, código vivo, pruebas, build y arranque' : '### CI/CD · ✘ incompleto';
  const etapas = Object.keys(ETAPAS);
  const out = [cab, '', `| Rama | ${etapas.join(' | ')} |`, `|---|${etapas.map(() => '---').join('|')}|`];
  for (const rama of RAMAS) out.push(`| \`${rama}\` | ${etapas.map((e) => (r.ramas[rama][e].length ? '✔' : r.estado === 'pendiente' ? '⏳' : '✘')).join(' | ')} |`);
  if (r.estado === 'pendiente') out.push('', 'Cuando se implemente el CI/CD, cada rama debe cubrir las cinco etapas; desde que exista la web, el pipeline o un despliegue, lo que falte será error.');
  else for (const h of r.hallazgos) out.push(`- ${h.nivel === 'error' ? '✘' : '⚠'} ${h.detalle}. ${h.plan}`);
  return out.join('\n');
}
