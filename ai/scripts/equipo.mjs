#!/usr/bin/env node
// Equipo y módulos (§19 del documento maestro): quién es la persona, qué le corresponde y cuándo apoya el rol de
// otra. Lo usa vibecodear antes de planificar. La identidad se guarda solo en el clon (.git/uraqi-colaborador.json).
//   node ai/scripts/equipo.mjs modulos                 tabla de §19 (módulos de este repositorio marcados)
//   node ai/scripts/equipo.mjs opciones [--json]       opciones de la pregunta «¿Qué colaborador eres?»
//   node ai/scripts/equipo.mjs soy <Nombre>            registra quién eres (nombre tal como figura en §19)
//   node ai/scripts/equipo.mjs quien                   quién está registrado y sus módulos
//   node ai/scripts/equipo.mjs alcance <RF-xx|M-…>...  ¿es tuyo o vas a apoyar el rol de otra persona?
//   node ai/scripts/equipo.mjs olvidar                 borra la identidad registrada en este clon
import { execFileSync } from 'node:child_process';
import {
  cargarEquipo, opciones, normalizarNombre, rolesDe, colaboradores, guardarIdentidad, leerIdentidad, olvidarIdentidad,
  evaluarAlcance, textoApoyo,
} from '../hooks/lib/equipo.mjs';

const [comando = 'quien', ...resto] = process.argv.slice(2);
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const { modulos, repoModulos } = cargarEquipo(root);

if (!modulos.length) {
  console.error('No se pudo leer §19 del documento maestro (docs/UraqiVisionDocumentoMaestrov1.0.txt). Regenera la copia: uv run --with pypdf python ai/scripts/extraer_documento.py');
  process.exit(1);
}

function resumen(nombre) {
  const r = rolesDe(nombre, modulos);
  const aqui = (l) => l.filter((m) => repoModulos.includes(m));
  const fuera = (l) => l.filter((m) => !repoModulos.includes(m));
  return [
    `${nombre} (§19):`,
    `- En este repositorio: responsable de ${aqui(r.responsable).join(', ') || '—'}; apoyo en ${aqui(r.apoyo).join(', ') || '—'}; revisa ${aqui(r.revisor).join(', ') || '—'}.`,
    `- En el otro repositorio: responsable de ${fuera(r.responsable).join(', ') || '—'}; apoyo en ${fuera(r.apoyo).join(', ') || '—'}; revisa ${fuera(r.revisor).join(', ') || '—'}.`,
    !aqui([...r.responsable, ...r.apoyo]).length ? `⚠ No tienes módulos propios en este repositorio: cualquier desarrollo aquí es apoyo al rol de otra persona; avísale antes.` : '',
  ].filter(Boolean).join('\n');
}

const comandos = {
  modulos() {
    console.log('| Módulo | Aquí | Responsable | Apoyo | Revisor | Requisitos |\n|---|---|---|---|---|---|');
    for (const m of modulos) console.log(`| ${m.id} | ${repoModulos.includes(m.id) ? 'sí' : '—'} | ${m.responsables.join(', ')} | ${m.apoyo.join(', ') || '—'} | ${m.revisores.join(', ')} | ${m.requisitos.join(' ')} |`);
  },
  opciones() {
    const o = opciones(modulos, repoModulos);
    if (resto.includes('--json')) { console.log(JSON.stringify({ pregunta: '¿Qué colaborador eres?', ...o }, null, 2)); return; }
    console.log('¿Qué colaborador eres?');
    o.opciones.forEach((x, i) => console.log(`  ${i + 1}. ${x.nombre} — ${x.descripcion}`));
    if (o.otros.length) console.log(`  Otra persona del equipo: ${o.otros.join(', ')}`);
  },
  soy() {
    const nombre = normalizarNombre(resto.join(' '), modulos);
    if (!nombre) {
      console.error(`«${resto.join(' ')}» no figura en §19. El equipo es: ${colaboradores(modulos).join(', ')}. Una tarea sin responsable se considera sin asignar (§19).`);
      process.exit(1);
    }
    guardarIdentidad(root, { nombre });
    console.log(`Registrado en este clon: ${nombre}.\n${resumen(nombre)}`);
  },
  quien() {
    const id = leerIdentidad(root);
    if (!id) { console.log('Nadie registrado en este clon. vibecodear te preguntará quién eres (npm run equipo:soy -- <Nombre>).'); return; }
    console.log(`${resumen(id.nombre)}\nRegistrado: ${new Date(id.fecha).toLocaleString()}.`);
  },
  alcance() {
    const id = leerIdentidad(root);
    const nombre = normalizarNombre(resto.find((a) => a.startsWith('--como='))?.slice(7) ?? id?.nombre, modulos);
    const refs = resto.filter((a) => !a.startsWith('--')).flatMap((a) => a.split(/[\s,]+/)).filter(Boolean);
    if (!nombre) { console.error('Primero registra quién eres: node ai/scripts/equipo.mjs soy <Nombre>'); process.exit(1); }
    if (!refs.length) { console.error('Indica identificadores o módulos: node ai/scripts/equipo.mjs alcance RF-05 RF-06 (o M-MAPA)'); process.exit(1); }
    const a = evaluarAlcance({ nombre, refs, modulos, repoModulos });
    if (a.propios.length) console.log(`✔ Tuyo: ${a.propios.join(', ')}.`);
    const t = textoApoyo(a, nombre);
    if (t) console.log(t);
    if (a.sinModulo.length) console.log(`ℹ Sin módulo en §19: ${a.sinModulo.join(', ')} (transversal: acuérdalo con el equipo).`);
    process.exitCode = a.apoyo.length || a.otroRepo.length ? 3 : 0;
  },
  olvidar() {
    olvidarIdentidad(root);
    console.log('Identidad borrada de este clon.');
  },
};

if (!comandos[comando]) {
  console.error(`Comando desconocido: ${comando}. Usa: ${Object.keys(comandos).join(', ')}.`);
  process.exit(2);
}
comandos[comando]();
