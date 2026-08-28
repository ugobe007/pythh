#!/usr/bin/env node
/**
 * Resolution Loop Agent — orchestrates npm/terminal ops until the qualified+url
 * startup cohort reaches the resolved target (default 5000).
 *
 * Match engine runs automatically on URL submit; this agent drains search queue,
 * rematches missing funders, and periodically runs investor/participant hygiene.
 *
 * Usage:
 *   npm run outcomes:resolution-loop -- --apply --limit=100 --max-waves=20
 *   npm run outcomes:resolution-loop -- --apply --limit=100        # until target
 *   npm run outcomes:resolution-loop -- --dry-run --max-waves=1    # preview one wave
 *
 * Each wave runs steps separately (AGENTS.md Wave 2 guidance — no monolithic paste).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fetchCohortProgress, RESOLUTION_TARGET } from '../lib/cohortProgress.mjs';

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dryRun = argv.includes('--dry-run') || (!apply && !argv.includes('--apply'));
const target = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--target='))?.split('=')[1] || RESOLUTION_TARGET),
);
const limit = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 100),
);
const maxWaves = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--max-waves='))?.split('=')[1] || 9999),
);
const stallWaves = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--stall-waves='))?.split('=')[1] || 3),
);
const delay = Math.max(
  0,
  Number(argv.find((a) => a.startsWith('--delay='))?.split('=')[1] || 400),
);
const waveDelayMs = Math.max(
  0,
  Number(argv.find((a) => a.startsWith('--wave-delay='))?.split('=')[1] || 2000),
);
const investorWaveEvery = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--investor-wave-every='))?.split('=')[1] || 3),
);
const hit5WaveEvery = Math.max(
  0,
  Number(argv.find((a) => a.startsWith('--hit5-wave-every='))?.split('=')[1] || 5),
);
const coreOnly = argv.includes('--core-only');
const stepTimeoutMs = Math.max(
  30_000,
  Number(argv.find((a) => a.startsWith('--step-timeout-ms='))?.split('=')[1] || 45 * 60 * 1000),
);

const SITE_ORIGIN = (
  process.env.APP_URL ||
  process.env.APP_BASE_URL ||
  process.env.PUBLIC_SITE_URL ||
  'https://pythh.ai'
).replace(/\/$/, '');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonStdout(stdout) {
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return null;
  const lastBrace = trimmed.lastIndexOf('{');
  if (lastBrace < 0) return null;
  try {
    return JSON.parse(trimmed.slice(lastBrace));
  } catch {
    return null;
  }
}

/**
 * @param {string} label
 * @param {string} scriptPath
 * @param {string[]} extraArgs
 * @param {{ allowFail?: boolean, timeoutMs?: number }} [opts]
 */
function runNodeScript(label, scriptPath, extraArgs = [], opts = {}) {
  const { allowFail = false, timeoutMs = stepTimeoutMs } = opts;
  const args = [scriptPath, ...extraArgs];

  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${label}`);
    console.log(`  node ${scriptPath} ${extraArgs.join(' ')}`.trim());

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
          setTimeout(() => child.kill('SIGKILL'), 5000);
        }, timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      const result = {
        label,
        scriptPath,
        args: extraArgs,
        exitCode: code ?? 1,
        stdout,
        stderr: stderr.slice(0, 2000),
        timedOut,
        json: parseJsonStdout(stdout),
      };
      if (timedOut) {
        if (allowFail) {
          resolve({ ...result, exitCode: 124, error: 'timeout' });
          return;
        }
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        return;
      }
      if (code !== 0 && !allowFail) {
        reject(new Error(`${label} exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      resolve(result);
    });
  });
}

