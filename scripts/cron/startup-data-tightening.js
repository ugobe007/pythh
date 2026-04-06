#!/usr/bin/env node
/**
 * STARTUP DATA TIGHTENING — accuracy-first, production-scale batch
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Goal: improve GOD + signal scoring inputs by (1) removing invalid entities,
 * (2) promoting stranded JSON to canonical columns, (3) press/RSS enrichment,
 * (4) integrity + quality gates, (5) syncing signals and recalculating scores,
 * (6) optional website/news inference for sparse profiles.
 *
 * Typical use (full RSS coverage + 100 sparse inferences with news):
 *   node scripts/cron/startup-data-tightening.js
 *
 * Large batch (sparse only, HTML for throughput):
 *   node scripts/cron/startup-data-tightening.js --sparse-html-only --sparse-limit=300
 *
 * Skip expensive steps:
 *   node scripts/cron/startup-data-tightening.js --skip-garbage --skip-rss --sparse-limit=0
 *
 * Metric signals (after promote — ARR/MRR/funding → pythh_signal_events):
 *   Included by default: node scripts/ingest-metrics-signals.js --apply
 *   Skip: --skip-metrics-signals
 *
 * Optional rollup (stdout / JSON for monitoring):
 *   --skip-dq-report   (default: run scripts/data-quality-report.js at end)
 */

'use strict';

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const { getResolved: getInferencePipelineConfig } = require('../../lib/inferencePipelineConfig');

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
      else {
        console.warn(`  ⚠️  ${label} spawn error: ${err.message}`);
        resolve(1);
      }
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

function parseArgs(argv) {
  const skipGarbage = argv.includes('--skip-garbage');
  const skipPromote = argv.includes('--skip-promote');
  const skipMetricsSignals = argv.includes('--skip-metrics-signals');
  const skipRss = argv.includes('--skip-rss');
  const skipSparse = argv.includes('--skip-sparse');
  const sparseHtmlOnly = argv.includes('--sparse-html-only');

  const rssAll = !argv.includes('--rss-capped');
  const rssLimitArg = argv.find((a) => a.startsWith('--rss-limit='));
  const rssLimit = rssLimitArg ? parseInt(rssLimitArg.split('=')[1], 10) : null;

  const promoteLimitArg = argv.find((a) => a.startsWith('--promote-limit='));
  const promoteLimit = promoteLimitArg ? parseInt(promoteLimitArg.split('=')[1], 10) : null;

  const sparseLimitArg = argv.find((a) => a.startsWith('--sparse-limit='));
  let sparseLimit = getInferencePipelineConfig().STARTUP_TIGHTEN_SPARSE_DEFAULT;
  if (sparseLimitArg) {
    const v = parseInt(sparseLimitArg.split('=')[1], 10);
    sparseLimit = Number.isFinite(v) ? v : getInferencePipelineConfig().STARTUP_TIGHTEN_SPARSE_DEFAULT;
  }

  const skipDqReport = argv.includes('--skip-dq-report');

  return {
    skipGarbage,
    skipPromote,
    skipMetricsSignals,
    skipRss,
    skipSparse,
    sparseHtmlOnly,
    rssAll,
    rssLimit,
    promoteLimit,
    sparseLimit,
    skipDqReport,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log('\n🎯  STARTUP DATA TIGHTENING');
  console.log('═'.repeat(60));
  console.log(`  Metrics signals: ${opts.skipPromote || opts.skipMetricsSignals ? 'skipped' : 'ingest-metrics-signals --apply'}`);
  console.log(`  RSS: ${opts.skipRss ? 'skipped' : opts.rssAll ? 'enrich-from-rss-news --all' : `enrich-from-rss-news --limit ${opts.rssLimit || 2000}`}`);
  console.log(`  Sparse inference: ${opts.skipSparse ? 'skipped' : `enrich-sparse-startups --limit=${opts.sparseLimit}${opts.sparseHtmlOnly ? ' --html-only' : ''}`}`);
  console.log(`  DQ rollup: ${opts.skipDqReport ? 'skipped (--skip-dq-report)' : 'data-quality-report.js --json --quick'}`);
  const start = Date.now();

  try {
    if (!opts.skipGarbage) {
      section('1️⃣ ', 'Reject invalid approved names (cleanup-garbage --reject)');
      await run('node', ['scripts/cleanup-garbage.js', '--reject'], 'cleanup-garbage');
    }

    if (!opts.skipPromote) {
      section('2️⃣ ', 'Promote JSONB → canonical columns (promote-extracted-fields)');
      const promoteArgs = ['scripts/promote-extracted-fields.js', '--apply'];
      if (opts.promoteLimit && opts.promoteLimit > 0) {
        promoteArgs.push(`--limit=${opts.promoteLimit}`);
      }
      await run('node', promoteArgs, 'promote-extracted-fields');
    }

    if (!opts.skipPromote && !opts.skipMetricsSignals) {
      section('2️⃣b ', 'Metric-derived signals (ARR/MRR/funding → pythh_signal_events)');
      await run('node', ['scripts/ingest-metrics-signals.js', '--apply'], 'ingest-metrics-signals', {
        fatal: false,
      });
    }

    if (!opts.skipRss) {
      section('3️⃣ ', 'Enrich from RSS news (press, funding, extracted_data)');
      const rssArgs = ['scripts/enrich-from-rss-news.js'];
      if (opts.rssAll) rssArgs.push('--all');
      else rssArgs.push('--limit', String(opts.rssLimit || 2000));
      await run('node', rssArgs, 'enrich-from-rss-news');

      section('4️⃣ ', 'Data integrity check + auto-fix');
      await run('node', ['scripts/data-integrity-check.js', '--fix'], 'data-integrity-check', { fatal: false });

      section('5️⃣ ', 'Quality gate (reject thin RSS junk)');
      await run('node', ['scripts/quality-gate.js', '--execute'], 'quality-gate', { fatal: false });
    }

    section(opts.skipRss ? '3️⃣ ' : '6️⃣ ', 'Sync signal scores → startup_signal_scores');
    await run('node', ['scripts/sync-signal-scores.js', '--apply'], 'sync-signal-scores');

    section(opts.skipRss ? '4️⃣ ' : '7️⃣ ', 'Recalculate GOD scores');
    await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 'recalculate-scores');

    if (!opts.skipSparse && opts.sparseLimit > 0) {
      section(opts.skipRss ? '5️⃣ ' : '8️⃣ ', 'Sparse startup enrichment (website + optional news)');
      const sparseArgs = ['scripts/enrich-sparse-startups.js', `--limit=${opts.sparseLimit}`];
      if (opts.sparseHtmlOnly) sparseArgs.push('--html-only');
      await run('node', sparseArgs, 'enrich-sparse-startups', { fatal: false });

      section('9️⃣ ', 'Recalculate GOD scores (after sparse writes)');
      await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 'recalculate-scores');
    }
  } catch (err) {
    console.error('\n❌ Startup data tightening failed:', err.message);
    process.exit(1);
  }

  if (!opts.skipDqReport) {
    section('🔟 ', 'Data quality report (rollup — non-fatal)');
    await run('node', ['scripts/data-quality-report.js', '--json', '--quick'], 'data-quality-report', {
      fatal: false,
    });
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log('\n' + '═'.repeat(60));
  console.log(`✅  Startup data tightening complete in ${elapsed} min\n`);
}

main();
