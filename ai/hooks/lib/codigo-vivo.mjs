// Código vivo: detecta código que no funciona o que no está conectado a nada, aunque dé la impresión de funcionar.
// uraqi: sin-marcadores — este archivo define los patrones que busca.
// - error: imports rotos, paquetes sin declarar, referencias (package.json, workflows, hooks, MCP) a archivos que no
//   existen, archivos de código a los que nada llega (código muerto) y pruebas con .only.
// - aviso: módulos o exportaciones que solo usan las pruebas o que nadie usa, marcadores de trabajo sin terminar
//   (TODO, «no implementado»), datos simulados fuera de las pruebas (RN-04), pruebas desactivadas y documentación que
//   cita scripts inexistentes.
// Cada hallazgo trae su plan de solución. Análisis estático sin dependencias: lee archivos, no ejecuta nada.
// Un archivo intencionalmente suelto se marca en sus primeras líneas con «uraqi: vivo — <motivo>».
import { builtinModules } from 'node:module';
import path from 'node:path';

const P = path.posix;
export const CODIGO = /\.(mjs|cjs|js|jsx|ts|tsx|mts|cts)$/;
const PY = /\.py$/;
const EXTS = ['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts'];
const BUILTIN = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/** Fuera del análisis: dependencias, generados por ai/sync.mjs, salidas de build y fixtures rotos a propósito. */
export function excluido(ruta) {
  return /(^|\/)(node_modules|dist|build|coverage|\.venv|venv|__pycache__|\.git)\//.test(ruta)
    || /(^|\/)fixtures?\//.test(ruta)
    || /^\.(claude|gemini|codex)\//.test(ruta)
    || /^\.specify\//.test(ruta);
}

export const esPrueba = (ruta) => /(^|\/)(test|tests|__tests__|e2e)\//.test(ruta) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(ruta) || /(^|\/)test_[^/]+\.py$|_test\.py$/.test(ruta);
const esConfig = (ruta) => /(^|\/)[\w.-]+\.config\.[cm]?[jt]s$/.test(ruta) || /(^|\/)(vite|vitest|playwright|eslint|commitlint|tailwind|postcss)\.config\./.test(ruta);

export const PLANES = {
  'import-roto': 'Corrige la ruta del import o crea el módulo que falta; si el import sobra, quítalo.',
  'paquete-no-declarado': 'Declara el paquete con versión fijada en el package.json más cercano (y npm install), o quita el import: en un clon nuevo fallará.',
  'referencia-rota': 'Actualiza la referencia al archivo correcto o restaura el archivo; si ya no se usa, quita la referencia.',
  'codigo-muerto': 'Si cumple un requisito (cita su RF/RNF), conéctalo: impórtalo donde se usa o regístralo como entrada (script npm, workflow, hook o MCP). Si no, bórralo en una rama con su issue. Si es intencional, márcalo con «uraqi: vivo — <motivo>».',
  'solo-pruebas': 'Conecta el módulo al código real que debe usarlo, o elimina el módulo y sus pruebas: probar código que nadie usa da una falsa idea de que funciona.',
  'exportacion-sin-uso': 'Usa la exportación donde corresponda o deja de exportarla (y bórrala si nadie la necesita).',
  'sin-terminar': 'Termínalo o abre un issue con lo pendiente y quita el marcador: no se integra código que promete algo que no hace (§28, regla 4: lo pendiente se declara).',
  'datos-simulados': 'RN-04: los datos simulados o de ejemplo no se muestran como resultados. Muévelos a fixtures de pruebas o etiquétalos como ejemplo en la interfaz.',
  'prueba-only': 'Quita .only: oculta el resto de las pruebas y el CI pasaría sin ejecutarlas.',
  'prueba-desactivada': 'Reactiva la prueba o abre un issue que explique por qué sigue desactivada.',
  'doc-cita-inexistente': 'Corrige la ruta citada en la documentación o quita la cita: un comando que no existe hace creer que hay una herramienta.',
};

const NIVEL = {
  'import-roto': 'error', 'paquete-no-declarado': 'error', 'referencia-rota': 'error', 'codigo-muerto': 'error', 'prueba-only': 'error',
  'solo-pruebas': 'aviso', 'exportacion-sin-uso': 'aviso', 'sin-terminar': 'aviso', 'datos-simulados': 'aviso', 'prueba-desactivada': 'aviso', 'doc-cita-inexistente': 'aviso',
};

