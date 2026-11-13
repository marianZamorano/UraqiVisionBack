// Frontmatter YAML mínimo de skills y subagentes (claves simples y listas con "- "). Sin dependencias.
// Lo usan ai/sync.mjs y el generador del README (ai/docs/readme.mjs).

export function parseFrontmatter(text, file) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: falta el frontmatter`);
  const data = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(item[1].trim());
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    if (kv[2] === '') {
      listKey = kv[1];
      data[listKey] = [];
    } else {
      listKey = null;
      data[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
    }
  }
  for (const k of ['name', 'description']) if (!data[k]) throw new Error(`${file}: falta "${k}" en el frontmatter`);
  return { data, body: m[2].trim() };
}
