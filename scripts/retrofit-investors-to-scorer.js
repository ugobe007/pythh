#!/usr/bin/env node
/**
 * RETROFIT: resolver_investors -> extracted_data.investors
 * ========================================================
 * One-off, idempotent migration. Earlier enrichment runs stored resolved
 * investors in extracted_data.resolver_investors (and the lead_investor column),
 * but the GOD scorer reads investors from extracted_data.investors via
 *   backed_by = startup.backed_by || extracted.backed_by || extracted.investors
 * so those links earned +0 social-proof score. This copies the canonical matched
 * names into extracted_data.investors for any row that has resolver_investors but
 * no investors yet. NO URL probing, NO LLM — pure field copy.
 *
 * Usage:
 *   node scripts/retrofit-investors-to-scorer.js            # DRY RUN
 *   node scripts/retrofit-investors-to-scorer.js --apply    # write
 *   node scripts/retrofit-investors-to-scorer.js --apply --limit 50000
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APPLY = has('--apply');
const LIMIT = parseInt(val('--limit', '100000'), 10);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Only credit investors actually linked to the canonical `investors` table.
// Unlinked entries are unverified extraction noise (e.g. "Private Equity",
// "Million") and would hand out undeserved social-proof score.
function namesFromResolver(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((i) => i && i.investor_id)
    .map((i) => i.matched_name || i.name)
    .filter(Boolean);
}

(async () => {
  console.log('═'.repeat(64));
  console.log('  RETROFIT investors -> extracted_data.investors');
  console.log(`  mode=${APPLY ? 'APPLY' : 'DRY-RUN'}  limit=${LIMIT}`);
  console.log('═'.repeat(64));

  const stats = { scanned: 0, eligible: 0, updated: 0, skipped_present: 0, skipped_empty: 0, errors: 0 };
  const PAGE = 500;
  let offset = 0;

  while (stats.scanned < LIMIT) {
    // Only rows that carry resolver output. extracted_data is JSONB; filter in JS
    // since nested-key presence filters are awkward across PostgREST versions.
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, extracted_data')
      .not('extracted_data->resolver_investors', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) { console.error('fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    for (const row of data) {
      stats.scanned += 1;
      const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
      if (Array.isArray(ed.investors) && ed.investors.length > 0) { stats.skipped_present += 1; continue; }
      const names = namesFromResolver(ed.resolver_investors);
      if (!names.length) { stats.skipped_empty += 1; continue; }
      stats.eligible += 1;
      if (!APPLY) {
        console.log(`  • ${row.name}  ← ${names.join(', ')}`);
        continue;
      }
      const { error: uerr } = await supabase
        .from('startup_uploads')
        .update({ extracted_data: { ...ed, investors: names } })
        .eq('id', row.id);
      if (uerr) { stats.errors += 1; console.log(`    ↳ update failed (${row.name}): ${uerr.message}`); }
      else { stats.updated += 1; console.log(`  ✅ ${row.name}  ← ${names.join(', ')}`); }
    }

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log('\n' + '─'.repeat(64));
  console.log(`  scanned (with resolver_investors): ${stats.scanned}`);
  console.log(`  already had investors (skipped):   ${stats.skipped_present}`);
  console.log(`  resolver list empty (skipped):     ${stats.skipped_empty}`);
  console.log(`  eligible:                          ${stats.eligible}`);
  console.log(`  updated:                           ${stats.updated}${APPLY ? '' : ' (dry-run)'}`);
  console.log(`  errors:                            ${stats.errors}`);
  console.log('─'.repeat(64));
  if (!APPLY) console.log('\n  DRY RUN — no writes. Re-run with --apply.\n');
})();
