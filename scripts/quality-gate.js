/**
 * Quality Gate — Auto-reject junk entries from the startup database.
 *
 * Criteria (ALL must be true to reject):
 *   1. status = 'approved'
 *   2. total_god_score <= 40  (at the DB-trigger floor — no earned points)
 *   3. No website (null or empty)
 *   4. submitted_email IS NULL (scraper-ingested, not manually submitted)
 *   5. No meaningful text content (<80 chars combined across all text fields)
 *
 * Safety guards:
 *   - NEVER rejects entries with a submitted_email (manually submitted startups)
 *   - NEVER rejects above score 40
 *   - NEVER rejects entries that have a website (even if text is thin)
 *   - All rejections include a reason in admin_notes so they can be reviewed
 *
 * Usage:
 *   node scripts/quality-gate.js             # dry-run (shows what WOULD be rejected)
 *   node scripts/quality-gate.js --execute   # actually reject
 *   node scripts/quality-gate.js --execute --limit=500
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const LIMIT = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : 5000;
})();
const BATCH = 100;

const ADMIN_NOTE =
  'Auto-rejected by quality-gate: no website, no meaningful content, ' +
  'and no manual submission. Re-approve after enrichment provides more data.';

// Combine all text columns into a single string for length check
function combinedText(row) {
  const ext = row.extracted_data || {};
  return [
    row.name,
    row.pitch,
    row.description,
    ext.description,
    ext.pitch,
    ext.company_description,
    Array.isArray(row.sectors) ? row.sectors.join(' ') : row.sectors,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

async function runGate() {
  console.log(`\n=== QUALITY GATE ${DRY_RUN ? '[DRY RUN]' : '[EXECUTE]'} ===`);
  console.log(`Limit: ${LIMIT}`);
  console.log('Criteria: approved + score<=40 + no website + no email + text<80\n');

  let processed = 0;
  let rejectedCount = 0;
  let skippedCount = 0;
  let from = 0;
  const PAGE = 500;

  while (processed < LIMIT) {
    const fetchSize = Math.min(PAGE, LIMIT - processed);
    const { data, error } = await sb
      .from('startup_uploads')
      .select('id, name, pitch, description, website, sectors, submitted_email, total_god_score, extracted_data, admin_notes')
      .eq('status', 'approved')
      .lte('total_god_score', 40)
      .is('submitted_email', null)
      .or('website.is.null,website.eq.')
      .range(from, from + fetchSize - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      break;
    }
    if (!data || data.length === 0) break;

    const toReject = [];

    for (const row of data) {
      const text = combinedText(row);

      // Safety: skip if text is long enough to be real content
      if (text.length >= 80) continue;

      // Safety double-check: no website set (shouldn't be needed due to query, but defensive)
      if (row.website && row.website.trim().length > 0) continue;

      toReject.push(row);
      if (DRY_RUN) {
        const preview = text.substring(0, 60) || '[no text]';
        console.log(`[WOULD REJECT] score:${row.total_god_score} | "${row.name?.substring(0, 40)}" | text: "${preview}"`);
      }
    }

    if (!DRY_RUN && toReject.length > 0) {
      // Batch update in chunks
      for (let i = 0; i < toReject.length; i += BATCH) {
        const chunk = toReject.slice(i, i + BATCH);
        const ids = chunk.map(r => r.id);

        const { error: updateError } = await sb
          .from('startup_uploads')
          .update({
            status: 'rejected',
            admin_notes: ADMIN_NOTE,
            updated_at: new Date().toISOString(),
          })
          .in('id', ids);

        if (updateError) {
          console.error(`Update error (batch ${i / BATCH}):`, updateError.message);
        } else {
          console.log(`  Rejected ${chunk.length} records (batch ${Math.floor(i / BATCH) + 1})`);
        }
      }
    }

    rejectedCount += toReject.length;
    skippedCount += data.length - toReject.length;
    processed += data.length;
    from += fetchSize;

    if (data.length < fetchSize) break; // no more rows
  }

  console.log('\n========== RESULTS ==========');
  console.log(`Total scanned:  ${processed}`);
  console.log(`Would reject:   ${rejectedCount} (text too thin, no website, no email)`);
  console.log(`Skipped (ok):   ${skippedCount} (had text >= 80 chars or website)`);
  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. To apply, run:');
    console.log('  node scripts/quality-gate.js --execute');
  } else {
    console.log(`\n✅ Rejected ${rejectedCount} junk entries.`);
    console.log('Re-approve from the admin panel after enrichment adds content.');
  }
}

runGate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
