#!/usr/bin/env node
/**
 * Local wizard smoke — starts dev server on :3002 if needed, runs smoke tests, then stops it.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3002);
const HOST = '127.0.0.1';

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: HOST });
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function waitForPort(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise(async (resolve, reject) => {
    while (Date.now() - started < timeoutMs) {
      if (await portOpen(port)) {
        resolve();
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    reject(new Error(`Timed out waiting for ${HOST}:${port}`));
  });
}

let server = null;
let startedServer = false;

async function main() {
  if (!(await portOpen(PORT))) {
    console.log(`Starting dev server on ${HOST}:${PORT}…`);
    server = spawn('npx', ['tsx', 'server/index.js'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(PORT) },
    });
    startedServer = true;
    server.stdout?.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Listening')) process.stdout.write(s);
    });
    server.stderr?.on('data', (d) => process.stderr.write(d));
    await waitForPort(PORT);
    console.log('Dev server ready.\n');
  }

  const smoke = spawn(
    process.execPath,
    ['scripts/smoke-wizard-3act.mjs'],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, BASE: `http://${HOST}:${PORT}` },
    },
  );

  const code = await new Promise((resolve) => {
    smoke.on('close', resolve);
  });

  if (startedServer && server) {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    if (!server.killed) server.kill('SIGKILL');
  }

  process.exit(code ?? 1);
}

main().catch((err) => {
  console.error(err.message || err);
  if (server) server.kill('SIGTERM');
  process.exit(1);
});
