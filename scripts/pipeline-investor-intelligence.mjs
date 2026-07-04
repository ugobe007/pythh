#!/usr/bin/env node
/**
 * Full investor intelligence pipeline — P0→P2 stack.
 *
 * Stages (pass --skip-* to omit):
 *   1. quality-gate audit (dry-run quarantine preview)
 *   2. VC enrichment (news, partners, investments) — daily batch
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
 *   node scripts/pipeline-investor-intelligence.mjs --apply --limit=150 --batch-size=10
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const argv = process.argv.slice(2);
const skip = (flag) => argv.includes(flag);
const limArg = argv.find((a) => a.startsWith('--limit='));
const batchArg = argv.find((a) => a.startsWith('--batch-size='));
const LIMIT = limArg ? limArg.split('=')[1] : '150';
const BATCH_SIZE = batchArg ? batchArg.split('=')[1] : '10';

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

async function metrics() {
  const inv = (await sb.from('investors').select('id', { count: 'exact', head: true })).count ?? 0;
  const junk = (await sb.from('investors').select('id', { count: 'exact', head: true }).eq('entity_gate', 'junk')).count ?? 0;
  const news = (await sb.from('investor_news').select('id', { count: 'exact', head: true })).count ?? 0;
  const partners = (await sb.from('investor_partners').select('id', { count: 'exact', head: true })).count ?? 0;
  const intel = (await sb.from('vc_intelligence').select('id', { count: 'exact', head: true })).count ?? 0;
  const faith = (await sb.from('vc_faith_signals').select('id', { count: 'exact', head: true })).count ?? 0;
  const noVel = (await sb.from('investors').select('id', { count: 'exact', head: true }).is('deployment_velocity_index', null)).count ?? 0;
  return { inv, junk, news, partners, intel, faith, noVel };
}

async function main() {
  const before = await metrics();
  console.log('\n📡 Investor intelligence pipeline (full stack)');
  console.log(`   investors ${before.inv} · junk ${before.junk} · news ${before.news} · partners ${before.partners}`);
  console.log(`   vc_intelligence ${before.intel} · faith_signals ${before.faith} · missing velocity ${before.noVel}`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · limit ${LIMIT} · batch ${BATCH_SIZE}\n`);

  if (!APPLY) {
    console.log('(dry-run — pass --apply to write)\n');
    return;
  }

  if (!skip('--skip-quality')) {
    console.log('\n── Stage 1: Quality gate audit ──');
    await run(process.execPath, [path.join(root, 'investor-data-quality-gate.js')]);
  }

  if (!skip('--skip-enrich')) {
    console.log('\n── Stage 2: VC enrichment (daily batch) ──');
    await run('npx', ['tsx', path.join(root, 'enrich-vcs.ts'), `--batch-size=${BATCH_SIZE}`], { shell: true });
    console.log('\n── Stage 2b: Partners JSON sync ──');
    await run(process.execPath, [path.join(root, 'sync-investor-partners-json.mjs'), '--apply', `--limit=${LIMIT}`]);
  }

  if (!skip('--skip-velocity')) {
    console.log('\n── Stage 3: Deployment velocity ──');
    await run(process.execPath, [path.join(root, 'oracle-signal-backfill.js'), `--limit=${LIMIT}`]);
    await run(process.execPath, [path.join(root, 'enrich-investor-deployment.js'), `--limit=${LIMIT}`]);
  }

  if (!skip('--skip-intel')) {
    console.log('\n── Stage 4: VC intelligence scrape + profile ──');
    await run(process.execPath, [path.join(root, 'intelligence/scrape-vc-intelligence.js'), `--limit=${LIMIT}`]);
    await run(process.execPath, [path.join(root, 'intelligence/build-vc-profiles.js')]);
  }

  if (!skip('--skip-sync')) {
    console.log('\n── Stage 5: Sync vc_intelligence → investors ──');
    await run(process.execPath, [path.join(root, 'sync-vc-intelligence-to-investors.mjs'), '--apply', `--limit=${LIMIT}`]);
  }

  if (!skip('--skip-faith')) {
    console.log('\n── Stage 6: Faith signals backfill ──');
    await run('npx', ['tsx', path.join(root, 'backfill-faith-signals.ts'), '--limit', '50'], { shell: true });
  }

  if (!skip('--skip-thesis')) {
    console.log('\n── Stage 7: Rolling firm thesis ──');
    await run(process.execPath, [path.join(root, 'refresh-firm-thesis-from-investments.mjs'), '--apply', `--limit=${LIMIT}`]);
  }

  if (!skip('--skip-events')) {
    console.log('\n── Stage 8: Investor signal events ──');
    await run(process.execPath, [path.join(root, 'emit-investor-signal-events.mjs'), '--apply']);
  }

  const after = await metrics();
  console.log('\n✅ Pipeline complete');
  console.log(`   news:     ${before.news} → ${after.news}`);
  console.log(`   partners: ${before.partners} → ${after.partners}`);
  console.log(`   intel:    ${before.intel} → ${after.intel}`);
  console.log(`   faith:    ${before.faith} → ${after.faith}`);
  console.log(`   velocity missing: ${before.noVel} → ${after.noVel}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
