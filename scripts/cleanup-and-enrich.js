#!/usr/bin/env node
/**
 * CLEANUP & ENRICH — Database hygiene + sparse data enrichment
 * ============================================================
 *
 * Orchestrates:
 *   1. CLEANUP STARTUPS  — Remove garbage startup names (headlines, junk)
 *   2. CLEANUP INVESTORS — Remove garbage investor records
 *   3. ENRICH STARTUPS   — Fill sparse startup profiles via inference
 *   4. ENRICH INVESTORS  — Fill sparse investor profiles via news inference
 *   5. RECALC            — Recalculate GOD scores for startups
 *
 * Usage:
 *   node scripts/cleanup-and-enrich.js
 *     → Dry-run cleanup, then enrich startups+investors, then recalc
 *
 *   node scripts/cleanup-and-enrich.js --cleanup-delete
 *     → Actually delete garbage (startups + investors), then enrich, then recalc
 *
 *   node scripts/cleanup-and-enrich.js --enrich-only
 *     → Skip cleanup, run enrichment + recalc only
 *
 *   node scripts/cleanup-and-enrich.js --cleanup-only
 *     → Run cleanup only (dry-run or --cleanup-delete)
 *
 *   node scripts/cleanup-and-enrich.js --recalc-only
 *     → Run recalc only (after manual enrichment)
 *
 *   node scripts/cleanup-and-enrich.js --limit=50
 *     → Limit startup enrichment to 50 per chunk (default 200 for run-all)
 *
 *   node scripts/cleanup-and-enrich.js --skip-investors
 *     → Skip investor enrichment (use when it times out or is blocked)
 */

require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);

const CLEANUP_DELETE = argv.includes('--cleanup-delete');
const ENRICH_ONLY = argv.includes('--enrich-only');
const CLEANUP_ONLY = argv.includes('--cleanup-only');
const RECALC_ONLY = argv.includes('--recalc-only');
const SKIP_INVESTORS = argv.includes('--skip-investors');
const limitArg = argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? limitArg.split('=')[1] : '200';

function log(emoji, msg) {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] ${emoji} ${msg}`);
}

function run(cmd, args = [], timeout = 30 * 60 * 1000) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      log('❌', `Timeout after ${(timeout / 60000).toFixed(0)} min`);
      resolve(false);
    }, timeout);
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error(err);
      resolve(false);
    });
  });
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  CLEANUP & ENRICH');
  console.log('═'.repeat(60));
  if (CLEANUP_DELETE) console.log('  ⚠️  Will DELETE garbage records');
  if (ENRICH_ONLY) console.log('  Skipping cleanup');
  if (CLEANUP_ONLY) console.log('  Cleanup only (no enrichment)');
  if (RECALC_ONLY) console.log('  Recalc only');
  if (SKIP_INVESTORS) console.log('  Skipping investor enrichment (use when blocked/slow)');
  console.log('═'.repeat(60));

  // ── 1. CLEANUP STARTUPS ──
  if (!ENRICH_ONLY && !RECALC_ONLY) {
    log('🧹', 'Step 1: Startup cleanup');
    const ok = await run('node', [
      path.join(PROJECT_ROOT, 'scripts/cleanup-garbage.js'),
      ...(CLEANUP_DELETE ? ['--delete'] : []),
    ], 5 * 60 * 1000);
    if (!ok && CLEANUP_DELETE) {
      console.error('Startup cleanup failed. Aborting.');
      process.exit(1);
    }
  }

  // ── 2. CLEANUP INVESTORS ──
  if (!ENRICH_ONLY && !RECALC_ONLY) {
    log('🧹', 'Step 2: Investor cleanup');
    const ok = await run('node', [
      path.join(PROJECT_ROOT, 'scripts/cleanup-garbage-investors.js'),
      ...(CLEANUP_DELETE ? ['--execute'] : ['--dry-run']),
    ], 5 * 60 * 1000);
    if (!ok && CLEANUP_DELETE) {
      console.error('Investor cleanup failed. Aborting.');
      process.exit(1);
    }
  }

  if (CLEANUP_ONLY) {
    log('✅', 'Cleanup only — done. Re-run with --cleanup-delete to actually delete.');
    return;
  }

  // ── 3. ENRICH SPARSE STARTUPS ──
  if (!RECALC_ONLY) {
    log('📈', 'Step 3: Enrich sparse startups (run-all, include holding)');
    const ok = await run('node', [
      path.join(PROJECT_ROOT, 'scripts/enrich-sparse-startups.js'),
      '--run-all',
      '--include-holding',
      '--html-only',  // Skip Google News (blocked on many networks); use website HTML only
      `--limit=${LIMIT}`,
    ], 90 * 60 * 1000); // 90 min for full run (many chunks)
    if (!ok) log('⚠️', 'Startup enrichment had issues — check logs');
  }

  // ── 4. ENRICH SPARSE INVESTORS ──
  if (!RECALC_ONLY && !SKIP_INVESTORS) {
    log('📈', 'Step 4: Enrich sparse investors (run-all)');
    const ok = await run('node', [
      path.join(PROJECT_ROOT, 'scripts/enrich-sparse-investors.js'),
      '--run-all',
      `--limit=${LIMIT}`,
    ], 90 * 60 * 1000); // 90 min (Google News often blocked → slow)
    if (!ok) log('⚠️', 'Investor enrichment had issues — check logs');
  } else if (SKIP_INVESTORS) {
    log('⏭️', 'Step 4: Skipping investor enrichment (--skip-investors)');
  }

  // ── 5. RECALC GOD SCORES ──
  log('📊', 'Step 5: Recalculate GOD scores');
  const ok = await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 20 * 60 * 1000);
  if (!ok) {
    console.error('Recalc failed.');
    process.exit(1);
  }

  log('✅', 'Cleanup & enrich pipeline complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
