#!/usr/bin/env node
/**
 * SIGNAL PIPELINE — Full Enrichment Chain (runs every 4 hours)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Steps run in this order — each feeds the next:
 *
 *   1. RSS scrape          ssot-rss-scraper.js
 *                          Pulls feeds → parses frames → inserts events +
 *                          startup_uploads rows with initial GOD score.
 *
 *   2. RSS enrichment      enrich-from-rss-news.js
 *                          Fills web_signals, press_tier, reddit mentions,
 *                          extracted_data from news context.
 *
 *   3. Promote fields      promote-extracted-fields.js --apply
 *                          Moves stranded JSONB values (customer_count,
 *                          funding_amount, growth_rate, arr) to canonical
 *                          root columns so the scoring pipeline can read them.
 *
 *   4. Integrity check     data-integrity-check.js --fix
 *                          Validates and nulls implausible values that the
 *                          pattern extractor writes without context.
 *                          Runs after promotion so it catches promoted values.
 *
 *   5. Quality gate        quality-gate.js --execute
 *                          Rejects entries with score ≤ 40, no website, no
 *                          submitted_email, and thin text — RSS junk fragments.
 *
 *   6. Sync signal scores  sync-signal-scores.js --apply
 *                          Aggregates pythh_signal_events → startup_signal_scores
 *                          so signals_bonus is up to date for scoring.
 *
 *   7. Recalculate scores  recalculate-scores.ts   (via npx tsx)
 *                          Re-applies full GOD score stack with fresh signal
 *                          bonuses + pedigree + momentum. Only writes rows
 *                          where the computed score differs from stored score.
 *
 * See also: cron/daily-enrichment.js
 *   Runs LLM signal enrichment (GPT-4o-mini) once per day on new entities.
 *   Kept separate because it makes external API calls and costs ~$0.001/entity.
 *
 * Usage:
 *   node scripts/cron/signal-pipeline.js              # Full pipeline
 *   node scripts/cron/signal-pipeline.js --rss-only   # Step 1 only
 *   node scripts/cron/signal-pipeline.js --enrich-only # Steps 2-7 (skip RSS)
 *   node scripts/cron/signal-pipeline.js --score-only  # Steps 6-7 only
 *
 * Schedule (PM2 ecosystem.config.js or system cron):
 *   cron_restart: '0 */4 * * *'   # Every 4 hours
 */

'use strict';
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// ── Step runner ───────────────────────────────────────────────────────────────
// Returns a promise that resolves with the exit code.
// fatal=true → throw on non-zero; fatal=false → warn and continue.
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

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const rssOnly    = process.argv.includes('--rss-only');
  const enrichOnly = process.argv.includes('--enrich-only');
  const scoreOnly  = process.argv.includes('--score-only');

  console.log('\n🔄  SIGNAL PIPELINE');
  console.log('═'.repeat(60));
  const start = Date.now();

  try {
    // ── 1. RSS Scrape ─────────────────────────────────────────────────────────
    if (!enrichOnly && !scoreOnly) {
      section('1️⃣ ', 'RSS scrape → startup_events + startup_uploads');
      await run('npx', ['tsx', 'scripts/core/ssot-rss-scraper.js'], 'rss-scraper');
    }

    if (rssOnly) {
      console.log('\n✅ rss-only mode — stopping after step 1.\n');
      return;
    }

    // ── 2. RSS Enrichment ─────────────────────────────────────────────────────
    if (!scoreOnly) {
      section('2️⃣ ', 'Enrich from RSS news → web_signals, press_tier, extracted_data');
      await run('node', ['scripts/enrich-from-rss-news.js', '--all'], 'enrich-from-rss-news');
    }

    // ── 3. Promote extracted fields → canonical root columns ──────────────────
    if (!scoreOnly) {
      section('3️⃣ ', 'Promote JSONB fields → canonical columns (customer_count, arr_usd, etc.)');
      await run('node', ['scripts/promote-extracted-fields.js', '--apply'], 'promote-extracted-fields');
    }

    // ── 4. Data integrity check — catch & null corrupted values ───────────────
    section('4️⃣ ', 'Data integrity check + auto-fix (bounds validation)');
    await run('node', ['scripts/data-integrity-check.js', '--fix'], 'data-integrity-check',
      { fatal: false }); // non-fatal: issues logged but pipeline continues

    // ── 5. Quality gate — reject empty / junk RSS entries ────────────────────
    if (!scoreOnly) {
      section('5️⃣ ', 'Quality gate → reject junk entries (score≤40, no website, thin text)');
      await run('node', ['scripts/quality-gate.js', '--execute'], 'quality-gate');
    }

    // ── 6. Sync signal scores → startup_signal_scores ────────────────────────
    section('6️⃣ ', 'Sync signal scores → startup_signal_scores (feeds signals_bonus)');
    await run('node', ['scripts/sync-signal-scores.js', '--apply'], 'sync-signal-scores');

    // ── 7. Recalculate GOD scores ─────────────────────────────────────────────
    section('7️⃣ ', 'Recalculate GOD scores (all bonus layers — only writes changed rows)');
    await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 'recalculate-scores');

  } catch (err) {
    console.error('\n❌ Pipeline failed at step:', err.message);
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log(`✅  Pipeline complete in ${elapsed} min\n`);
}

main();
