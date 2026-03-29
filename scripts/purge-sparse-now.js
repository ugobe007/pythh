#!/usr/bin/env node
/**
 * PURGE SPARSE DATA STARTUPS (one-off)
 * ====================================
 * Rejects all approved startups that are data-sparse (no website + data richness <= 2).
 * No 30-day wait — use this to clean the pipeline so GOD scores can sit in the 55 range.
 *
 * Run: node scripts/purge-sparse-now.js [--dry-run] [--richness=3]
 * Then: npm run recalc
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const richnessArg = process.argv.find(a => a.startsWith('--richness='));
const RICHNESS_FLOOR = richnessArg ? parseInt(richnessArg.split('=')[1]) : 2;

function scoreDataRichness(s) {
  let signals = 0;
  const ed = s.extracted_data || {};
  if (s.website || s.company_website) signals += 2;
  if ((s.pitch || s.description || '').length > 30) signals++;
  if (s.sectors?.length > 0) signals++;
  if (s.stage) signals++;
  if (s.raise_amount || s.last_round_amount_usd || s.total_funding_usd) signals++;
  if (s.customer_count || s.parsed_customers) signals++;
  if (s.mrr || s.arr || s.arr_usd || s.revenue_usd) signals++;
  if (s.team_size || s.team_size_estimate || s.parsed_headcount) signals++;
  if (s.location) signals++;
  if ((s.tagline || '').length > 10) signals++;
  if (s.has_revenue) signals++;
  if (s.has_customers) signals++;
  if (s.founders) signals++;
  if ((s.growth_rate || s.arr_growth_rate) > 0) signals++;
  if (ed.team || ed.founders || ed.team_background) signals++;
  if (ed.revenue || ed.mrr || ed.arr || ed.traction || ed.customers) signals++;
  if (ed.funding || ed.raised || ed.backed_by || ed.investors) signals++;
  if (ed.market_size || ed.tam || ed.market || ed.target_market) signals++;
  if (ed.description || ed.summary) signals++;
  if ((ed.value_proposition || '').length > 10) signals++;
  if ((ed.problem || '').length > 10) signals++;
  if ((ed.solution || '').length > 10) signals++;
  return signals;
}

async function main() {
  console.log('\n=== PURGE SPARSE DATA STARTUPS (one-off) ===\n');
  if (DRY_RUN) console.log('[DRY RUN] No writes.\n');
  console.log(`Criteria: approved + no website + data richness <= ${RICHNESS_FLOOR}\n`);

  const selectCols = 'id, name, website, company_website, pitch, description, sectors, stage, raise_amount, last_round_amount_usd, total_funding_usd, customer_count, parsed_customers, mrr, arr, arr_usd, revenue_usd, team_size, team_size_estimate, parsed_headcount, location, tagline, has_revenue, has_customers, founders, growth_rate, arr_growth_rate, extracted_data, total_god_score';

  // Supabase PostgREST caps at 1000 rows per request regardless of range size.
  // Use PAGE=1000 and break when the page comes back short.
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(selectCols)
      .eq('status', 'approved')
      .is('website', null)
      .is('company_website', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const toReject = all.filter(s => scoreDataRichness(s) <= RICHNESS_FLOOR);
  console.log(`  Approved with no website: ${all.length}`);
  console.log(`  Sparse (richness <= ${RICHNESS_FLOOR}): ${toReject.length}\n`);

  if (toReject.length === 0) {
    console.log('Nothing to purge.');
    return;
  }

  if (DRY_RUN) {
    toReject.slice(0, 20).forEach(s => console.log(`  [${s.total_god_score}] ${(s.name || '').slice(0, 50)} (richness=${scoreDataRichness(s)})`));
    if (toReject.length > 20) console.log(`  ... and ${toReject.length - 20} more`);
    console.log('\nRun without --dry-run to reject these startups. Then: npm run recalc');
    return;
  }

  const BATCH = 200;
  let rejected = 0;
  for (let i = 0; i < toReject.length; i += BATCH) {
    const ids = toReject.slice(i, i + BATCH).map(s => s.id);
    const { error } = await supabase
      .from('startup_uploads')
      .update({
        status: 'rejected',
        admin_notes: 'purge-sparse-now: data-sparse (no website, low richness), pipeline cleanup for GOD ~55 target',
      })
      .in('id', ids);
    if (error) console.error('Batch error:', error.message);
    else rejected += ids.length;
  }
  console.log(`Rejected ${rejected} sparse startups.\nNext: npm run recalc`);
}

main().catch(err => { console.error(err); process.exit(1); });
