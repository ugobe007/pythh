#!/usr/bin/env node
/**
 * PURGE JUNK NAMES FROM startup_uploads
 * =======================================
 * Runs every existing startup_uploads record through the canonical
 * isValidStartupName() validator and marks failing records as 'rejected'
 * with a rejection_reason, or deletes them if they were still 'pending'.
 *
 * Usage:
 *   node scripts/purge-junk-names.js          # dry-run (shows what would change)
 *   node scripts/purge-junk-names.js --apply  # write to DB
 *   node scripts/purge-junk-names.js --apply --status=pending   # pending only
 *   node scripts/purge-junk-names.js --apply --status=approved  # approved only
 *   node scripts/purge-junk-names.js --apply --delete-pending   # delete pending instead of reject
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('../lib/startupNameValidator');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const APPLY     = process.argv.includes('--apply');
const DELETE_PENDING = process.argv.includes('--delete-pending');
const STATUS_FILTER  = (process.argv.find(a => a.startsWith('--status=')) || '').split('=')[1] || null;
const BATCH_SIZE     = 500;
const PREFIX         = APPLY ? '[APPLY]' : '[DRY]';

// ── Rejection-reason display ────────────────────────────────────────────────
const REASON_LABELS = {
  too_short:               'too short (<2 chars)',
  too_long:                'too long (>60 chars)',
  all_numbers:             'all numbers',
  starts_with_number:      'starts with number',
  contains_batch_season:   'YC batch season',
  location_based_prefix:   'location-based prefix (e.g. "Boston-based")',
  geographic_entity:       'standalone geographic entity',
  adverb_not_company:      'English adverb',
  hyphenated_descriptor:   'hyphenated tech descriptor',
  generic_single_word:     'generic industry single-word',
  demonym_not_company:     'nationality/demonym',
  article_headline_verb_chain: 'news headline fragment',
  starts_with_number_noun: 'number + noun phrase',
  city_suffix:             'city-suffix concatenation artifact',
  excessive_camelcase:     'excessive camelCase (concatenated garbage)',
  matched_junk_pattern:    'matches junk pattern',
  known_publisher:         'known media publisher name',
  is_person_name:          'person name, not company',
};

async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Pythh — Junk Name Purge  ${APPLY ? '(APPLY)' : '(DRY-RUN)'}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (!APPLY) {
    console.log('  ℹ️  Dry-run mode — pass --apply to write changes.\n');
  }

  let query = supabase
    .from('startup_uploads')
    .select('id, name, status, admin_notes')
    .neq('status', 'rejected');   // skip already-rejected

  if (STATUS_FILTER) {
    query = query.eq('status', STATUS_FILTER);
    console.log(`  Filtering to status = "${STATUS_FILTER}"\n`);
  }

  const stats = {
    total: 0, valid: 0, junk: 0,
    rejected: 0, deleted: 0, skipped: 0,
    byReason: {},
  };

  let offset = 0;
  while (true) {
    const { data: rows, error } = await query
      .range(offset, offset + BATCH_SIZE - 1)
      .order('id', { ascending: true });

    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;

    stats.total += rows.length;

    for (const row of rows) {
      const name = (row.name || '').trim();
      const result = isValidStartupName(name);

      if (result.isValid) {
        stats.valid++;
        continue;
      }

      stats.junk++;
      const reason = result.reason || 'unknown';
      stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;

      const label = REASON_LABELS[reason] || reason;
      console.log(`  ${PREFIX} "${name}" → ✗ ${label}`);

      if (!APPLY) continue;

      if (row.status === 'pending' && DELETE_PENDING) {
        const { error: delErr } = await supabase
          .from('startup_uploads')
          .delete()
          .eq('id', row.id);
        if (delErr) { console.error(`    ↳ delete error: ${delErr.message}`); stats.skipped++; }
        else stats.deleted++;
      } else {
        const { error: upErr } = await supabase
          .from('startup_uploads')
          .update({
            status: 'rejected',
            admin_notes: `[auto-purge] ${REASON_LABELS[reason] || reason}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (upErr) { console.error(`    ↳ update error: ${upErr.message}`); stats.skipped++; }
        else stats.rejected++;
      }
    }

    offset += rows.length;
    if (rows.length < BATCH_SIZE) break;
    console.log(`  ... processed ${stats.total} so far`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total scanned : ${stats.total}`);
  console.log(`  Valid (kept)  : ${stats.valid}`);
  console.log(`  Junk found    : ${stats.junk}`);
  if (APPLY) {
    console.log(`  Rejected      : ${stats.rejected}`);
    console.log(`  Deleted       : ${stats.deleted}`);
    console.log(`  Errors        : ${stats.skipped}`);
  }

  if (stats.junk > 0) {
    console.log(`\n  Breakdown by reason:`);
    const sorted = Object.entries(stats.byReason).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sorted) {
      const label = REASON_LABELS[reason] || reason;
      console.log(`    ${String(count).padStart(4)}  ${label}`);
    }
  }

  if (!APPLY && stats.junk > 0) {
    console.log(`\n  💡 Run with --apply to reject these records.`);
    console.log(`     Add --delete-pending to hard-delete 'pending' entries instead.`);
  }
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
