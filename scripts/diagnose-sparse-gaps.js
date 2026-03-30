#!/usr/bin/env node
/**
 * DIAGNOSE SPARSE DATA GAPS
 * =========================
 * Research tool to understand why startups stay sparse and what we could do better.
 * Run BEFORE enforce-sparse-30day-policy to identify salvage opportunities.
 *
 * Outputs:
 *   - At-risk count (would be rejected by 30-day policy)
 *   - Data richness distribution
 *   - Inference opportunities (website, news, pitch we haven't tried)
 *   - Enrichment attempt recency
 *
 * Run: node scripts/diagnose-sparse-gaps.js [--limit=500]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

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

function hasInferenceText(s) {
  const pitch = (s.pitch || '').trim();
  const desc = (s.description || '').trim();
  const tag = (s.tagline || '').trim();
  return pitch.length >= 20 || desc.length >= 20 || tag.length >= 10;
}

function hasWebsiteToFetch(s) {
  const w = (s.website || s.company_website || '').trim();
  return w.length > 5 && (w.startsWith('http') || w.includes('.'));
}

async function main() {
  console.log('\n🔬 SPARSE DATA GAP DIAGNOSIS\n');
  console.log('═'.repeat(60));

  const selectCols = 'id, name, website, company_website, pitch, description, tagline, sectors, stage, raise_amount, last_round_amount_usd, total_funding_usd, customer_count, mrr, arr, team_size, location, has_revenue, has_customers, founders, growth_rate, extracted_data, created_at, enrichment_status, holding_since, total_god_score, updated_at';

  // 1) Fetch at-risk: holding 30d+ OR waiting/null 30d+ sparse
  const createdCutoff = new Date(Date.now() - HOLDING_DAYS * MS_PER_DAY).toISOString();

  const [holdingRes, waitingRes, totalRes] = await Promise.all([
    supabase.from('startup_uploads').select(selectCols)
      .eq('status', 'approved').eq('enrichment_status', 'holding')
      .not('holding_since', 'is', null).limit(LIMIT),
    supabase.from('startup_uploads').select(selectCols)
      .eq('status', 'approved')
      .or('enrichment_status.eq.waiting,enrichment_status.is.null')
      .lt('created_at', createdCutoff).order('created_at', { ascending: true }).limit(LIMIT * 2),
    supabase.from('startup_uploads').select('id', { count: 'exact', head: true })
      .eq('status', 'approved'),
  ]);

  const holding = holdingRes.data || [];
  const waiting = waitingRes.data || [];
  const totalApproved = totalRes.count || 0;

  const holdingExpired = holding.filter(s => new Date(s.holding_since).getTime() <= Date.now() - HOLDING_DAYS * MS_PER_DAY);
  const waitingSparse = waiting.filter(isDataSparse);
  const atRisk = [...new Map([...holdingExpired, ...waitingSparse].map(s => [s.id, s])).values()].slice(0, LIMIT);

  console.log('\n📊 AT-RISK (30-day policy would reject):');
  console.log(`   Holding 30d+ expired:     ${holdingExpired.length}`);
  console.log(`   Waiting/null 30d+ sparse: ${waitingSparse.length}`);
  console.log(`   Unique at-risk (batch):   ${atRisk.length}`);
  console.log(`   Total approved:           ${totalApproved}`);

  if (atRisk.length === 0) {
    console.log('\n✅ No at-risk startups. Nothing to diagnose.');
    return;
  }

  // 2) Categorize at-risk by salvage opportunity
  const withWebsite = atRisk.filter(hasWebsiteToFetch);
  const withTextNoWebsite = atRisk.filter(s => !hasWebsiteToFetch(s) && hasInferenceText(s));
  const nameOnly = atRisk.filter(s => !hasWebsiteToFetch(s) && !hasInferenceText(s));
  const richnessDist = { 0: 0, 1: 0, 2: 0 };
  atRisk.forEach(s => {
    const r = scoreDataRichness(s);
    richnessDist[Math.min(r, 2)] = (richnessDist[Math.min(r, 2)] || 0) + 1;
  });

  console.log('\n📋 SALVAGE OPPORTUNITIES:');
  console.log(`   With website (could fetch):     ${withWebsite.length} — run enrich-with-inference.ts (website mode)`);
  console.log(`   With pitch/desc/tagline:        ${withTextNoWebsite.length} — run enrich-with-inference.ts --text-only`);
  console.log(`   Name-only (minimal):            ${nameOnly.length} — run enrich-with-inference.ts --minimal`);
  console.log('\n   Data richness (at-risk): 0=%d, 1=%d, 2=%d', richnessDist[0] || 0, richnessDist[1] || 0, richnessDist[2] || 0);

  // 3) Sample at-risk with website — these are easy wins
  if (withWebsite.length > 0) {
    console.log('\n🔗 SAMPLE: At-risk WITH website (prioritize these):');
    withWebsite.slice(0, 8).forEach((s, i) => {
      const age = Math.floor((Date.now() - new Date(s.created_at)) / MS_PER_DAY);
      console.log(`   ${i + 1}. ${(s.name || '').slice(0, 40)} | ${s.website || s.company_website} | age=${age}d`);
    });
  }

  // 4) Sample name-only — hardest, need news match or minimal inference
  if (nameOnly.length > 0) {
    console.log('\n📝 SAMPLE: Name-only (hardest to salvage):');
    nameOnly.slice(0, 8).forEach((s, i) => {
      const age = Math.floor((Date.now() - new Date(s.created_at)) / MS_PER_DAY);
      console.log(`   ${i + 1}. ${(s.name || '').slice(0, 40)} | age=${age}d`);
    });
  }

  // 5) Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  if (withWebsite.length > 0) {
    console.log(`   1. Run: npx tsx scripts/enrich-with-inference.ts --limit ${Math.min(withWebsite.length + 50, 500)}`);
    console.log('      (Targets low-GOD startups with website; will pick up many of these)');
  }
  if (withTextNoWebsite.length > 0) {
    console.log(`   2. Run: npx tsx scripts/enrich-with-inference.ts --text-only --limit 500`);
    console.log('      (Infers from pitch/description/tagline)');
  }
  if (nameOnly.length > 0) {
    console.log(`   3. Run: npx tsx scripts/enrich-with-inference.ts --minimal --limit 500`);
    console.log('      (Infers from name + domain; run news enrichment for headline matches)');
  }
  console.log('   4. Run: node scripts/enrich-from-rss-news.js --all');
  console.log('      (Reverse headline search catches name-only mentions)');
  console.log('\n   THEN run enforce-sparse-30day-policy so we only reject after last-chance enrichment.');
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
