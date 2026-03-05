#!/usr/bin/env node
/**
 * audit-scoring-gaps.js
 *
 * Maps the minimum dataset required by each GOD score component,
 * then reports how many approved startups are missing each field
 * and what the score impact is.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  console.log('\n=== GOD Score Data Coverage Audit ===\n');

  // Fetch all approved startups — only the fields we need
  let allStartups = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select(`
        id, name, total_god_score,
        team_size, has_technical_cofounder, team_signals, founders,
        sectors, tam_estimate,
        pitch, tagline, description,
        revenue_annual, mrr, arr, arr_usd, revenue_usd,
        growth_rate, growth_rate_monthly,
        daily_active_users, weekly_active_users, customer_count, parsed_customers, parsed_users,
        is_launched, has_demo,
        has_revenue, has_customers, execution_signals,
        extracted_data, data_completeness,
        traction_score, team_score, market_score, product_score, vision_score
      `)
      .eq('status', 'approved')
      .range(from, from + PAGE - 1);

    if (error) { console.error(error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const total = allStartups.length;
  console.log(`Total approved startups: ${total}\n`);

  // ── Helper: check if a startup has a given field ──────────────────────────
  function has(s, field) {
    const v = s[field];
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return Boolean(v);
  }

  function hasExtracted(s, field) {
    const ext = s.extracted_data || {};
    const v = ext[field];
    if (v === null || v === undefined) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0;
    return Boolean(v);
  }

  function hasTractionBooleans(s) {
    const ext = s.extracted_data || {};
    return s.has_revenue || s.has_customers || s.is_launched ||
           ext.has_revenue || ext.has_customers || ext.is_launched ||
           (s.execution_signals?.length > 0) || (ext.execution_signals?.length > 0);
  }

  function hasTractionNumbers(s) {
    const ext = s.extracted_data || {};
    return (s.revenue_annual > 0) || (s.revenue_usd > 0) ||
           (s.mrr > 0) || (s.arr > 0) || (s.arr_usd > 0) ||
           (ext.revenue > 0) || (ext.mrr > 0) || (ext.arr > 0) || (ext.gmv > 0) ||
           (s.daily_active_users > 0) || (s.weekly_active_users > 0) ||
           (s.customer_count > 0) || (s.parsed_customers > 0) || (s.parsed_users > 0) ||
           (ext.active_users > 0) || (ext.customers > 0) ||
           (s.growth_rate > 0) || (s.growth_rate_monthly > 0) || (ext.growth_rate > 0);
  }

  function hasAnyTraction(s) {
    return hasTractionNumbers(s) || hasTractionBooleans(s);
  }

  function hasIndustries(s) {
    const ext = s.extracted_data || {};
    return (s.sectors?.length > 0) ||
           (ext.industries?.length > 0) || (ext.sectors?.length > 0);
  }

  function hasMarketText(s) {
    const ext = s.extracted_data || {};
    return (s.problem?.length > 30) || (s.solution?.length > 30) ||
           (s.value_proposition?.length > 30) || (ext.value_proposition?.length > 30) ||
           (s.pitch?.length > 50) || (ext.pitch?.length > 50) ||
           (s.description?.length > 50) || (ext.description?.length > 50);
  }

  function hasTeamData(s) {
    const ext = s.extracted_data || {};
    return (ext.team?.length > 0) ||
           (s.team_size > 0) || (ext.team_size > 0) ||
           (s.founders?.length > 0) || (ext.founders?.length > 0) ||
           s.has_technical_cofounder || ext.has_technical_cofounder ||
           (s.team_signals?.length > 0);
  }

  function hasProductSignals(s) {
    const ext = s.extracted_data || {};
    return s.is_launched || ext.is_launched || s.has_demo || ext.has_demo ||
           (s.solution?.length > 50) || (ext.solution?.length > 50);
  }

  function hasWebSignals(s) {
    const ext = s.extracted_data || {};
    return ext.web_signals && (
      (ext.web_signals.domain_authority > 0) ||
      (ext.web_signals.backlinks_count > 0) ||
      (ext.web_signals.traffic_estimate > 0) ||
      (ext.web_signals.tech_stack?.length > 0)
    );
  }

  // ── Count coverage ────────────────────────────────────────────────────────
  let noIndustries = 0;
  let noMarketText = 0;
  let noTeam = 0;
  let noTraction = 0;
  let noTractionNumbers = 0;  // subset: missing hard numbers
  let noProduct = 0;
  let noWebSignals = 0;
  let noName = 0;

  // Missing combinations (completely unscored)
  let zeroDataStartups = []; // missing 4+ of 5 components
  let sparseStartups = [];    // missing 2-3 components

  // Score buckets
  const buckets = { 0: 0, 40: 0, 50: 0, 60: 0, 70: 0, 80: 0 };

  for (const s of allStartups) {
    const score = s.total_god_score || 0;
    if (score < 40) buckets[0]++;
    else if (score < 50) buckets[40]++;
    else if (score < 60) buckets[50]++;
    else if (score < 70) buckets[60]++;
    else if (score < 80) buckets[70]++;
    else buckets[80]++;

    if (!has(s, 'name')) noName++;
    if (!hasIndustries(s)) noIndustries++;
    if (!hasMarketText(s)) noMarketText++;
    if (!hasTeamData(s)) noTeam++;
    if (!hasAnyTraction(s)) noTraction++;
    if (!hasTractionNumbers(s)) noTractionNumbers++;
    if (!hasProductSignals(s)) noProduct++;
    if (!hasWebSignals(s)) noWebSignals++;

    // Count how many components have data
    const componentsCovered = [
      hasIndustries(s),
      hasMarketText(s),
      hasTeamData(s),
      hasAnyTraction(s),
      hasProductSignals(s),
    ].filter(Boolean).length;

    if (componentsCovered <= 1) zeroDataStartups.push(s);
    else if (componentsCovered <= 3) sparseStartups.push(s);
  }

  const pct = (n) => `${n} (${Math.round(n/total*100)}%)`;

  console.log('━━━ COVERAGE BY SCORING COMPONENT ━━━\n');
  console.log('Component          | Missing    | Max pts | Scoring impact');
  console.log('──────────────────────────────────────────────────────────');
  console.log(`Industries/Sector  | ${pct(noIndustries).padEnd(10)} | 1-2 pts | Hot sector = +10 GOD`);
  console.log(`Market text        | ${pct(noMarketText).padEnd(10)} | 0.5 pts | Problem/solution clarity`);
  console.log(`Team data          | ${pct(noTeam).padEnd(10)} | 3 pts   | Team execution score = 0`);
  console.log(`Traction (any)     | ${pct(noTraction).padEnd(10)} | 3 pts   | Traction score = 0 or pattern-only`);
  console.log(`  └ Hard numbers   | ${pct(noTractionNumbers).padEnd(10)} |         | Revenue/MRR/users/growth`);
  console.log(`Product signals    | ${pct(noProduct).padEnd(10)} | 2 pts   | launched/demo/solution`);
  console.log(`Web signals        | ${pct(noWebSignals).padEnd(10)} | ~1 pt   | DA/backlinks/traffic`);
  console.log();

  console.log('━━━ SCORE DISTRIBUTION ━━━\n');
  console.log(`<40  (no data):  ${buckets[0].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[0]/total*50))}`);
  console.log(`40-49 (minimal): ${buckets[40].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[40]/total*50))}`);
  console.log(`50-59 (sparse):  ${buckets[50].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[50]/total*50))}`);
  console.log(`60-69 (decent):  ${buckets[60].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[60]/total*50))}`);
  console.log(`70-79 (good):    ${buckets[70].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[70]/total*50))}`);
  console.log(`80+  (elite):    ${buckets[80].toString().padStart(5)} | ${'█'.repeat(Math.round(buckets[80]/total*50))}`);
  console.log();

  console.log('━━━ ZERO/SPARSE DATA STARTUPS ━━━\n');
  console.log(`Near-zero data (≤1 of 5 components): ${zeroDataStartups.length}`);
  console.log(`Sparse data (2-3 of 5 components):    ${sparseStartups.length}`);
  console.log();

  // Show worst 15
  if (zeroDataStartups.length > 0) {
    console.log('Bottom 15 zero-data startups (candidates for rejection or enrichment):');
    zeroDataStartups
      .sort((a, b) => (a.total_god_score || 0) - (b.total_god_score || 0))
      .slice(0, 15)
      .forEach(s => {
        const ext = s.extracted_data || {};
        const flags = [
          hasIndustries(s) ? 'sector' : '     ',
          hasMarketText(s) ? 'text ' : '     ',
          hasTeamData(s)   ? 'team ' : '     ',
          hasAnyTraction(s)? 'tract' : '     ',
          hasProductSignals(s) ? 'prod' : '    ',
        ].join(' ');
        console.log(`  [${(s.total_god_score || 0).toString().padStart(2)}] ${s.name?.substring(0, 40).padEnd(40)} [${flags}]`);
      });
  }

  console.log();
  console.log('━━━ MINIMUM VIABLE DATASET DEFINITION ━━━\n');
  console.log('A startup needs AT LEAST these to score properly:');
  console.log('  1. industries/sectors    — for sector match (+10 GOD for hot sector)');
  console.log('  2. problem OR solution   — for market/product clarity (+0.5-1 pt)');
  console.log('  3. pitch/description     — for traction text pattern scoring (+0.5-1 pt)');
  console.log('  4. team_size OR team[]   — for team execution score (+0.2-3 pts)');
  console.log('  5. ONE traction signal   — launched/has_revenue/has_customers/revenue/users');
  console.log();

  // Compute potential score lift
  const avgCurrent = allStartups.reduce((s, r) => s + (r.total_god_score || 0), 0) / total;
  const withMVD = allStartups.filter(s =>
    hasIndustries(s) && hasMarketText(s) && hasTeamData(s) && hasAnyTraction(s)
  );
  const avgMVD = withMVD.length > 0
    ? withMVD.reduce((s, r) => s + (r.total_god_score || 0), 0) / withMVD.length
    : 0;

  console.log(`Current avg GOD score (all ${total}):           ${avgCurrent.toFixed(1)}`);
  console.log(`Avg score for ${withMVD.length} startups with MVD:  ${avgMVD.toFixed(1)}`);
  console.log(`Potential avg lift if we enriched all:     +${(avgMVD - avgCurrent).toFixed(1)} pts`);
  console.log(`Startups missing MVD:                      ${total - withMVD.length} (${Math.round((total - withMVD.length)/total*100)}%)`);
}

main().catch(err => { console.error(err); process.exit(1); });
