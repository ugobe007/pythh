#!/usr/bin/env node
'use strict';

/**
 * Post-deploy checks for core founder journey.
 *
 * Usage:
 *   APP_URL=https://hot-honey.fly.dev node scripts/post-deploy-health-check.js
 *   APP_URL=https://pythh.ai SKIP_DEEP_HEALTH=1 node scripts/post-deploy-health-check.js
 *
 * Verify the same hostname users use (custom domain vs *.fly.dev). This script's fetch
 * must run in an environment that can reach the public internet (not all CI sandboxes can).
 */

const base = (process.env.APP_URL || 'https://pythh.ai').replace(/\/$/, '');
/** Per-request timeout so a stuck route cannot hang this script forever (Node fetch has no default timeout). */
const TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 20000);

const targets = [
  '/ping', // liveness only — no DB (see server/index.js)
  '/api/health',
  ...(process.env.SKIP_DEEP_HEALTH === '1' ? [] : ['/api/health/deep']),
  '/',
  '/lookup',
  '/ai-ml-investors',
];

async function probe(path) {
  const started = Date.now();
  const url = `${base}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    const elapsed = Date.now() - started;
    return { path, status: res.status, ok: res.ok, elapsed };
  } catch (err) {
    const elapsed = Date.now() - started;
    const name = err && err.name === 'AbortError' ? 'timeout' : err.message || String(err);
    return { path, status: 0, ok: false, elapsed, error: name };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`Running post-deploy checks against ${base}`);
  const results = await Promise.all(targets.map(probe));
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    if (!r.ok) failed += 1;
    const extra = r.error ? ` ${r.error}` : '';
    console.log(`${mark} ${r.path} -> ${r.status} (${r.elapsed}ms)${extra}`);
  }
  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} checks failed.`);
    return;
  }
  console.log('\nAll checks passed.');
}

main().catch((err) => {
  console.error('[post-deploy-health-check] failed:', err.message || err);
  process.exit(1);
});