async function runNpmScript(label, scriptName, extraArgs = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const npmArgs = ['run', scriptName, '--', ...extraArgs];
    console.log(`\n▶ ${label}`);
    console.log(`  npm ${npmArgs.join(' ')}`);

    const child = spawn('npm', npmArgs, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      const result = {
        label,
        scriptName,
        args: extraArgs,
        exitCode: code ?? 1,
        stdout,
        stderr: stderr.slice(0, 2000),
        json: parseJsonStdout(stdout),
      };
      if (code !== 0 && !opts.allowFail) {
        reject(new Error(`${label} exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      resolve(result);
    });
  });
}

async function runCoreWave(waveNumber) {
  const applyArgs = apply ? ['--apply'] : [];
  const steps = [];

  steps.push(
    await runNodeScript(
      `[wave ${waveNumber}] release stuck search queue`,
      'scripts/release-stuck-funding-search-queue.mjs',
      [...applyArgs],
      { allowFail: true, timeoutMs: 120_000 },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] match outcome agent (recover → triage → search → promote)`,
      'outcomes:agent',
      [...applyArgs, `--limit=${limit}`, `--delay=${delay}`],
      { allowFail: false },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] rematch missing funding participants`,
      apply ? 'funding:rematch:missing-participants:apply' : 'funding:rematch:missing-participants',
      [`--limit=${limit}`],
      { allowFail: true },
    ),
  );

  return steps;
}

async function runInvestorHygieneWave(waveNumber) {
  const applyArgs = apply ? ['--apply'] : [];
  const steps = [];

  steps.push(
    await runNodeScript(
      `[wave ${waveNumber}] seed missing investor profiles`,
      'scripts/seed-missing-funding-investor-profiles.mjs',
      [...applyArgs],
      { allowFail: true, timeoutMs: 20 * 60 * 1000 },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] seed indeterminate participant rosters`,
      'funding:participants:seed-indeterminate',
      [...applyArgs],
      { allowFail: true },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] resolve investor coverage`,
      apply ? 'funding:coverage:investors:resolve:apply' : 'funding:coverage:investors:resolve',
      [],
      { allowFail: true },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] repair organization links`,
      apply ? 'funding:repair:organization-links:apply' : 'funding:repair:organization-links',
      [],
      { allowFail: true },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] enrich prediction-linked participants`,
      'funding:participants:prediction-linked',
      [...applyArgs, `--limit=${limit}`],
      { allowFail: true },
    ),
  );

  return steps;
}

async function runHit5Wave(waveNumber) {
  const applyArgs = apply ? ['--apply'] : [];
  const steps = [];

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] ingest audited funding events`,
      'funding:ingest:audited:apply',
      [],
      { allowFail: true },
    ),
  );

  steps.push(
    await runNodeScript(
      `[wave ${waveNumber}] corroborate funding evidence rounds`,
      'scripts/corroborate-funding-evidence-rounds.mjs',
      [...applyArgs],
      { allowFail: true, timeoutMs: 20 * 60 * 1000 },
    ),
  );

  steps.push(
    await runNpmScript(
      `[wave ${waveNumber}] match-funding audit`,
      'funding:match-funding-audit',
      [],
      { allowFail: true },
    ),
  );

  return steps;
}

function shouldStop(progress, wavesRun, lastResolvedCounts, opts = {}) {
  const targetN = opts.target ?? RESOLUTION_TARGET;
  const maxWavesN = opts.maxWaves ?? 9999;
  const stallWavesN = opts.stallWaves ?? 3;

  if (!progress) return { stop: false, reason: null };
  if (progress.resolved_count >= targetN) {
    return { stop: true, reason: 'target_reached' };
  }
  if (wavesRun >= maxWavesN) {
    return { stop: true, reason: 'max_waves' };
  }
  if (lastResolvedCounts.length >= stallWavesN) {
    const recent = lastResolvedCounts.slice(-stallWavesN);
    const delta = recent[recent.length - 1] - recent[0];
    if (delta <= 0) {
      return { stop: true, reason: 'stalled' };
    }
  }
  return { stop: false, reason: null };
}

