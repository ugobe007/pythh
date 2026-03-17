#!/usr/bin/env node
/**
 * ENFORCE DATA-SPARSE 30-DAY POLICY
 * ==================================
 * Policy: Data-sparse approved startups get 30 days to be enriched.
 * If they cannot be enriched after 30 days, they are removed (rejected).
 *
 * This script catches cases that never entered the holding funnel:
 * - Approved + no website + data richness <= 2 + (created_at >= 30d ago OR in holding 30d+)
 * and rejects them. Also processes holding startups that are 30d+ (in case
 * holding-review-worker didn't run or hit limit).
 *
 * Run: node scripts/enforce-sparse-30day-policy.js [--dry-run] [--limit=500]
 * Cron: daily after holding-review-worker (e.g. 3:30am)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 500;
const RICHNESS_FLOOR = 2;
const HOLDING_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function isDataSparse(s) {
  const hasUrl = !!(s.website || s.company_website);
  if (hasUrl) return false;
  return scoreDataRichness(s) <= RICHNESS_FLOOR;
}

async function main() {
  console.log('\n=== ENFORCE SPARSE 30-DAY POLICY ===\n');
  if (DRY_RUN) console.log('[DRY RUN] No writes.\n');
  console.log(`Richness floor: ${RICHNESS_FLOOR} (no website + richness <= ${RICHNESS_FLOOR} = unenrichable)`);
  console.log(`Holding window: ${HOLDING_DAYS} days\n`);

  const selectCols = 'id, name, website, company_website, pitch, description, sectors, stage, raise_amount, last_round_amount_usd, total_funding_usd, customer_count, parsed_customers, mrr, arr, arr_usd, revenue_usd, team_size, team_size_estimate, parsed_headcount, location, tagline, has_revenue, has_customers, founders, growth_rate, arr_growth_rate, extracted_data, created_at, enrichment_status, holding_since';

  // 1) Holding 30d+ (same logic as holding-review-worker)
  let holding = [];
  let from = 0;
  while (holding.length < LIMIT) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(selectCols)
      .eq('status', 'approved')
      .eq('enrichment_status', 'holding')
      .not('holding_since', 'is', null)
      .range(from, from + 999);

    if (error) { console.error('Holding fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    const cutoff = Date.now() - HOLDING_DAYS * MS_PER_DAY;
    const expired = data.filter(s => new Date(s.holding_since).getTime() <= cutoff);
    holding = holding.concat(expired);
    if (holding.length >= LIMIT) { holding = holding.slice(0, LIMIT); break; }
    if (data.length < 1000) break;
    from += 1000;
  }

  // 2) Waiting or null, created_at 30d+ ago, data-sparse
  let waitingOrNull = [];
  from = 0;
  const createdCutoff = new Date(Date.now() - HOLDING_DAYS * MS_PER_DAY).toISOString();
  while (waitingOrNull.length < LIMIT) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(selectCols)
      .eq('status', 'approved')
      .or('enrichment_status.eq.waiting,enrichment_status.is.null')
      .lt('created_at', createdCutoff)
      .order('created_at', { ascending: true })
      .range(from, from + 999);

    if (error) { console.error('Waiting/null fetch error:', error.message); process.exit(1); }
    if (!data?.length) break;
    const sparse = data.filter(isDataSparse);
    waitingOrNull = waitingOrNull.concat(sparse);
    if (waitingOrNull.length >= LIMIT) { waitingOrNull = waitingOrNull.slice(0, LIMIT); break; }
    if (data.length < 1000) break;
    from += 1000;
  }

  const toReject = [...holding];
  const waitingIds = new Set(waitingOrNull.map(s => s.id));
  for (const s of waitingOrNull) {
    if (!toReject.find(r => r.id === s.id)) toReject.push(s);
  }
  const total = Math.min(toReject.length, LIMIT);
  const batch = toReject.slice(0, LIMIT);

  console.log(`  Holding 30d+ (unenrichable): ${holding.length}`);
  console.log(`  Waiting/null 30d+ sparse:    ${waitingOrNull.length}`);
  console.log(`  Total to reject:             ${total}\n`);

  if (total === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (DRY_RUN) {
    batch.slice(0, 15).forEach(s => {
      const src = holding.some(h => h.id === s.id) ? 'holding' : 'waiting/null';
      console.log(`  [${src}] ${(s.name || '').slice(0, 45)} (created: ${(s.created_at || '').slice(0, 10)})`);
    });
    if (total > 15) console.log(`  ... and ${total - 15} more`);
    console.log('\nRun without --dry-run to apply.');
    return;
  }

  const BATCH_SIZE = 200;
  let rejected = 0;
  for (let i = 0; i < batch.length; i += BATCH_SIZE) {
    const ids = batch.slice(i, i + BATCH_SIZE).map(s => s.id);
    const { error } = await supabase
      .from('startup_uploads')
      .update({
        status: 'rejected',
        admin_notes: 'enforce-sparse-30day-policy: data-sparse 30+ days, could not enrich',
      })
      .in('id', ids);
    if (error) console.error('Batch error:', error.message);
    else rejected += ids.length;
  }
  console.log(`Rejected ${rejected} startups.\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
