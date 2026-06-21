#!/usr/bin/env node
/**
 * Weekly pipeline runbook — dashboard + enrichment + investor intel + GOD audit.
 *
 * Usage:
 *   node scripts/pipeline-weekly-runbook.mjs
 *   node scripts/pipeline-weekly-runbook.mjs --apply
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, '..');

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ node ${script} ${args.join(' ')}\n`);
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
      cwd: repo,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} failed (${code})`))));
  });
}

async function main() {
  console.log('\n══════════════════════════════════════════');
  console.log('  WEEKLY PIPELINE RUNBOOK');
  console.log(`  ${APPLY ? 'APPLY' : 'report-only (pass --apply for writes)'}`);
  console.log('══════════════════════════════════════════');

  await run('pipeline-weekly-dashboard.mjs', ['--write']);

  await run('god-score-audit.js', APPLY ? ['--flag-junk', '--apply'] : []);

  if (APPLY) {
    await run('pipeline-priority-enrichment.mjs', ['--apply', '--limit=200']);
    await run('pipeline-investor-intelligence.mjs', ['--apply', '--limit=150']);
    console.log('\n💡 After investor backfill, run: node match-regenerator.js --full');
  } else {
    console.log('\n(skipping enrichment + investor backfill — pass --apply)');
  }

  await run('pipeline-weekly-dashboard.mjs', ['--write']);
  console.log('\n✅ Weekly runbook complete\n');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