async function main() {
  const startedAt = new Date().toISOString();
  const report = {
    agent: 'resolution-loop',
    started_at: startedAt,
    mode: apply ? 'apply' : dryRun ? 'dry-run' : 'preview',
    target,
    limit,
    max_waves: maxWaves,
    stall_waves: stallWaves,
    investor_wave_every: investorWaveEvery,
    hit5_wave_every: hit5WaveEvery,
    waves: [],
    review_url: `${SITE_ORIGIN}/admin/match-outcomes`,
  };

  console.log('\n🔄 Resolution Loop Agent');
  console.log(`   target=${target} limit=${limit} max_waves=${maxWaves} mode=${report.mode}\n`);

  if (dryRun && !apply) {
    console.log('Dry-run: one preview wave without --apply on mutating steps.\n');
  }

  const progressBefore = await fetchCohortProgress({ target });
  report.progress_before = progressBefore;

  const lastResolvedCounts = progressBefore ? [progressBefore.resolved_count] : [];
  let wavesRun = 0;
  const effectiveMaxWaves = dryRun && !apply ? 1 : maxWaves;

  while (true) {
    wavesRun += 1;
    const waveStartedAt = new Date().toISOString();
    const progressStart = await fetchCohortProgress({ target });
    const waveReport = {
      wave: wavesRun,
      started_at: waveStartedAt,
      progress_start: progressStart,
      steps: [],
    };

    console.log(`\n${'='.repeat(72)}\nWAVE ${wavesRun} — resolved ${progressStart?.resolved_count ?? '?'}/${target}\n${'='.repeat(72)}`);

    try {
      waveReport.steps.push(...(await runCoreWave(wavesRun)));

      if (!coreOnly && (wavesRun === 1 || wavesRun % investorWaveEvery === 0)) {
        waveReport.steps.push(...(await runInvestorHygieneWave(wavesRun)));
      }

      if (!coreOnly && hit5WaveEvery > 0 && (wavesRun === 1 || wavesRun % hit5WaveEvery === 0)) {
        waveReport.steps.push(...(await runHit5Wave(wavesRun)));
      }
    } catch (err) {
      waveReport.error = String(err?.message || err);
      report.waves.push(waveReport);
      report.progress_after = await fetchCohortProgress({ target });
      report.stopped_reason = 'step_failed';
      break;
    }

    const progressEnd = await fetchCohortProgress({ target });
    waveReport.progress_end = progressEnd;
    waveReport.delta_resolved = progressEnd && progressStart
      ? progressEnd.resolved_count - progressStart.resolved_count
      : null;
    waveReport.finished_at = new Date().toISOString();
    report.waves.push(waveReport);

    if (progressEnd) {
      lastResolvedCounts.push(progressEnd.resolved_count);
      if (lastResolvedCounts.length > stallWaves + 1) lastResolvedCounts.shift();
    }

    const { stop, reason } = shouldStop(progressEnd, wavesRun, lastResolvedCounts, {
      target,
      maxWaves: effectiveMaxWaves,
      stallWaves,
    });
    if (stop) {
      report.stopped_reason = reason;
      report.progress_after = progressEnd;
      break;
    }

    if (waveDelayMs > 0) {
      console.log(`\n⏳ wave delay ${waveDelayMs}ms…`);
      await sleep(waveDelayMs);
    }
  }

  report.finished_at = new Date().toISOString();
  report.progress_after = report.progress_after || await fetchCohortProgress({ target });
  report.waves_run = wavesRun;

  fs.mkdirSync(path.join(process.cwd(), 'reports'), { recursive: true });
  const reportPath = path.join(
    process.cwd(),
    'reports',
    `resolution-loop-${startedAt.replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log('\n' + JSON.stringify({
    agent: report.agent,
    mode: report.mode,
    stopped_reason: report.stopped_reason,
    waves_run: report.waves_run,
    progress: report.progress_after,
    report_path: reportPath,
    review_url: report.review_url,
  }, null, 2));

  if (report.stopped_reason === 'step_failed') {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
