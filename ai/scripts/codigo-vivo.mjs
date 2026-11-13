#!/usr/bin/env node
// uraqi: sin-marcadores — la cabecera describe los patrones que busca el revisor.
// Revisor de código vivo y CI/CD: detecta código que no funciona o que no está conectado (imports rotos, paquetes
// sin declarar, referencias a archivos inexistentes, código muerto, código que solo usan las pruebas, trabajo sin
// terminar, datos simulados, pruebas desactivadas) y da un plan de solución; revisa que cada rama tenga su CI/CD con
// conflictos, código vivo, pruebas, build y arranque; y construye y levanta el proyecto para comprobar que arranca.
// Se activa solo en las PR hacia qa y main (workflow Código vivo y guarda de los asistentes al crear la PR).
//   node ai/scripts/codigo-vivo.mjs revisar [--json] [--pr <N>]   (falla si hay errores; en CI comenta la PR)
//   node ai/scripts/codigo-vivo.mjs levantar                      (build y arranque de lo que exista)
//   node ai/scripts/codigo-vivo.mjs cicd                          (solo el estado del CI/CD por rama)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { analizar, informe } from '../hooks/lib/codigo-vivo.mjs';
import { revisarCicd, textoCicd, aplicaciones } from '../hooks/lib/cicd.mjs';
import { api, repoSlug } from '../hooks/lib/github.mjs';

const args = process.argv.slice(2);
const comando = args[0] ?? 'revisar';
const valor = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const MARCA = '<!-- uraqi-codigo-vivo -->';

