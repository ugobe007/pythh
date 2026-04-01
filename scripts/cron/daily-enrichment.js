#!/usr/bin/env node
/**
 * DAILY ENRICHMENT PIPELINE — LLM Signal Pass (runs once per day)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Runs GPT-4o-mini signal classification on entities that don't yet have
 * LLM-enriched signals. Kept separate from signal-pipeline.js because:
 *   - Makes external API calls (OpenAI)
 *   - Costs ~$0.001 per entity
 *   - Slower (network latency per batch)
 *
 * Steps:
 *   1. LLM signal enrichment  enrich-signals-llm.js --apply --limit 100
 *                             URL-submitted startups processed first (--url-only
 *                             pass), then any remaining entities.
 *
 *   2. Sync signal scores     sync-signal-scores.js --apply
 *                             Ensures new LLM signals are reflected in
 *                             startup_signal_scores before scoring.
 *
 *   3. Recalculate scores     recalculate-scores.ts
 *                             Re-scores startups whose signals_bonus changed.
 *
 * Usage:
 *   node scripts/cron/daily-enrichment.js
 *
 * Schedule (PM2 ecosystem.config.js):
 *   cron_restart: '0 2 * * *'   # 2 AM daily — off-peak, before morning report
 *
 * Cost estimate at 100 entities/day: ~$0.10/day (~$3/month)
 */

'use strict';
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function run(cmd, args, label, { fatal = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: process.platform === 'win32',
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' },
    });
    child.on('error', (err) => {
      if (fatal) reject(err);
      else { console.warn(`  ⚠️  ${label} spawn error: ${err.message}`); resolve(1); }
    });
    child.on('close', (code) => {
      if (code === 0 || !fatal) resolve(code);
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

function section(n, label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${n}  ${label}`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('\n🧠  DAILY ENRICHMENT PIPELINE');
  console.log('═'.repeat(60));
  const start = Date.now();

  try {
    // ── 1a. LLM enrichment — URL-submitted startups first ────────────────────
    // These are the startups that real users submitted. They get priority.
    section('1️⃣ ', 'LLM signal enrichment — URL-submitted startups (priority pass)');
    await run(
      'node',
      ['scripts/enrich-signals-llm.js', '--apply', '--limit', '50', '--url-only'],
      'enrich-signals-llm (url-only)',
      { fatal: false }
    );

    // ── 1b. LLM enrichment — remaining entities ───────────────────────────────
    section('1️⃣ ', 'LLM signal enrichment — remaining entities');
    await run(
      'node',
      ['scripts/enrich-signals-llm.js', '--apply', '--limit', '50'],
      'enrich-signals-llm (all)',
      { fatal: false }
    );

    // ── 2. Sync signal scores ─────────────────────────────────────────────────
    section('2️⃣ ', 'Sync signal scores → startup_signal_scores');
    await run('node', ['scripts/sync-signal-scores.js', '--apply'], 'sync-signal-scores');

    // ── 3. Recalculate GOD scores ─────────────────────────────────────────────
    section('3️⃣ ', 'Recalculate GOD scores (picks up new signals_bonus)');
    await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 'recalculate-scores');

  } catch (err) {
    console.error('\n❌ Daily enrichment failed:', err.message);
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log(`✅  Daily enrichment complete in ${elapsed} min\n`);
}

main();
