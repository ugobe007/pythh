#!/usr/bin/env node
/**
 * Pythh bench suite — runs existing health / audit scripts in sequence for regression
 * and improvement tracking. Exit code 1 if any step fails.
 *
 * Usage:
 *   node scripts/pythh-bench-suite.js
 *   node scripts/pythh-bench-suite.js --http   # also run prod-health (needs network)
 *
 * Env:
 *   PROD_HEALTH_API_BASE — passed through for prod-health when using --http
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wantHttp = process.argv.includes('--http');

const steps = [
  { name: 'preflight-check', args: ['scripts/preflight-check.js'] },
  { name: 'pipeline-audit (db only)', args: ['scripts/pipeline-audit-report.js', '--no-api'] },
  { name: 'enrich-health-check', args: ['scripts/enrich-health-check.js'] },
];

if (wantHttp) {
  steps.push({ name: 'prod-health', args: ['scripts/prod-health.js'] });
}

function runNode(scriptArgs) {
  return spawnSync(process.execPath, scriptArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  PYTHH BENCH SUITE');
console.log(`  ${new Date().toISOString()}  ·  cwd: ${root}`);
console.log(`  steps: ${steps.map((s) => s.name).join(' → ')}`);
console.log('═══════════════════════════════════════════════════════════════\n');

const started = Date.now();
let failed = null;

for (const step of steps) {
  console.log(`▶ ${step.name}…`);
  const r = runNode(step.args);
  if (r.status !== 0) {
    failed = { step: step.name, code: r.status ?? 1 };
    break;
  }
  console.log(`  ✓ ${step.name} (${((Date.now() - started) / 1000).toFixed(1)}s total elapsed)\n`);
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log('═══════════════════════════════════════════════════════════════');
if (failed) {
  console.log(`  FAIL: ${failed.step} (exit ${failed.code})`);
  console.log(`  Elapsed: ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  process.exit(1);
}
console.log(`  PASS  ·  ${elapsed}s`);
console.log('  Tip: add --http to include prod-health against PROD_HEALTH_API_BASE.');
console.log('  Tip: npm run contract:submit -- <url>  — discovery vs instant same startup_id.');
console.log('  Tip: SCORE_RECALC_* and pipeline:audit for deeper data ops separately.');
console.log('═══════════════════════════════════════════════════════════════\n');
