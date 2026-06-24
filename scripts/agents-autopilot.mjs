#!/usr/bin/env node
/**
 * Pythh agent autopilot — continuous optimization loop.
 *
 * Daily (metrics): heartbeat + conversion funnel + growth/product/research snapshots.
 * LLM agents rotate by UTC weekday (research Mon/Thu, growth Tue/Fri, product Wed/Sat/Sun)
 * unless --full is passed (runs all three).
 *
 * Usage:
 *   npm run agents:autopilot          # metrics + today's LLM agent
 *   npm run agents:autopilot -- --full  # metrics + all LLM agents
 *   npm run agents:autopilot -- --metrics-only
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

dotenv.config();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const METRICS_ONLY = process.argv.includes('--metrics-only');
const FULL = process.argv.includes('--full');

const ROTATION = {
  1: { agent: 'research', script: 'scripts/research-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
  2: { agent: 'growth', script: 'scripts/growth-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
  3: { agent: 'product', script: 'scripts/product-agent-loop.mjs', args: ['--max-turns=25', '--max-budget-usd=2.5'] },
  4: { agent: 'research', script: 'scripts/research-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
  5: { agent: 'growth', script: 'scripts/growth-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
  0: { agent: 'product', script: 'scripts/product-agent-loop.mjs', args: ['--max-turns=25', '--max-budget-usd=2.5'] },
  6: { agent: 'product', script: 'scripts/product-agent-loop.mjs', args: ['--max-turns=25', '--max-budget-usd=2.5'] },
};

function run(label, cmd, args = [], { allowFail = false } = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (r.status !== 0 && !allowFail) {
    console.error(`\n❌ ${label} failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
  return r.status === 0;
}

function runNode(label, script, args = [], opts = {}) {
  return run(label, process.execPath, [script, ...args], opts);
}

console.log('\n🎵 Pythh agent autopilot\n');

runNode('Funnel heartbeat', 'scripts/funnel-heartbeat-probe.mjs', ['--no-fail'], { allowFail: true });
runNode('Conversion funnel snapshot', 'scripts/conversion-funnel-snapshot.mjs');
runNode('Orchestrator brief', 'scripts/orchestrator-brief.mjs', [], { allowFail: true });
runNode('Product metrics', 'scripts/product-metrics-snapshot.mjs');
runNode('Growth metrics', 'scripts/growth-metrics-snapshot.mjs');
runNode('Research snapshot', 'scripts/research-snapshot.mjs', [], { allowFail: true });
run('Sync growth registry', 'npm', ['run', 'growth:sync-registry'], { allowFail: true });

if (METRICS_ONLY) {
  console.log('\n✅ Autopilot metrics complete (--metrics-only)\n');
  process.exit(0);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('\n⚠️  ANTHROPIC_API_KEY missing — skipping LLM agents\n');
  process.exit(0);
}

const utcDay = new Date().getUTCDay();
const today = ROTATION[utcDay];

const agentsToRun = FULL
  ? [
      { agent: 'research', script: 'scripts/research-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
      { agent: 'growth', script: 'scripts/growth-agent-loop.mjs', args: ['--max-turns=22', '--max-budget-usd=2'] },
      { agent: 'product', script: 'scripts/product-agent-loop.mjs', args: ['--max-turns=25', '--max-budget-usd=2.5'] },
    ]
  : [today];

console.log(`\n🤖 LLM agents: ${agentsToRun.map((a) => a.agent).join(', ')} (UTC day ${utcDay})\n`);

for (const a of agentsToRun) {
  runNode(`${a.agent} agent`, a.script, a.args, { allowFail: true });
}

console.log('\n✅ Pythh autopilot complete\n');
