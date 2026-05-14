#!/usr/bin/env node
/**
 * Pending-queue pipeline → bulk purge
 *
 * 1) cleanup-pending-junk-names — aggressive + ontology (reject headline/junk names)
 * 2) bulk-auto-review-startups — auto-approve strong rows + reject isGarbage names
 * 3) Reject all startup_uploads still in pending / reviewing (clears the backlog)
 *
 * Usage:
 *   node scripts/purge-pending-startups-pipeline.js              # dry-run: counts + planned steps
 *   node scripts/purge-pending-startups-pipeline.js --execute    # run pipeline + purge remainder
 *
 *   node scripts/purge-pending-startups-pipeline.js --execute --purge-only   # skip steps 1–2; only reject remaining pending/reviewing (dangerous)
 *
 * Requires: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (or SERVICE_ROLE_KEY)
 */

require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');
const PURGE_ONLY = argv.includes('--purge-only');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PENDING_STATUSES = ['pending', 'reviewing'];
const NOTE_PURGE =
  'auto-rejected: bulk purge of pending queue after automated review pipeline (scripts/purge-pending-startups-pipeline.js)';
const BATCH = 80;

function runNode(rel, args, { label } = {}) {
  const script = path.join(ROOT, rel);
  const name = label || rel;
  console.log(`\n── ${name} ──`);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${name} exited with code ${r.status}`);
  }
}

async function countPending(sb) {
  const { count, error } = await sb
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .in('status', PENDING_STATUSES);
  if (error) throw error;
  return count || 0;
}

async function fetchAllPendingIds(sb) {
  const ids = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id')
      .in('status', PENDING_STATUSES)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    ids.push(...data.map((r) => r.id));
    if (data.length < PAGE) break;
    page++;
  }
  return ids;
}

async function purgeRemaining(sb) {
  const ids = await fetchAllPendingIds(sb);
  if (ids.length === 0) {
    console.log('\n✅ No remaining pending/reviewing rows.');
    return 0;
  }

  console.log(`\n── Purge remaining pending/reviewing ──`);
  console.log(`  rows to reject: ${ids.length}`);

  if (!EXECUTE) {
    console.log('  (dry run — pass --execute to apply)');
    return ids.length;
  }

  const now = new Date().toISOString();
  let ok = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error } = await sb
      .from('startup_uploads')
      .update({
        status: 'rejected',
        admin_notes: NOTE_PURGE,
        reviewed_at: now,
        updated_at: now,
      })
      .in('id', chunk)
      .in('status', PENDING_STATUSES);

    if (error) {
      console.error('  batch error:', error.message);
      throw error;
    }
    ok += chunk.length;
    process.stdout.write(`  rejected ${ok}/${ids.length}\r`);
  }
  console.log(`\n  ✅ Rejected ${ok} rows (still pending after pipeline).`);
  return ok;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`  PENDING QUEUE — PIPELINE + PURGE  (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})`);
  console.log('══════════════════════════════════════════════════════════════');

  const startCount = await countPending(sb);
  console.log(`\nstartup_uploads in ${PENDING_STATUSES.join('/')}: ${startCount}`);

  if (!PURGE_ONLY) {
    if (EXECUTE) {
      runNode('scripts/cleanup-pending-junk-names.js', ['--aggressive', '--ontology', '--execute']);
      runNode('scripts/bulk-auto-review-startups.js', ['--execute', '--reject-garbage']);
    } else {
      console.log('\n── Planned step 1 (dry) ──');
      console.log('  node scripts/cleanup-pending-junk-names.js --aggressive --ontology');
      console.log('\n── Planned step 2 (dry) ──');
      console.log('  node scripts/bulk-auto-review-startups.js --reject-garbage');
      runNode('scripts/cleanup-pending-junk-names.js', ['--aggressive', '--ontology']);
      runNode('scripts/bulk-auto-review-startups.js', ['--reject-garbage']);
    }
  } else {
    console.log('\n── Pipeline steps SKIPPED (--purge-only) ──');
  }

  const midCount = await countPending(sb);
  if (!PURGE_ONLY) {
    console.log(`\nPending/reviewing after pipeline${EXECUTE ? '' : ' (dry pipeline may not change DB)'}: ${midCount}`);
  }

  await purgeRemaining(sb);

  const endCount = await countPending(sb);
  console.log(`\nPending/reviewing now: ${endCount}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (!EXECUTE) {
    console.log('💡 Run with --execute to apply pipeline updates and purge the remaining queue.\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
