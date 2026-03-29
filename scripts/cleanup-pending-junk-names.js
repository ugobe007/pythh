#!/usr/bin/env node
/**
 * Reject startup_uploads that are still pending/review but fail name quality checks
 * (same rules as scripts/cleanup-garbage.js — patterns + lib/startupNameValidator).
 *
 * Usage:
 *   node scripts/cleanup-pending-junk-names.js              # dry run: list only
 *   node scripts/cleanup-pending-junk-names.js --execute  # set status=rejected + admin_notes
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbage } = require('./cleanup-garbage');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const EXECUTE = process.argv.includes('--execute');
const NOTE_PREFIX = 'auto-rejected: junk/invalid startup name (cleanup-pending-junk-names.js)';

const PENDING_STATUSES = ['pending', 'reviewing'];

async function main() {
  console.log('\n🧹 PENDING QUEUE — JUNK NAME CLEANUP');
  console.log('═'.repeat(60));
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (will reject rows)' : 'DRY RUN'}`);
  console.log(`Statuses: ${PENDING_STATUSES.join(', ')}\n`);

  let all = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, status, created_at')
      .in('status', PENDING_STATUSES)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    page++;
  }

  console.log(`Rows in pending/reviewing: ${all.length}`);

  const junk = all.filter((s) => isGarbage(s.name));
  junk.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`Junk names flagged: ${junk.length}\n`);

  junk.slice(0, 200).forEach((s) => {
    console.log(`  [${s.status}] ${(s.name || '(empty)').slice(0, 72)}`);
  });
  if (junk.length > 200) {
    console.log(`  ... and ${junk.length - 200} more`);
  }

  if (!EXECUTE) {
    console.log('\n💡 Run with --execute to reject these rows (status=rejected + admin_notes).');
    console.log('═'.repeat(60));
    return;
  }

  if (junk.length === 0) {
    console.log('\nNothing to do.');
    return;
  }

  const now = new Date().toISOString();
  const CHUNK = 50;
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < junk.length; i += CHUNK) {
    const batch = junk.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map((row) =>
        supabase
          .from('startup_uploads')
          .update({
            status: 'rejected',
            admin_notes: NOTE_PREFIX,
            reviewed_at: now,
          })
          .eq('id', row.id)
          .in('status', PENDING_STATUSES)
      )
    );
    for (const r of results) {
      if (r.error) {
        console.error('Update failed:', r.error.message);
        fail++;
      } else {
        ok++;
      }
    }
    process.stdout.write(`  updated ${Math.min(i + CHUNK, junk.length)}/${junk.length}\r`);
  }
  console.log(`\n\n✅ Rejected: ${ok} rows${fail ? `, errors: ${fail}` : ''}`);
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