const hallazgo = (tipo, archivo, detalle, linea) => ({ tipo, nivel: NIVEL[tipo], archivo, linea, detalle, plan: PLANES[tipo] });

// ------------------------------------------------------------------ Lectura de imports y exports

/**
 * Código JS/TS con los comentarios, las plantillas de texto (`…`), las expresiones regulares y los textos entre
 * comillas que contienen código de ejemplo (import, require, from) reemplazados por espacios (conserva los saltos de
 * línea). Recorre el texto en orden, así un «//» dentro de un texto no se toma por comentario.
 */
export function enmascarar(texto) {
  const t = String(texto);
  const out = [];
  const blanco = (s) => s.replace(/[^\n]/g, ' ');
  let i = 0;
  let previo = ''; // último carácter significativo fuera de comentarios (para distinguir / división de / regex)
  while (i < t.length) {
    const c = t[i];
    const d = t[i + 1];
    let fin = -1;
    if (c === '/' && d === '/') {
      fin = t.indexOf('\n', i); if (fin < 0) fin = t.length;
      out.push(blanco(t.slice(i, fin))); i = fin; continue;
    }
    if (c === '/' && d === '*') {
      fin = t.indexOf('*/', i + 2); fin = fin < 0 ? t.length : fin + 2;
      out.push(blanco(t.slice(i, fin))); i = fin; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < t.length && t[j] !== c && !(c !== '`' && t[j] === '\n')) j += t[j] === '\\' ? 2 : 1;
      const s = t.slice(i, j + 1);
      out.push(c === '`' || /\b(?:import|require|from)\b/.test(s) ? blanco(s) : s);
      previo = c; i = j + 1; continue;
    }
    if (c === '/' && (previo === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(previo))) {
      let j = i + 1;
      let clase = false;
      while (j < t.length && t[j] !== '\n' && (clase || t[j] !== '/')) {
        if (t[j] === '\\') j += 1; else if (t[j] === '[') clase = true; else if (t[j] === ']') clase = false;
        j += 1;
      }
      out.push(blanco(t.slice(i, j + 1))); previo = '/'; i = j + 1; continue;
    }
    if (!/\s/.test(c)) previo = /[\w$)\]]/.test(c) ? 'x' : c;
    out.push(c); i += 1;
  }
  return out.join('');
}

/** Especificadores importados por un archivo JS/TS: [{ spec, nombres: Set|'*', linea }] */
export function importsDe(texto) {
  const out = [];
  const lineaDe = (i) => texto.slice(0, i).split('\n').length;
  const en = (m, palabra) => m.index + m[0].indexOf(palabra);
  const sinComentarios = enmascarar(texto);
  for (const m of sinComentarios.matchAll(/(?:^|[;\n}])\s*import\s+(type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clausula = m[2];
    let nombres = new Set();
    if (/\*\s+as\s+\w+/.test(clausula)) nombres = '*';
    else {
      const def = /^\s*([\w$]+)\s*(,|$)/.exec(clausula);
      if (def) nombres.add('default');
      const llaves = /\{([\s\S]*)\}/.exec(clausula);
      if (llaves) for (const n of llaves[1].split(',')) { const k = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim(); if (k) nombres.add(k); }
    }
    out.push({ spec: m[3], nombres, linea: lineaDe(en(m, 'import')) });
  }
  for (const m of sinComentarios.matchAll(/(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g)) out.push({ spec: m[1], nombres: new Set(), linea: lineaDe(en(m, 'import')) });
  for (const m of sinComentarios.matchAll(/(?:^|[;\n])\s*export\s+(\*|\{[^}]*\})(?:\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]/g)) {
    out.push({ spec: m[2], nombres: m[1] === '*' ? '*' : new Set(m[1].slice(1, -1).split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)), linea: lineaDe(en(m, 'export')) });
  }
  for (const m of sinComentarios.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: m[1], nombres: '*', linea: lineaDe(m.index) });
  for (const m of sinComentarios.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: m[1], nombres: '*', linea: lineaDe(m.index) });
  return out;
}

