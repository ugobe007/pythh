#!/usr/bin/env node
/**
 * Schedules the data-quality runbook (SQL + enrichment + RSS filter sample) and writes JSON artifacts.
 *
 * Usage:
 *   node scripts/cron/dq-runbook-scheduler.js              # Run once → reports/dq-runbook-<ts>.json
 *   node scripts/cron/dq-runbook-scheduler.js --daemon   # Loop on cron (default: daily 6:10 AM ET)
 *
 * Env:
 *   DQ_RUNBOOK_SCHEDULE     — node-cron expression (default: 10 6 * * * = 6:10 daily)
 *   DQ_RUNBOOK_OUT_DIR      — default: reports
 *   DQ_RUNBOOK_TZ           — default: America/New_York
 *   DATABASE_URL            — required for SQL sections (Supabase direct Postgres URI)
 *   DQ_RUNBOOK_CHAIN_REPORT — if "1" or "true", also runs scripts/data-quality-report.js --json --quick
 *                             after the runbook (separate file dq-report-<ts>.json). Does NOT supply SQL;
 *                             DATABASE_URL is still required for sql_runbook sections.
 *
 * PM2: see ecosystem.config.js app `dq-runbook-scheduler`.
 * Fly.io: set DATABASE_URL (and Supabase keys for the Node helpers), then either add a PM2-style
 * process or use `fly ssh console` + cron, or GitHub Actions calling `npm run dq:runbook:cron`.
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const RUNBOOK_SCRIPT = path.join(ROOT, 'scripts', 'run-data-quality-runbook.js');
const DQ_REPORT_SCRIPT = path.join(ROOT, 'scripts', 'data-quality-report.js');

const SCHEDULE = process.env.DQ_RUNBOOK_SCHEDULE || '10 6 * * *';
const OUT_DIR = process.env.DQ_RUNBOOK_OUT_DIR
  ? path.resolve(process.env.DQ_RUNBOOK_OUT_DIR)
  : path.join(ROOT, 'reports');
const TZ = process.env.DQ_RUNBOOK_TZ || 'America/New_York';
const CHAIN_REPORT = ['1', 'true', 'yes'].includes(
  String(process.env.DQ_RUNBOOK_CHAIN_REPORT || '').toLowerCase(),
);

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
      if (code !== 0) {
        reject(new Error(`${path.basename(scriptPath)} exited ${code}: ${stderr.slice(-2000)}`));
        return;
      }
      resolve(stdout);
    });
    child.on('error', reject);
  });
}

async function runOnce() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
  console.log(
    `[dq-runbook-scheduler] DATABASE_URL/SUPABASE_DB_URL: ${hasDbUrl ? 'present' : 'MISSING (sql_runbook will be skipped)'}`,
  );

  const runbookPath = path.join(OUT_DIR, `dq-runbook-${ts}.json`);
  const runbookStdout = await runNodeCapture(RUNBOOK_SCRIPT, ['--json']);
  try {
    JSON.parse(runbookStdout);
  } catch (e) {
    throw new Error(`Invalid JSON from run-data-quality-runbook: ${e.message}`);
  }
  fs.writeFileSync(runbookPath, runbookStdout, 'utf8');
  console.log(`[${new Date().toISOString()}] Wrote ${runbookPath}`);

  if (CHAIN_REPORT) {
    const reportPath = path.join(OUT_DIR, `dq-report-${ts}.json`);
    const reportStdout = await runNodeCapture(DQ_REPORT_SCRIPT, ['--json', '--quick']);
    try {
      JSON.parse(reportStdout);
    } catch (e) {
      throw new Error(`Invalid JSON from data-quality-report: ${e.message}`);
    }
    fs.writeFileSync(reportPath, reportStdout, 'utf8');
    console.log(`[${new Date().toISOString()}] Wrote ${reportPath}`);
  }

  return runbookPath;
}

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  console.log('DQ runbook scheduler (daemon)');
  console.log('═'.repeat(60));
  console.log(`Schedule:   ${SCHEDULE}`);
  console.log(`Timezone:   ${TZ}`);
  console.log(`Output:     ${OUT_DIR}/`);
  console.log(`CHAIN_REPORT (dq-report --quick): ${CHAIN_REPORT ? 'on' : 'off'}`);
  console.log('═'.repeat(60));

  runOnce().catch((e) => console.error('Initial run failed:', e.message));

  const job = cron.schedule(
    SCHEDULE,
    () => {
      runOnce().catch((e) => console.error('Scheduled run failed:', e.message));
    },
    { scheduled: true, timezone: TZ },
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
  runOnce()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
