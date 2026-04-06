#!/usr/bin/env node
/**
 * Scheduled match-ML maintenance (not the GOD run-ml-training job).
 *
 * Default daily run:
 *   1. train-match-feedback-baseline.js --from-db (metrics + weights → JSON)
 *   2. train-match-feedback-baseline.js --drift-sample=N (GOD drift vs snapshot)
 *   3. Optional: backfill feature_snapshot for rows still NULL (--apply only if env set)
 *
 * Usage:
 *   node scripts/cron/ml-match-maintenance-scheduler.js              # Run once, write reports/
 *   node scripts/cron/ml-match-maintenance-scheduler.js --daemon    # Daily loop
 *
 * Env:
 *   ML_MATCH_SCHEDULE              — cron expression (default: 0 5 * * * = 5:00 daily)
 *   ML_MATCH_TZ                    — timezone (default: America/New_York)
 *   ML_MATCH_OUT_DIR               — default: reports
 *   ML_MATCH_TRAIN_LIMIT           — default: 8000
 *   ML_MATCH_DRIFT_SAMPLE          — default: 200; set 0 to skip drift
 *   MATCH_SNAPSHOT_BACKFILL_APPLY  — if "true", runs backfill with --apply (off by default)
 *   MATCH_SNAPSHOT_BACKFILL_LIMIT  — default: 300 (keep small for unattended runs)
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const TRAIN_SCRIPT = path.join(ROOT, 'scripts', 'train-match-feedback-baseline.js');
const BACKFILL_SCRIPT = path.join(ROOT, 'scripts', 'backfill-match-feature-snapshot.js');

const SCHEDULE = process.env.ML_MATCH_SCHEDULE || '0 5 * * *';
const OUT_DIR = process.env.ML_MATCH_OUT_DIR
  ? path.resolve(process.env.ML_MATCH_OUT_DIR)
  : path.join(ROOT, 'reports');
const TRAIN_LIMIT = Math.max(100, parseInt(process.env.ML_MATCH_TRAIN_LIMIT || '8000', 10) || 8000);
const DRIFT_SAMPLE = Math.max(0, parseInt(process.env.ML_MATCH_DRIFT_SAMPLE || '200', 10) || 0);
const BACKFILL_APPLY = String(process.env.MATCH_SNAPSHOT_BACKFILL_APPLY || '').toLowerCase() === 'true';
const BACKFILL_LIMIT = Math.max(1, parseInt(process.env.MATCH_SNAPSHOT_BACKFILL_LIMIT || '300', 10) || 300);

function runNodeCapture(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: ROOT,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => {
      stdout += c;
    });
    child.stderr.on('data', (c) => {
      stderr += c;
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    child.on('error', reject);
  });
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s.trim());
  } catch {
    return { parse_error: true, raw: s.slice(0, 2000) };
  }
}

async function runMaintenanceOnce() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const trainResult = await runNodeCapture(TRAIN_SCRIPT, ['--from-db', `--limit=${TRAIN_LIMIT}`]);
  const trainJson = safeJsonParse(trainResult.stdout);

  let driftJson = null;
  if (DRIFT_SAMPLE > 0) {
    const driftResult = await runNodeCapture(TRAIN_SCRIPT, [`--drift-sample=${DRIFT_SAMPLE}`]);
    driftJson = safeJsonParse(driftResult.stdout);
    if (driftResult.code !== 0) {
      driftJson = { error: true, stderr: driftResult.stderr.slice(-4000) };
    }
  } else {
    driftJson = { skipped: true, reason: 'ML_MATCH_DRIFT_SAMPLE=0' };
  }

  let backfillSection = { skipped: true, reason: 'MATCH_SNAPSHOT_BACKFILL_APPLY not true' };
  if (BACKFILL_APPLY) {
    const bf = await runNodeCapture(BACKFILL_SCRIPT, ['--apply', `--limit=${BACKFILL_LIMIT}`]);
    backfillSection = {
      exit_code: bf.code,
      stderr_tail: bf.stderr.slice(-6000),
      note: 'Approximate snapshots from current startup/investor rows',
    };
  }

  const outPath = path.join(OUT_DIR, `ml-match-maintenance-${ts}.json`);
  const payload = {
    generated_at: new Date().toISOString(),
    train_exit_code: trainResult.code,
    train_stderr_tail: trainResult.stderr.slice(-2000),
    train: trainJson,
    drift: driftJson,
    backfill: backfillSection,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[${new Date().toISOString()}] Wrote ${outPath}`);
  if (trainResult.code !== 0) {
    throw new Error(`train-match-feedback-baseline exited ${trainResult.code}`);
  }
  return outPath;
}

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  console.log('ML match maintenance scheduler');
  console.log('═'.repeat(60));
  console.log(`Schedule:     ${SCHEDULE}`);
  console.log(`Output:       ${OUT_DIR}/ml-match-maintenance-*.json`);
  console.log(`Train limit:  ${TRAIN_LIMIT}`);
  console.log(`Drift sample: ${DRIFT_SAMPLE || 'off'}`);
  console.log(`Backfill:     ${BACKFILL_APPLY ? `APPLY limit ${BACKFILL_LIMIT}` : 'skipped (set MATCH_SNAPSHOT_BACKFILL_APPLY=true to enable)'}`);
  console.log('═'.repeat(60));

  runMaintenanceOnce().catch((e) => console.error('Initial run failed:', e.message));

  const job = cron.schedule(
    SCHEDULE,
    () => {
      runMaintenanceOnce().catch((e) => console.error('Scheduled run failed:', e.message));
    },
    { scheduled: true, timezone: process.env.ML_MATCH_TZ || 'America/New_York' },
  );

  process.on('SIGINT', () => {
    job.stop();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    job.stop();
    process.exit(0);
  });
} else {
  runMaintenanceOnce()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
