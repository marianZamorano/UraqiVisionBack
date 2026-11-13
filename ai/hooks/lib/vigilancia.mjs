// Vigilancia en segundo plano de las herramientas de IA. Ningún asistente tiene un hook con temporizador, así que
// cada evento (mensaje del usuario, inicio de sesión) dispara, como máximo cada INTERVALO, una verificación completa en
// un proceso aparte que no hace esperar al asistente; el resultado queda en .git/uraqi-vigilancia.json. Si algo no
// está activo, el siguiente evento entrega al asistente la guía paso a paso (una vez por problema y sesión). Nunca lanza.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { textoGuia } from './guia-activacion.mjs';

export const INTERVALO_MS = 5 * 60 * 1000;
export const ESPERA_EN_CURSO_MS = 3 * 60 * 1000;

const archivo = (root) => path.join(root, execFileSync('git', ['rev-parse', '--git-path', 'uraqi-vigilancia.json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());

export function leerVigilancia(root) {
  try { return JSON.parse(fs.readFileSync(archivo(root), 'utf8')); } catch { return null; }
}

/** Mezcla los cambios con lo guardado (lo escriben el hook y el proceso en segundo plano). */
export function guardarVigilancia(root, cambios) {
  const datos = { ...(leerVigilancia(root) ?? {}), ...cambios };
  fs.writeFileSync(archivo(root), JSON.stringify(datos));
  return datos;
}

/** ¿Toca otra verificación? Sí si nunca se hizo o pasó el intervalo, salvo que haya una en curso reciente. */
export function debeRefrescar(cache, ahora = Date.now(), intervalo = INTERVALO_MS) {
  if (cache?.enCurso && ahora - cache.enCurso < ESPERA_EN_CURSO_MS) return false;
  return !cache?.fecha || ahora - cache.fecha >= intervalo;
}

/** Huella de los problemas actuales: si cambia, se vuelve a avisar. */
export const firmaDe = (fallos) => crypto.createHash('sha1').update(fallos.map((f) => `${f.id}:${f.detalle}`).sort().join('|')).digest('hex').slice(0, 12);

/** Lanza la verificación completa en segundo plano (desacoplada: el hook termina sin esperarla). */
export function lanzarVerificacion(root) {
  guardarVigilancia(root, { enCurso: Date.now() });
  const hijo = spawn(process.execPath, [path.join(root, 'ai/scripts/herramientas.mjs'), 'verificar', '--guardar'], {
    cwd: root, detached: true, stdio: 'ignore', windowsHide: true,
  });
  hijo.unref();
}

/**
 * Decide qué decir con lo último verificado: la guía si hay problemas nuevos para esta sesión, un aviso de que todo
 * volvió a estar activo, o nada. Pura: devuelve { texto, avisado } (avisado es lo que hay que guardar).
 */
export function decidirAviso(cache, sesion) {
  const fallos = (cache?.resultados ?? []).filter((r) => !r.ok);
  const previo = cache?.avisado ?? null;
  if (fallos.length) {
    const firma = firmaDe(fallos);
    if (previo?.firma === firma && previo?.sesion === (sesion ?? null)) return { texto: null, avisado: previo };
    return { texto: textoGuia(fallos), avisado: { firma, sesion: sesion ?? null } };
  }
  if (previo?.firma && cache?.resultados) return { texto: '[UraqiVision] ✔ Las herramientas de IA vuelven a estar todas activas (verificación en segundo plano). Díselo a la persona.', avisado: null };
  return { texto: null, avisado: previo };
}

/** Solo dispara la verificación en segundo plano si toca (el inicio de sesión ya avisa con la verificación rápida). */
export function refrescarEnSegundoPlano(cwd) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (fs.existsSync(path.join(root, 'ai/scripts/herramientas.mjs')) && debeRefrescar(leerVigilancia(root))) lanzarVerificacion(root);
  } catch {
    // la vigilancia nunca interrumpe
  }
}

/** Para los hooks: refresca en segundo plano si toca y devuelve el aviso pendiente (o null). */
export function avisoVigilancia({ cwd, sesion }) {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!fs.existsSync(path.join(root, 'ai/scripts/herramientas.mjs'))) return null;
    const cache = leerVigilancia(root);
    if (debeRefrescar(cache)) lanzarVerificacion(root);
    const { texto, avisado } = decidirAviso(cache, sesion);
    if (texto) guardarVigilancia(root, { avisado });
    return texto;
  } catch {
    return null;
  }
}
