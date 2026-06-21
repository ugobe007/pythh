#!/usr/bin/env node
/**
 * Priority enrichment for approved startups stuck in holding/waiting/null.
 * Wraps enrich-sparse-startups.js with portfolio-friendly defaults.
 *
 * Usage:
 *   node scripts/pipeline-priority-enrichment.mjs
 *   node scripts/pipeline-priority-enrichment.mjs --apply --limit=300
 *   node scripts/pipeline-priority-enrichment.mjs --apply --run-all
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const RUN_ALL = process.argv.includes('--run-all');
const limArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limArg ? limArg.split('=')[1] : '200';
const root = path.dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function queueStats() {
  const holding = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('enrichment_status', 'holding');
  const waiting = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('enrichment_status', 'waiting');
  const unset = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').is('enrichment_status', null);
  return { holding: holding.count ?? 0, waiting: waiting.count ?? 0, unset: unset.count ?? 0 };
}

function runEnrich(extraArgs) {
  return new Promise((resolve, reject) => {
    const args = [
      path.join(root, 'enrich-sparse-startups.js'),
      '--include-holding',
      '--god-score-below=100',
      `--limit=${LIMIT}`,
      ...extraArgs,
    ];
    if (!APPLY) args.push('--dry-run');
    const child = spawn(process.execPath, args, { cwd: path.join(root, '..'), stdio: 'inherit', env: process.env });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`enrich exit ${code}`))));
  });
}

async function main() {
  const before = await queueStats();
  console.log('\n🔄 Priority enrichment queue');
  console.log(`   holding ${before.holding} · waiting ${before.waiting} · unset ${before.unset}`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · limit/chunk ${LIMIT}${RUN_ALL ? ' · run-all' : ''}\n`);

  if (!APPLY) {
    console.log('(dry-run — pass --apply to enrich)\n');
  }

  const extra = RUN_ALL ? ['--run-all'] : [];
  await runEnrich(extra);

  if (APPLY) {
    console.log('\n♻️  Recalculating GOD scores (post-enrichment)…');
    await new Promise((resolve, reject) => {
      const child = spawn('npx', ['tsx', 'scripts/recalculate-scores.ts'], {
        cwd: path.join(root, '..'),
        stdio: 'inherit',
        env: process.env,
      });
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`recalc exit ${code}`))));
    });
  }

  const after = await queueStats();
  console.log('\n✅ Done');
  console.log(`   holding ${before.holding} → ${after.holding}`);
  console.log(`   waiting ${before.waiting} → ${after.waiting}`);
  console.log(`   unset   ${before.unset} → ${after.unset}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
