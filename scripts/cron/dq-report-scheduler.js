#!/usr/bin/env node
/**
 * Schedules the data-quality rollup (coverage, self-signals, ontology export, tagline dry-run)
 * without running heavy shell integrity jobs (same as dq:report:json / --quick).
 *
 * Usage:
 *   node scripts/cron/dq-report-scheduler.js              # Run once, write reports/dq-report-<ts>.json
 *   node scripts/cron/dq-report-scheduler.js --daemon     # Cron loop (default: weekly Sun 4am ET)
 *
 * Env:
 *   DQ_REPORT_SCHEDULE   — node-cron expression (default: 0 4 * * 0)
 *   DQ_REPORT_OUT_DIR    — default: reports
 *   BACKFILL_TAGLINE_APPLY — if "true", runs tagline backfill with --apply (not recommended for unattended)
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_SCRIPT = path.join(ROOT, 'scripts', 'data-quality-report.js');
const SCHEDULE = process.env.DQ_REPORT_SCHEDULE || '0 4 * * 0';
const OUT_DIR = process.env.DQ_REPORT_OUT_DIR
  ? path.resolve(process.env.DQ_REPORT_OUT_DIR)
  : path.join(ROOT, 'reports');
const TAGLINE_APPLY = String(process.env.BACKFILL_TAGLINE_APPLY || '').toLowerCase() === 'true';

function runReportOnce() {
  return new Promise((resolve, reject) => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = path.join(OUT_DIR, `dq-report-${ts}.json`);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const args = [REPORT_SCRIPT, '--json', '--quick'];
    if (TAGLINE_APPLY) args.push('--tagline-apply');

    const child = spawn(process.execPath, args, {
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
      if (code !== 0) {
        console.error(stderr.slice(-4000));
        reject(new Error(`data-quality-report exited ${code}`));
        return;
      }
      try {
        JSON.parse(stdout);
      } catch (e) {
        reject(new Error(`Invalid JSON from data-quality-report: ${e.message}`));
        return;
      }
      fs.writeFileSync(outPath, stdout, 'utf8');
      console.log(`[${new Date().toISOString()}] Wrote ${outPath}`);
      resolve(outPath);
    });
    child.on('error', reject);
  });
}

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  console.log('DQ report scheduler (daemon)');
  console.log('═'.repeat(60));
  console.log(`Schedule: ${SCHEDULE}`);
  console.log(`Output:   ${OUT_DIR}/`);
  console.log(`Tagline:  ${TAGLINE_APPLY ? 'APPLY (BACKFILL_TAGLINE_APPLY=true)' : 'dry-run only'}`);
  console.log('═'.repeat(60));

  runReportOnce().catch((e) => console.error('Initial run failed:', e.message));

  const job = cron.schedule(
    SCHEDULE,
    () => {
      runReportOnce().catch((e) => console.error('Scheduled run failed:', e.message));
    },
    { scheduled: true, timezone: process.env.DQ_REPORT_TZ || 'America/New_York' },
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
  runReportOnce()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