/** Nombres exportados por un archivo JS/TS. */
export function exportsDe(texto) {
  const out = new Set();
  for (const m of texto.matchAll(/^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/gm)) out.add(m[1]);
  for (const m of texto.matchAll(/^\s*export\s+default\b/gm)) out.add('default');
  for (const m of texto.matchAll(/^\s*export\s*\{([^}]*)\}(?!\s*from)/gm)) {
    for (const n of m[1].split(',')) { const k = n.trim().split(/\s+as\s+/).pop().trim(); if (k) out.add(k); }
  }
  return out;
}

/** Módulos locales importados por un archivo Python: nombres con puntos y si son relativos. */
export function importsPython(texto) {
  const out = [];
  for (const m of texto.matchAll(/^\s*from\s+(\.*)([\w.]*)\s+import\s+/gm)) out.push({ puntos: m[1].length, modulo: m[2] });
  for (const m of texto.matchAll(/^\s*import\s+([\w., ]+)$/gm)) for (const n of m[1].split(',')) out.push({ puntos: 0, modulo: n.trim().split(/\s+as\s+/)[0] });
  return out;
}

// ------------------------------------------------------------------ Puntos de entrada

const RUTA_CODIGO = /(?:^|[\s"'`=(:,[])((?:\.{1,2}\/|\$\{?[A-Z_]+\}?\/)?[\w.@-]+(?:\/[\w.@$-]+)*\.(?:mjs|cjs|js|jsx|ts|tsx|py))(?=$|[\s"'`),;\]:])/g;
const COMANDO_DOC = /\b(?:node|python3?|uv run|npx tsx|tsx|deno run|bun)\s+(?:--?[\w-]+(?:[= ][^\s"'`-][^\s"'`]*)?\s+)*["'`]?((?:\$\{?\w+\}?\/)?[\w.@/-]+\.(?:mjs|cjs|js|ts|py))/g;

/**
 * Entradas: archivos que algo ejecuta (package.json, workflows, hooks de git, configuración de asistentes, MCP,
 * configs, index.html, marca «uraqi: vivo» y comandos citados en la documentación).
 * → { entradas: Map<ruta, origen>, rotas: [{origen, ruta, doc}] }
 */
export function entradas({ archivos, leer, existe }) {
  const entradasMap = new Map();
  const rotas = [];
  const agregar = (ruta, origen, { doc = false, base = '' } = {}) => {
    const r = P.normalize(base ? P.join(base, ruta) : ruta).replace(/^\.\//, '');
    if (r.startsWith('..') || /^(https?:|\/)/.test(ruta)) return;
    if (existe(r)) { if (!entradasMap.has(r)) entradasMap.set(r, origen); }
    else rotas.push({ origen, ruta: r, doc });
  };
  for (const f of archivos) {
    const nombre = P.basename(f);
    const dir = P.dirname(f) === '.' ? '' : P.dirname(f);
    if (nombre === 'package.json') {
      let pkg;
      try { pkg = JSON.parse(leer(f)); } catch { continue; }
      for (const [s, cmd] of Object.entries(pkg.scripts ?? {})) for (const m of String(cmd).matchAll(RUTA_CODIGO)) agregar(m[1], `${f} → scripts.${s}`, { base: dir });
      for (const campo of ['main', 'module', 'types']) if (typeof pkg[campo] === 'string' && CODIGO.test(pkg[campo])) agregar(pkg[campo], `${f} → ${campo}`, { base: dir });
      const bin = typeof pkg.bin === 'string' ? { bin: pkg.bin } : (pkg.bin ?? {});
      for (const v of Object.values(bin)) agregar(v, `${f} → bin`, { base: dir });
    } else if (/^\.githooks\//.test(f) || /^\.github\/workflows\/.+\.ya?ml$/.test(f)
      || ['.claude/settings.json', '.codex/hooks.json', '.codex/config.toml', '.gemini/settings.json', '.mcp.json', 'opencode.json', 'ai/mcp/servers.json'].includes(f)) {
      const texto = leer(f) ?? '';
      for (const m of texto.replace(/\$CLAUDE_PROJECT_DIR\/|\$\(git rev-parse --show-toplevel\)\/|\$ROOT\//g, '').matchAll(RUTA_CODIGO)) {
        if (/^\$/.test(m[1]) || /node_modules\//.test(m[1])) continue;
        agregar(m[1], f);
      }
    } else if (/^\.opencode\/plugins\/.+\.[cm]?[jt]s$/.test(f) || esConfig(f)) {
      entradasMap.set(f, 'cargado por su herramienta');
    } else if (nombre === 'index.html') {
      for (const m of (leer(f) ?? '').matchAll(/<script[^>]+src=["']\/?([^"']+)["']/g)) agregar(m[1], f, { base: dir });
    } else if ((/\.md$/.test(f) || /\.ya?ml$/.test(f)) && !excluido(f) && !/^ai\/README\.md$/.test(f)) {
      // Documentación (y plantillas .yml de las skills): comandos citados y archivos de ejemplo citados por nombre.
      const texto = leer(f) ?? '';
      for (const m of texto.matchAll(/`([\w.-]+\.(?:mjs|cjs|js|jsx|ts|tsx|py))`/g)) {
        if (existe(P.join(dir, m[1])) && !entradasMap.has(P.join(dir, m[1]))) entradasMap.set(P.join(dir, m[1]), `${f} (ejemplo documentado)`);
      }
      for (const m of texto.matchAll(COMANDO_DOC)) {
        let ruta = m[1];
        if (/^\$\{?\w+\}?\//.test(ruta)) ruta = P.join(dir, ruta.replace(/^\$\{?\w+\}?\//, ''));
        else if (!/^(ai|\.agents|\.github|\.githooks|src|web|app|pipeline|scripts|tests?|docs)\//.test(ruta) && existe(P.join(dir, ruta))) ruta = P.join(dir, ruta);
        agregar(ruta, `${f} (documentado)`, { doc: true });
      }
    }
    if ((CODIGO.test(f) || PY.test(f)) && /uraqi:\s*vivo/.test((leer(f) ?? '').split('\n').slice(0, 6).join('\n'))) entradasMap.set(f, 'marcado «uraqi: vivo»');
  }
  return { entradas: entradasMap, rotas };
}

// ------------------------------------------------------------------ Análisis

function resolverJs(desde, spec, existe) {
  const base = P.normalize(P.join(P.dirname(desde), spec));
  const candidatos = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => P.join(base, `index${e}`))];
  if (/\.js$/.test(base)) candidatos.push(base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'));
  return candidatos.find((c) => existe(c)) ?? null;
}

function resolverPy(desde, { puntos, modulo }, existe) {
  const partes = modulo ? modulo.split('.') : [];
  const bases = [];
  if (puntos) {
    let d = P.dirname(desde);
    for (let i = 1; i < puntos; i += 1) d = P.dirname(d);
    bases.push(d);
  } else {
    let d = P.dirname(desde);
    while (true) { bases.push(d); if (d === '.' || d === '') break; d = P.dirname(d); }
  }
  for (const b of bases) {
    const r = P.join(b, ...partes);
    for (const c of [`${r}.py`, P.join(r, '__init__.py')]) if (existe(c)) return c;
  }
  return null;
}

function paqueteDeclarado(desde, spec, leer, existe) {
  const nombre = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  let d = P.dirname(desde);
  while (true) {
    const pj = d === '.' ? 'package.json' : P.join(d, 'package.json');
    if (existe(pj)) {
      try {
        const pkg = JSON.parse(leer(pj));
        if ([pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies].some((x) => x && x[nombre]) || pkg.name === nombre) return true;
      } catch { /* package.json inválido: lo reporta otra guarda */ }
    }
    if (d === '.' || d === '') return false;
    d = P.dirname(d);
  }
}

const MARCADOR = /(?:\/\/|#|\/\*|\*)\s*(?:TODO|FIXME|XXX|HACK)\b[^\n]*|\b(?:not implemented|no implementad[oa]|sin implementar|por implementar)\b/gi;
const SIMULADO = /\b(?:lorem ipsum|datos? (?:de ejemplo|simulados?|falsos?|ficticios?)|mock(?:ed)?Data|fakeData|dummyData|sampleData)\b/gi;

/**
 * Analiza el repositorio. archivos: rutas relativas (con /); leer(ruta) → texto o null.
 * → { hallazgos, stats: { codigo, vivos, entradas, pruebas } }
 */
export function analizar({ archivos, leer }) {
  const todos = new Set(archivos.map((a) => a.replace(/\\/g, '/')));
  const existe = (r) => todos.has(r);
  const lista = [...todos];
  const codigo = lista.filter((f) => (CODIGO.test(f) || PY.test(f)) && !excluido(f) && !/\.d\.ts$/.test(f));
  const hallazgos = [];
  const { entradas: ent, rotas } = entradas({ archivos: lista, leer, existe });
  for (const r of rotas) {
    if (r.doc) hallazgos.push(hallazgo('doc-cita-inexistente', r.origen.replace(/ \(documentado\)$/, ''), `cita ${r.ruta}, que no existe`));
    else hallazgos.push(hallazgo('referencia-rota', r.origen.split(' → ')[0], `${r.origen} apunta a ${r.ruta}, que no existe`));
  }

  // Grafo de imports.
  const aristas = new Map(); // archivo → [destino]
  const usos = new Map(); // destino → [{ desde, nombres }]
  for (const f of codigo) {
    const texto = leer(f) ?? '';
    const destinos = [];
    if (PY.test(f)) {
      for (const imp of importsPython(texto)) {
        const r = resolverPy(f, imp, existe);
        if (r) destinos.push(r);
        else if (imp.puntos) hallazgos.push(hallazgo('import-roto', f, `importa «${'.'.repeat(imp.puntos)}${imp.modulo}», que no existe`));
      }
    } else {
      for (const imp of importsDe(texto)) {
        if (/^\.{1,2}\//.test(imp.spec)) {
          const r = resolverJs(f, imp.spec, existe);
          if (!r) { hallazgos.push(hallazgo('import-roto', f, `importa «${imp.spec}», que no existe`, imp.linea)); continue; }
          destinos.push(r);
          if (!usos.has(r)) usos.set(r, []);
          usos.get(r).push({ desde: f, nombres: imp.nombres });
        } else if (!BUILTIN.has(imp.spec) && !BUILTIN.has(imp.spec.split('/')[0]) && !/^[a-z]+:/.test(imp.spec) && !/^[#~@]\//.test(imp.spec)
          && !paqueteDeclarado(f, imp.spec, leer, existe)) {
          hallazgos.push(hallazgo('paquete-no-declarado', f, `importa el paquete «${imp.spec}», que no está en ningún package.json`, imp.linea));
        }
      }
    }
    aristas.set(f, destinos);
  }

  // Alcance: desde las entradas reales y, aparte, desde las pruebas.
  const alcanzar = (inicio) => {
    const visto = new Set();
    const pila = [...inicio];
    while (pila.length) {
      const f = pila.pop();
      if (visto.has(f)) continue;
      visto.add(f);
      for (const d of aristas.get(f) ?? []) pila.push(d);
    }
    return visto;
  };
  const pruebas = codigo.filter(esPrueba);
  const vivos = alcanzar([...ent.keys()].filter((f) => !esPrueba(f)));
  const dePruebas = alcanzar([...ent.keys()].filter(esPrueba).concat(pruebas));

  for (const f of codigo) {
    if (esPrueba(f) || vivos.has(f)) continue;
    if (dePruebas.has(f)) hallazgos.push(hallazgo('solo-pruebas', f, 'solo lo usan las pruebas: ningún código real lo importa ni lo ejecuta'));
    else hallazgos.push(hallazgo('codigo-muerto', f, 'nada lo importa, ejecuta ni documenta como comando'));
  }

  // Exportaciones sin uso en módulos vivos que no son entradas.
  for (const f of codigo) {
    if (PY.test(f) || esPrueba(f) || ent.has(f) || !vivos.has(f)) continue;
    const u = usos.get(f) ?? [];
    if (u.some((x) => x.nombres === '*')) continue;
    const usadosReal = new Set(u.filter((x) => !esPrueba(x.desde)).flatMap((x) => [...x.nombres]));
    const usadosPrueba = new Set(u.filter((x) => esPrueba(x.desde)).flatMap((x) => [...x.nombres]));
    const texto = leer(f) ?? '';
    for (const n of exportsDe(texto)) {
      if (usadosReal.has(n) || n === 'default') continue;
      // Si el propio módulo la usa, exportarla (p. ej. para probarla) no la vuelve código muerto.
      if ((texto.match(new RegExp(`(?<![\\w$])${n.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) ?? []).length > 1) continue;
      hallazgos.push(hallazgo('exportacion-sin-uso', f, usadosPrueba.has(n) ? `«${n}» solo lo usan las pruebas` : `«${n}» se exporta pero nadie lo usa`));
    }
  }

  // Marcadores de trabajo sin terminar y datos simulados (fuera de pruebas); pruebas con .only o desactivadas.
  for (const f of codigo) {
    const texto = leer(f) ?? '';
    const lineas = texto.split('\n');
    if (esPrueba(f)) {
      lineas.forEach((l, i) => {
        if (/\b(?:test|it|describe)\.only\s*\(|\{\s*only:\s*true/.test(l)) hallazgos.push(hallazgo('prueba-only', f, l.trim().slice(0, 100), i + 1));
        else if (/\b(?:test|it|describe)\.(?:skip|todo)\s*\(|\bx(?:it|describe|test)\s*\(|\{\s*(?:skip|todo):\s*(?:true|['"])|@pytest\.mark\.skip/.test(l)) hallazgos.push(hallazgo('prueba-desactivada', f, l.trim().slice(0, 100), i + 1));
      });
      continue;
    }
    if (/uraqi:\s*sin-marcadores/.test(lineas.slice(0, 6).join('\n'))) continue;
    lineas.forEach((l, i) => {
      if (/^\s*(?:\/\/|#|\*)?\s*(?:const|let|var)?\s*\w*\s*=?\s*\/.*\/[gimsuy]*[,;]?\s*$/.test(l)) return; // definición de expresiones regulares
      const m = l.match(MARCADOR);
      if (m) hallazgos.push(hallazgo('sin-terminar', f, m[0].trim().slice(0, 100), i + 1));
      const s = l.match(SIMULADO);
      if (s) hallazgos.push(hallazgo('datos-simulados', f, s[0], i + 1));
    });
  }

  const orden = { error: 0, aviso: 1 };
  hallazgos.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.tipo.localeCompare(b.tipo) || a.archivo.localeCompare(b.archivo) || (a.linea ?? 0) - (b.linea ?? 0));
  return { hallazgos, stats: { codigo: codigo.length, vivos: [...vivos].filter((f) => codigo.includes(f)).length, entradas: ent.size, pruebas: pruebas.length } };
}

/** Plan de solución: un paso por tipo de hallazgo, primero los errores. */
export function planDeSolucion(hallazgos) {
  const porTipo = new Map();
  for (const h of hallazgos) {
    if (!porTipo.has(h.tipo)) porTipo.set(h.tipo, []);
    porTipo.get(h.tipo).push(h);
  }
  const pasos = [];
  let n = 0;
  for (const [tipo, hs] of porTipo) {
    n += 1;
    const archivos = [...new Set(hs.map((h) => h.archivo))];
    pasos.push({ paso: n, tipo, nivel: hs[0].nivel, cuantos: hs.length, archivos, accion: PLANES[tipo] });
  }
  return pasos;
}

/** Informe en markdown con hallazgos y plan. */
export function informe({ hallazgos, stats }, { titulo = 'Código vivo', maxPorTipo = 15 } = {}) {
  const errores = hallazgos.filter((h) => h.nivel === 'error');
  const avisos = hallazgos.filter((h) => h.nivel === 'aviso');
  const out = [
    `### ${titulo} · ${errores.length ? `✘ ${errores.length} error(es)` : '✔ sin código roto ni muerto'}${avisos.length ? ` · ⚠ ${avisos.length} aviso(s)` : ''}`,
    '',
    `${stats.codigo} archivos de código, ${stats.vivos} conectados desde ${stats.entradas} entradas, ${stats.pruebas} de pruebas.`,
  ];
  const plan = planDeSolucion(hallazgos);
  if (plan.length) {
    out.push('', '**Plan de solución**');
    for (const p of plan) {
      const hs = hallazgos.filter((h) => h.tipo === p.tipo);
      out.push('', `${p.paso}. ${p.nivel === 'error' ? '✘' : '⚠'} **${p.tipo}** (${p.cuantos}): ${p.accion}`);
      for (const h of hs.slice(0, maxPorTipo)) out.push(`   - \`${h.archivo}${h.linea ? `:${h.linea}` : ''}\`: ${h.detalle}`);
      if (hs.length > maxPorTipo) out.push(`   - … y ${hs.length - maxPorTipo} más (npm run codigo:revisar).`);
    }
    out.push('', 'Abre un issue por paso (o uno para todo) y corrígelo en una rama desde dev antes de promover.');
  }
  return out.join('\n');
}
