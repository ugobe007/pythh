#!/usr/bin/env node
/**
 * FULL DATA PIPELINE
 * ==================
 *
 * End-to-end automated workflow:
 *   0. CLEANUP   — Remove garbage startup names (optional)
 *   1. DISCOVER  — Scrape RSS, extract missing Series A/B, discover more
 *   2. IMPORT    — Move discovered → startup_uploads (gate validates)
 *   3. ENRICH    — Tiered enrichment (correct startups only)
 *   4. RECALC    — Recalculate GOD scores
 *   5. MATCH     — Generate investor matches
 *
 * Usage:
 *   node scripts/run-full-pipeline.js                 # Full run (cleanup dry-run only)
 *   node scripts/run-full-pipeline.js --cleanup-delete # Actually delete garbage
 *   node scripts/run-full-pipeline.js --quick      # Skip discovery (import → enrich → recalc → match)
 *   node scripts/run-full-pipeline.js --daemon     # Run continuously (every 2 hours)
 *
 * PM2 (cron every 6 hours):
 *   pm2 start scripts/run-full-pipeline.js --name full-pipeline --cron "0 0,6,12,18 * * *"
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const STEPS = [
  {
    id: 'cleanup',
    description: 'Garbage cleanup (dry-run or --delete)',
    script: 'scripts/cleanup-garbage.js',
    args: (argv) => argv.includes('--cleanup-delete') ? ['--delete'] : [],
    timeout: 5 * 60 * 1000,
  },
  {
    id: 'discovery',
    description: 'Discovery (RSS + extract + discover)',
    scripts: [
      { path: 'scripts/core/simple-rss-scraper.js', timeout: 15 * 60 * 1000 },
      { path: 'scripts/extract-missing-series-a-b-from-rss-pattern-based.js', timeout: 20 * 60 * 1000 },
      { path: 'scripts/discover-more-startups.js', timeout: 15 * 60 * 1000 },
    ],
    skip: (argv) => argv.includes('--quick'),
  },
  {
    id: 'import',
    description: 'Auto-import (discovered → startup_uploads)',
    script: 'scripts/core/auto-import-pipeline.js',
    timeout: 10 * 60 * 1000,
  },
  {
    id: 'enrich',
    description: 'Enrichment (tiered gating)',
    script: 'scripts/core/enrichment-orchestrator.js',
    args: ['--limit', '100'],
    timeout: 25 * 60 * 1000,
  },
  {
    id: 'recalc',
    description: 'Recalculate GOD scores',
    script: 'npx',
    args: ['tsx', 'scripts/recalculate-scores.ts'],
    timeout: 20 * 60 * 1000,
  },
  {
    id: 'populate-queue',
    description: 'Populate matching queue (startups needing matches)',
    script: 'scripts/core/populate-matching-queue.js',
    timeout: 5 * 60 * 1000,
  },
  {
    id: 'match',
    description: 'Match generation',
    script: 'scripts/core/queue-processor-v16.js',
    args: ['--run-once'],
    timeout: 45 * 60 * 1000,
  },
];

function log(emoji, msg, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${emoji} ${msg}`);
  if (data) console.log('     ', data);
}

function runCommand(script, args = [], timeout = 10 * 60 * 1000) {
  return new Promise((resolve) => {
    const isNpx = script === 'npx';
    const cmd = isNpx ? 'npx' : 'node';
    const cmdArgs = isNpx ? args : [path.join(PROJECT_ROOT, script), ...args];

    log('▶️', `Running: ${script} ${args.join(' ')}`);
    const proc = spawn(cmd, cmdArgs, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      log('❌', `Timeout after ${(timeout / 60000).toFixed(0)} min`);
      resolve({ ok: false, error: 'Timeout' });
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        log('✅', 'Completed');
        resolve({ ok: true });
      } else {
        log('❌', `Exit code ${code}`);
        resolve({ ok: false, error: `Exit ${code}` });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      log('❌', err.message);
      resolve({ ok: false, error: err.message });
    });
  });
}

async function runStep(step, argv) {
  if (step.skip && step.skip(argv)) {
    log('⏭️', `Skipped: ${step.description}`);
    return { ok: true, skipped: true };
  }

  if (step.scripts) {
    for (const s of step.scripts) {
      const result = await runCommand(s.path, [], s.timeout);
      if (!result.ok) log('⚠️', `${s.path} had issues (continuing)`);
    }
    return { ok: true };
  }

  const args = typeof step.args === 'function' ? step.args(argv) : (step.args || []);
  return runCommand(step.script, args, step.timeout);
}

async function runPipeline(argv) {
  console.log('\n' + '═'.repeat(70));
  console.log('  FULL DATA PIPELINE');
  console.log('═'.repeat(70) + '\n');

  const start = Date.now();
  const results = { ok: [], fail: [] };

  for (const step of STEPS) {
    console.log('\n' + '─'.repeat(50));
    log('📋', step.description);
    const r = await runStep(step, argv);
    (r.ok ? results.ok : results.fail).push(step.id);
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log('\n' + '═'.repeat(70));
  console.log(`  DONE in ${elapsed} min | OK: ${results.ok.length} | Failed: ${results.fail.length}`);
  console.log('═'.repeat(70) + '\n');

  return results.fail.length === 0;
}

async function runDaemon(argv) {
  const INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
  log('🔄', `Daemon mode: running every ${INTERVAL_MS / 3600000}h`);

  const run = async () => {
    await runPipeline(argv);
    setTimeout(run, INTERVAL_MS);
  };
  await run();
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--daemon')) {
    await runDaemon(argv);
    process.stdin.resume();
  } else {
    const ok = await runPipeline(argv);
    process.exit(ok ? 0 : 1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
