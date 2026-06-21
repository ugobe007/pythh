#!/usr/bin/env node
/**
 * Backfill investor intelligence: oracle signals → deployment velocity.
 *
 * Usage:
 *   node scripts/pipeline-investor-intelligence.mjs
 *   node scripts/pipeline-investor-intelligence.mjs --apply --limit=150
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const limArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limArg ? limArg.split('=')[1] : '150';
const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, '..');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function run(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
      cwd: repo,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exit ${code}`))));
  });
}

async function gaps() {
  const total = (await sb.from('investors').select('id', { count: 'exact', head: true })).count ?? 0;
  const noLast = (await sb.from('investors').select('id', { count: 'exact', head: true }).is('last_investment_date', null)).count ?? 0;
  const noCheck = (await sb.from('investors').select('id', { count: 'exact', head: true }).is('check_size_min', null).is('check_size_max', null)).count ?? 0;
  const noVel = (await sb.from('investors').select('id', { count: 'exact', head: true }).is('deployment_velocity_index', null)).count ?? 0;
  return { total, noLast, noCheck, noVel };
}

async function main() {
  const before = await gaps();
  console.log('\n📡 Investor intelligence backfill');
  console.log(`   total ${before.total} · missing last deal ${before.noLast} · check size ${before.noCheck} · velocity ${before.noVel}`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · limit ${LIMIT}\n`);

  if (!APPLY) {
    console.log('(dry-run — pass --apply to write)\n');
    return;
  }

  await run('oracle-signal-backfill.js', [`--limit=${LIMIT}`]);
  await run('enrich-investor-deployment.js', [`--limit=${LIMIT}`]);

  const after = await gaps();
  console.log('\n✅ Done');
  console.log(`   last deal missing: ${before.noLast} → ${after.noLast}`);
  console.log(`   check size missing: ${before.noCheck} → ${after.noCheck}`);
  console.log(`   velocity missing:   ${before.noVel} → ${after.noVel}\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
