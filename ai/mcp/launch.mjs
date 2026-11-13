#!/usr/bin/env node
// Lanzador multiplataforma de los servidores MCP (Claude Code, Gemini CLI, Codex CLI y opencode).
//   node ai/mcp/launch.mjs context7
// - Ejecuta npx con el Node actual y sin shell: en Windows evita npx.cmd y problemas de comillas.
// - Versiones fijadas: actualizar aquí solo tras revisar el changelog del paquete.
// - stdio se hereda: el proceso hijo habla MCP directamente con el cliente.
// Adaptado de frontend/mcp/launch.mjs del repositorio chapterCoreIEEE.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SERVERS = {
  context7: { pkg: '@upstash/context7-mcp@4.4.4', args: () => [] },
};

function npxCommand() {
  const bin = dirname(process.execPath);
  const candidates = [
    join(bin, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  const cli = candidates.find((c) => existsSync(c));
  if (cli) return { cmd: process.execPath, pre: [cli] };
  if (process.platform === 'win32') throw new Error('No se encontró npx-cli.js junto a node.exe. Reinstala Node.js con npm.');
  return { cmd: 'npx', pre: [] };
}

const name = process.argv[2];
const server = SERVERS[name];
if (!server) {
  process.stderr.write(`Uso: node ai/mcp/launch.mjs <${Object.keys(SERVERS).join('|')}>\n`);
  process.exit(2);
}
try {
  const { cmd, pre } = npxCommand();
  const child = spawn(cmd, [...pre, '-y', server.pkg, ...server.args()], { stdio: 'inherit', shell: false, env: process.env });
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
  child.on('error', (err) => {
    process.stderr.write(`[ai/mcp] ${name}: ${err.message}\n`);
    process.exit(1);
  });
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
} catch (err) {
  process.stderr.write(`[ai/mcp] ${err.message}\n`);
  process.exit(1);
}