/** Archivos del repositorio: versionados y nuevos no ignorados que existen en disco. */
function archivosDelRepo() {
  const ls = (a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
  return [...new Set([...ls(['ls-files']), ...ls(['ls-files', '--others', '--exclude-standard'])])].filter((f) => fs.existsSync(path.join(root, f)));
}
const leer = (f) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return null; } };
const resumenPaso = (t) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${t}\n`); };

async function comentar(numero, cuerpo) {
  if (!numero || !process.env.GITHUB_TOKEN) return;
  const slug = repoSlug(root);
  const comentarios = await api(`repos/${slug}/issues/${numero}/comments?per_page=100`);
  const previo = comentarios.find((c) => c.body?.includes(MARCA));
  if (previo) await api(`repos/${slug}/issues/comments/${previo.id}`, { method: 'PATCH', body: { body: cuerpo } });
  else await api(`repos/${slug}/issues/${numero}/comments`, { method: 'POST', body: { body: cuerpo } });
}

async function cmdRevisar() {
  const archivos = archivosDelRepo();
  const r = analizar({ archivos, leer });
  const cicd = revisarCicd({ archivos, leer });
  const errores = r.hallazgos.filter((h) => h.nivel === 'error').length + cicd.hallazgos.filter((h) => h.nivel === 'error').length;
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ...r, cicd }, null, 2));
  } else {
    const cuerpo = [MARCA, informe(r, { titulo: 'Revisor de código vivo' }), '', textoCicd(cicd)].join('\n');
    console.log(cuerpo);
    resumenPaso(cuerpo);
    await comentar(valor('--pr'), cuerpo);
  }
  process.exitCode = errores ? 1 : 0;
}

function cmdCicd() {
  const archivos = archivosDelRepo();
  const cicd = revisarCicd({ archivos, leer });
  console.log(textoCicd(cicd));
  process.exitCode = cicd.hallazgos.some((h) => h.nivel === 'error') ? 1 : 0;
}

// ------------------------------------------------------------------ Build y arranque

// npm a través del Node actual (sin shell: en Windows evita npm.cmd y la concatenación insegura de argumentos).
function npm(a) {
  const bin = path.dirname(process.execPath);
  const cli = [path.join(bin, 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find((c) => fs.existsSync(c));
  return cli ? { cmd: process.execPath, args: [cli, ...a], shell: false } : { cmd: 'npm', args: a, shell: process.platform === 'win32' };
}
const correrNpm = (a, cwd) => { const n = npm(a); return spawnSync(n.cmd, n.args, { cwd, encoding: 'utf8', shell: n.shell, timeout: 15 * 60 * 1000, env: process.env }); };
const correr = (cmd, a, cwd) => spawnSync(cmd, a, { cwd, encoding: 'utf8', timeout: 15 * 60 * 1000, env: process.env });

function matar(hijo) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F']);
  else try { process.kill(-hijo.pid, 'SIGTERM'); } catch { hijo.kill('SIGTERM'); }
}

/** Arranca `npm run <script>` y espera a que responda por HTTP. */
function arrancar(dir, script, segundos = 90) {
  return new Promise((resolve) => {
    const n = npm(['run', script]);
    const hijo = spawn(n.cmd, n.args, { cwd: dir, shell: n.shell, detached: process.platform !== 'win32', env: { ...process.env, BROWSER: 'none', CI: 'true' } });
    let salida = '';
    let url = null;
    const fin = (ok, detalle) => { clearInterval(sondeo); clearTimeout(limite); matar(hijo); resolve({ ok, detalle }); };
    const limite = setTimeout(() => fin(false, `no respondió en ${segundos} s${url ? ` (${url})` : ''}. Últimas líneas: ${salida.split('\n').slice(-4).join(' | ')}`), segundos * 1000);
    const leerSalida = (d) => { salida += d; url ??= /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\]):\d+[^\s]*)/.exec(salida)?.[1]?.replace('0.0.0.0', '127.0.0.1') ?? null; };
    hijo.stdout.on('data', leerSalida);
    hijo.stderr.on('data', leerSalida);
    hijo.on('exit', (code) => fin(false, `el proceso terminó (código ${code}) antes de responder. ${salida.split('\n').slice(-4).join(' | ')}`));
    const sondeo = setInterval(async () => {
      if (!url) return;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.status < 500) fin(true, `${url} responde ${res.status}`);
      } catch { /* aún no responde */ }
    }, 1500);
  });
}

async function cmdLevantar() {
  const apps = aplicaciones(archivosDelRepo(), leer);
  if (!apps.length) {
    const t = '### Build y arranque · ⏳ nada que construir todavía\n\nNo hay un package.json con script `build` ni un pyproject.toml (la web y el pipeline aún no existen). Cuando existan, este paso los construirá y comprobará que vuelven a levantar.';
    console.log(t);
    resumenPaso(t);
    return;
  }
  const lineas = ['### Build y arranque'];
  let fallos = 0;
  for (const app of apps) {
    const dir = path.join(root, app.dir);
    const nombre = app.dir === '.' ? 'raíz' : app.dir;
    if (app.tipo === 'node') {
      const install = fs.existsSync(path.join(dir, 'package-lock.json')) ? ['ci', '--no-fund', '--no-audit'] : ['install', '--no-fund', '--no-audit'];
      const i = correrNpm(install, dir);
      if (i.status !== 0) { fallos += 1; lineas.push(`- ✘ \`${nombre}\`: npm ${install[0]} falló. ${`${i.stderr}`.split('\n').slice(-3).join(' | ')}`); continue; }
      const b = correrNpm(['run', 'build'], dir);
      if (b.status !== 0) { fallos += 1; lineas.push(`- ✘ \`${nombre}\`: npm run build falló. ${`${b.stdout}${b.stderr}`.split('\n').filter(Boolean).slice(-4).join(' | ')}`); continue; }
      lineas.push(`- ✔ \`${nombre}\`: build correcto.`);
      if (app.levantar) {
        const s = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).scripts;
        const r = await arrancar(dir, s.preview ? 'preview' : 'start');
        if (!r.ok) fallos += 1;
        lineas.push(`- ${r.ok ? '✔' : '✘'} \`${nombre}\`: arranque (${s.preview ? 'preview' : 'start'}): ${r.detalle}`);
      } else {
        fallos += 1;
        lineas.push(`- ✘ \`${nombre}\`: no tiene script \`preview\` ni \`start\`: no se puede comprobar que vuelve a levantar. Agrega uno.`);
      }
    } else {
      const py = process.platform === 'win32' ? 'python' : 'python3';
      const i = correr(py, ['-m', 'pip', 'install', '--quiet', '.'], dir);
      const c = correr(py, ['-m', 'compileall', '-q', '.'], dir);
      const ok = i.status === 0 && c.status === 0;
      if (!ok) fallos += 1;
      lineas.push(`- ${ok ? '✔' : '✘'} \`${nombre}\` (Python): instalación ${i.status === 0 ? 'correcta' : 'fallida'}, compilación ${c.status === 0 ? 'correcta' : 'fallida'}.`);
    }
  }
  const t = lineas.join('\n');
  console.log(t);
  resumenPaso(t);
  process.exitCode = fallos ? 1 : 0;
}

const comandos = { revisar: cmdRevisar, levantar: cmdLevantar, cicd: cmdCicd };
if (!comandos[comando]) {
  console.error(`Comando desconocido: ${comando}. Usa: ${Object.keys(comandos).join(', ')}.`);
  process.exit(2);
}
try {
  await comandos[comando]();
} catch (err) {
  console.error(`[uraqi] codigo-vivo ${comando}: ${err.message}`);
  process.exit(1);
}
