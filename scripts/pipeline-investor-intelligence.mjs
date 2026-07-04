#!/usr/bin/env node
/**
 * Full investor intelligence pipeline — all venture + angel investors.
 *
 * Stages (pass --skip-* to omit):
 *   1. quality-gate audit (dry-run quarantine preview)
 *   2. Signal enrichment (news, partners, investments) — full DB universe
 *   3. deployment velocity backfill
 *   4. vc_intelligence scrape + profile
 *   5. sync vc_intelligence → investors
 *   6. faith signals backfill
 *   7. rolling firm thesis from investments
 *   8. investor signal events
 *
 * Usage:
 *   node scripts/pipeline-investor-intelligence.mjs
 *   node scripts/pipeline-investor-intelligence.mjs --apply
 *   node scripts/pipeline-investor-intelligence.mjs --apply --limit=0        # ALL venture+angel
 *   node scripts/pipeline-investor-intelligence.mjs --apply --limit=500 --offset=1000
 *   node scripts/pipeline-investor-intelligence.mjs --apply --cohort=venture,angel
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  countInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} from '../lib/investorUniverse.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const argv = process.argv.slice(2);
const skip = (flag) => argv.includes(flag);
const LIMIT = parseLimitArg(argv, { defaultZero: true });
const OFFSET = parseOffsetArg(argv);
const COHORT = parseCohortArg(argv);
const DELAY_ARG = argv.find((a) => a.startsWith('--delay='));
const DELAY = DELAY_ARG ? DELAY_ARG.split('=')[1] : '2000';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, '..');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function run(cmd, args, { shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repo,
      stdio: 'inherit',
      env: process.env,
      shell,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exit ${code}`))));
  });
}

function limitFlag() {
  return `--limit=${LIMIT}`;
}

function offsetFlag() {
  return OFFSET > 0 ? [`--offset=${OFFSET}`] : [];
}

function cohortFlag() {
  return [`--cohort=${COHORT}`];
}

async function metrics() {
  const universe = await countInvestorUniverse(sb, COHORT);
  const news = (await sb.from('investor_news').select('id', { count: 'exact', head: true })).count ?? 0;
  const partners = (await sb.from('investor_partners').select('id', { count: 'exact', head: true })).count ?? 0;
  const intel = (await sb.from('vc_intelligence').select('id', { count: 'exact', head: true })).count ?? 0;
  const faith = (await sb.from('vc_faith_signals').select('id', { count: 'exact', head: true })).count ?? 0;
  const noSignals = (await sb.from('investors').select('id', { count: 'exact', head: true }).eq('signals', '[]').neq('entity_gate', 'junk').neq('status', 'inactive')).count ?? 0;
  const noVel = (await sb.from('investors').select('id', { count: 'exact', head: true }).is('deployment_velocity_index', null)).count ?? 0;
  return { universe, news, partners, intel, faith, noSignals, noVel };
}

async function main() {
  const before = await metrics();
  const limitLabel = LIMIT > 0 ? String(LIMIT) : 'ALL';
  console.log('\n📡 Investor intelligence pipeline (venture + angel universe)');
  console.log(`   universe: ${before.universe.total} (VC ${before.universe.venture} · angel ${before.universe.angel})`);
  console.log(`   news ${before.news} · partners ${before.partners} · missing oracle signals ${before.noSignals}`);
  console.log(`   vc_intelligence ${before.intel} · faith_signals ${before.faith} · missing velocity ${before.noVel}`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · cohort ${COHORT} · limit ${limitLabel} · offset ${OFFSET}\n`);

  if (!APPLY) {
    console.log('(dry-run — pass --apply to write)\n');
    console.log('Stages that would run:');
    console.log('  1. quality-gate audit');
    console.log(`  2. enrich-investor-signals (${limitLabel} investors)`);
    console.log(`  3. oracle-signal-backfill + deployment velocity (${limitLabel})`);
    console.log(`  4. vc_intelligence scrape + profile (${limitLabel})`);
    console.log('  5–8. sync, faith, thesis, signal events');
    return;
  }

  if (!skip('--skip-quality')) {
    console.log('\n── Stage 1: Quality gate audit ──');
    await run(process.execPath, [path.join(root, 'investor-data-quality-gate.js')]);
  }

  if (!skip('--skip-enrich')) {
    console.log('\n── Stage 2: Signal enrichment (full venture + angel universe) ──');
    await run('npx', [
      'tsx',
      path.join(root, 'enrich-investor-signals.ts'),
      limitFlag(),
      ...offsetFlag(),
      ...cohortFlag(),
      `--delay=${DELAY}`,
    ]);
    console.log('\n── Stage 2b: Partners JSON sync ──');
    await run(process.execPath, [
      path.join(root, 'sync-investor-partners-json.mjs'),
      '--apply',
      limitFlag(),
      ...cohortFlag(),
    ]);
  }

  if (!skip('--skip-velocity')) {
    console.log('\n── Stage 3: Oracle signals + deployment velocity ──');
    await run(process.execPath, [
      path.join(root, 'oracle-signal-backfill.js'),
      limitFlag(),
      ...offsetFlag(),
      ...cohortFlag(),
    ]);
    await run(process.execPath, [
      path.join(root, 'enrich-investor-deployment.js'),
      limitFlag(),
      ...offsetFlag(),
      ...cohortFlag(),
    ]);
  }

  if (!skip('--skip-intel')) {
    console.log('\n── Stage 4: VC intelligence scrape + profile ──');
    await run(process.execPath, [
      path.join(root, 'intelligence/scrape-vc-intelligence.js'),
      limitFlag(),
      ...offsetFlag(),
      ...cohortFlag(),
    ]);
    await run(process.execPath, [path.join(root, 'intelligence/build-vc-profiles.js')]);
  }

  if (!skip('--skip-sync')) {
    console.log('\n── Stage 5: Sync vc_intelligence → investors ──');
    await run(process.execPath, [
      path.join(root, 'sync-vc-intelligence-to-investors.mjs'),
      '--apply',
      limitFlag(),
    ]);
  }

  if (!skip('--skip-faith')) {
    console.log('\n── Stage 6: Faith signals backfill ──');
    const faithLimit = LIMIT > 0 ? String(Math.min(LIMIT, 500)) : '500';
    await run('npx', ['tsx', path.join(root, 'backfill-faith-signals.ts'), '--limit', faithLimit, '--url-only'], {
      shell: true,
    });
  }

  if (!skip('--skip-thesis')) {
    console.log('\n── Stage 7: Rolling firm thesis ──');
    await run(process.execPath, [
      path.join(root, 'refresh-firm-thesis-from-investments.mjs'),
      '--apply',
      limitFlag(),
      ...cohortFlag(),
    ]);
  }

  if (!skip('--skip-events')) {
    console.log('\n── Stage 8: Investor signal events ──');
    await run(process.execPath, [path.join(root, 'emit-investor-signal-events.mjs'), '--apply']);
  }

  const after = await metrics();
  console.log('\n✅ Pipeline complete');
  console.log(`   news:            ${before.news} → ${after.news}`);
  console.log(`   partners:        ${before.partners} → ${after.partners}`);
  console.log(`   intel:           ${before.intel} → ${after.intel}`);
  console.log(`   faith:           ${before.faith} → ${after.faith}`);
  console.log(`   missing signals: ${before.noSignals} → ${after.noSignals}`);
  console.log(`   missing velocity:${before.noVel} → ${after.noVel}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
