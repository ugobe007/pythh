#!/usr/bin/env node
/**
 * Daily agent ops — funnel heartbeat + metric snapshots (no LLM).
 *
 * Usage:
 *   npm run agents:daily
 *   npm run agents:daily -- --with-agents   # also run research + product loops
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WITH_AGENTS = process.argv.includes('--with-agents');

function run(label, script, args = [], { allowFail = false } = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0 && !allowFail) {
    console.error(`\n❌ ${label} failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
  return r.status === 0;
}

run('Funnel heartbeat probe', 'scripts/funnel-heartbeat-probe.mjs');
run('Product metrics snapshot', 'scripts/product-metrics-snapshot.mjs');
run('Growth metrics snapshot', 'scripts/growth-metrics-snapshot.mjs');
run('Research snapshot', 'scripts/research-snapshot.mjs', [], { allowFail: true });

if (WITH_AGENTS) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('\n⚠️  ANTHROPIC_API_KEY missing — skipping LLM agent loops');
  } else {
    run('Research agent loop', 'scripts/research-agent-loop.mjs', ['--max-turns=25', '--max-budget-usd=2']);
    run('Product agent loop', 'scripts/product-agent-loop.mjs', ['--max-turns=30', '--max-budget-usd=3']);
  }
}

console.log('\n✅ agents:daily complete\n');
