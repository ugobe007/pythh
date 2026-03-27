#!/usr/bin/env node
'use strict';

/**
 * Post-deploy checks for core founder journey.
 *
 * Usage:
 *   APP_URL=https://hot-honey.fly.dev node scripts/post-deploy-health-check.js
 */

const base = (process.env.APP_URL || 'https://pythh.ai').replace(/\/$/, '');

const targets = [
  '/api/health',
  '/api/health/deep',
  '/',
  '/lookup',
  '/ai-ml-investors',
];

async function probe(path) {
  const started = Date.now();
  const url = `${base}${path}`;
  const res = await fetch(url, { method: 'GET' });
  const elapsed = Date.now() - started;
  return { path, status: res.status, ok: res.ok, elapsed };
}

async function main() {
  console.log(`Running post-deploy checks against ${base}`);
  const results = await Promise.all(targets.map(probe));
  let failed = 0;
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    if (!r.ok) failed += 1;
    console.log(`${mark} ${r.path} -> ${r.status} (${r.elapsed}ms)`);
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
