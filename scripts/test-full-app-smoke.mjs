#!/usr/bin/env node
import { spawn } from 'node:child_process';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3002';
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS || 45_000);
let server = null;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reachable(path, timeoutMs = 1_500) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(path, label) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(path)) return;
    if (server?.exitCode != null) throw new Error(`Server exited before ${label} was ready (code ${server.exitCode})`);
    await delay(250);
  }
  throw new Error(`${label} did not become ready within ${startupTimeoutMs}ms`);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited ${code}`)));
  });
}

async function stopServer() {
  if (!server || server.exitCode != null) return;
  server.kill('SIGTERM');
  const stopped = await Promise.race([
    new Promise(resolve => server.once('exit', () => resolve(true))),
    delay(3_000).then(() => false),
  ]);
  if (!stopped && server.exitCode == null) server.kill('SIGKILL');
}

try {
  const serverAlreadyRunning = await reachable('/ping');
  const instantApiAlreadyReady = await reachable('/api/instant/health');
  if (!serverAlreadyRunning) {
    console.log('Starting local Pythh server for the full-app smoke suite…');
    server = spawn(process.execPath, ['server/index.js'], {
      stdio: 'inherit',
      env: { ...process.env, PYTHH_SMOKE_MODE: '1' },
    });
    await waitFor('/ping', 'server liveness');
  }
  if (!instantApiAlreadyReady) {
    await waitFor('/api/instant/health', 'instant-submit API');
  }

  await run(process.execPath, ['scripts/test-submit-flow.js']);
  await run(process.execPath, ['scripts/test-god-score-sync.js']);
  await run('npm', ['run', 'test:hot-god-contract']);
} finally {
  await stopServer();
}
