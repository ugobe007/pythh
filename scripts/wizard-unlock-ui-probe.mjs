#!/usr/bin/env node
/**
 * CLI wrapper for wizard unlock UI probe (Playwright headless).
 *
 * Usage:
 *   npm run test:wizard-e2e
 *   BASE=https://pythh.ai npm run test:wizard-e2e
 *   node scripts/wizard-unlock-ui-probe.mjs --no-fail
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWizardUnlockProbe } from './lib/wizardUnlockProbe.mjs';

const NO_FAIL = process.argv.includes('--no-fail');
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = path.join(repoRoot, 'reports');
const probeRunId = process.env.PROBE_RUN_ID || crypto.randomUUID();
const MAX_RETRIES = Math.max(1, Number(process.env.WIZARD_E2E_RETRIES || 1));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n🎭 Wizard unlock UI probe → ${process.env.BASE || 'https://pythh.ai'}`);
  console.log(`   probe_run_id=${probeRunId}`);
  if (MAX_RETRIES > 1) console.log(`   retries=${MAX_RETRIES}\n`);
  else console.log('');

  let result = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1) {
      const waitMs = 5000 * attempt;
      console.log(`\n↻ Retry ${attempt}/${MAX_RETRIES} in ${waitMs / 1000}s…`);
      await sleep(waitMs);
    }

    result = await runWizardUnlockProbe({ probeRunId, headless: true });

    for (const s of result.steps) {
      const icon = s.ok === false ? '❌' : '✅';
      console.log(`   ${icon} ${s.step}${s.detail ? `: ${s.detail}` : ''}${s.card_title ? `: ${s.card_title}` : ''}`);
    }

    if (result.ok) break;
    if (attempt < MAX_RETRIES) {
      console.log(`   ⚠️  Attempt ${attempt} failed: ${result.error || 'unknown'}`);
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    probe_run_id: probeRunId,
    attempts: MAX_RETRIES,
    ...result,
  };

  fs.mkdirSync(reportsDir, { recursive: true });
  const outFile = path.join(reportsDir, `wizard-unlock-e2e-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n📁 ${outFile}`);

  if (!result?.ok) {
    console.error(`\n❌ Wizard unlock probe failed: ${result?.error || 'unknown'}\n`);
    if (!NO_FAIL) process.exit(1);
  } else {
    console.log('\n✅ Wizard unlock funnel OK\n');
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
