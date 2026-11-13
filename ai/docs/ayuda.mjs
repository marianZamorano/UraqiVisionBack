#!/usr/bin/env node
// Ayuda en la terminal a partir de ai/README.md (generado por ai/sync.mjs, siempre al día).
//   npm run ayuda                 índice de secciones
//   npm run ayuda -- <tema>       secciones cuyo título contiene el tema; si ninguna, líneas que lo mencionan
// Sin acentos ni mayúsculas: «guardas», «sdd», «mcp», «instalacion», «scripts», «microauditoria»…
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const readme = path.join(ROOT, 'ai/README.md');
if (!fs.existsSync(readme)) {
  console.error('No existe ai/README.md: ejecuta `npm run ai:sync`.');
  process.exit(1);
}
const plano = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lineas = fs.readFileSync(readme, 'utf8').replace(/\r\n/g, '\n').split('\n');
const tema = plano(process.argv.slice(2).join(' ').trim());

// Secciones por títulos ## y ###.
const secciones = [];
lineas.forEach((l, i) => {
  const m = /^(#{2,3})\s+(.*)$/.exec(l);
  if (m) secciones.push({ nivel: m[1].length, titulo: m[2], inicio: i });
});
secciones.forEach((s, i) => {
  const sig = secciones.slice(i + 1).find((o) => o.nivel <= s.nivel);
  s.fin = sig ? sig.inicio : lineas.length;
});

if (!tema) {
  console.log('Ayuda de UraqiVision (ai/README.md). Uso: npm run ayuda -- <tema>\n');
  for (const s of secciones) console.log(`${s.nivel === 3 ? '    ' : '  '}${s.titulo}`);
  process.exit(0);
}

const coinciden = secciones.filter((s) => plano(s.titulo).includes(tema));
if (coinciden.length) {
  const vistas = new Set();
  for (const s of coinciden) {
    if ([...vistas].some((v) => v.inicio <= s.inicio && s.fin <= v.fin)) continue;
    vistas.add(s);
    console.log(lineas.slice(s.inicio, s.fin).join('\n').trim(), '\n');
  }
  process.exit(0);
}

const hits = lineas.map((l, i) => [l, i]).filter(([l]) => plano(l).includes(tema));
if (!hits.length) {
  console.log(`Nada sobre «${tema}». Prueba con: ${secciones.filter((s) => s.nivel === 2).map((s) => plano(s.titulo).split(/[\s:]/)[0]).join(', ')}.`);
  process.exit(1);
}
for (const [l, i] of hits.slice(0, 40)) {
  const sec = [...secciones].reverse().find((s) => s.inicio <= i);
  console.log(`[${sec?.titulo ?? 'inicio'}] ${l.trim()}`);
}
if (hits.length > 40) console.log(`… y ${hits.length - 40} más.`);
