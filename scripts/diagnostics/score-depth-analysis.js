#!/usr/bin/env node
/**
 * Deep diagnostic: WHY are GOD scores low?
 * Examines data completeness, component score breakdown, and identifies
 * what data fields are missing that would unlock higher scores.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Fetch all approved startups
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, description, pitch, tagline, website, mrr, arr, customer_count, growth_rate_monthly, team_size, has_technical_cofounder, is_launched, has_demo, sectors, extracted_data')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log('='.repeat(70));
  console.log('  DEEP DIAGNOSTIC: WHY ARE GOD SCORES LOW?');
  console.log('='.repeat(70));
  console.log(`Total startups: ${all.length}\n`);

  // ── 1. DATA COMPLETENESS AUDIT ──
  console.log('DATA COMPLETENESS (% of startups with each field):');
  const fields = [
    { name: 'description/pitch', check: s => (s.description || s.pitch || '').length > 20 },
    { name: 'description > 200 chars', check: s => (s.description || s.pitch || '').length > 200 },
    { name: 'problem statement', check: s => !!((s.extracted_data || {}).problem) },
    { name: 'solution statement', check: s => !!((s.extracted_data || {}).solution) },
    { name: 'tagline/VP', check: s => !!(s.tagline || (s.extracted_data || {}).value_proposition) },
    { name: 'website', check: s => !!(s.website) },
    { name: 'MRR or ARR', check: s => (s.mrr > 0 || s.arr > 0 || (s.extracted_data || {}).revenue > 0) },
    { name: 'customer_count', check: s => s.customer_count > 0 },
    { name: 'growth_rate', check: s => s.growth_rate_monthly > 0 },
    { name: 'team_size', check: s => s.team_size > 0 },
    { name: 'team_companies', check: s => ((s.extracted_data || {}).team_companies || []).length > 0 },
    { name: 'has_technical_cofounder', check: s => !!s.has_technical_cofounder },
    { name: 'is_launched', check: s => !!s.is_launched },
    { name: 'has_demo', check: s => !!s.has_demo },
    { name: 'founded_date', check: s => !!((s.extracted_data || {}).founded_date) },
    { name: 'backed_by', check: s => !!((s.extracted_data || {}).backed_by) },
    { name: 'funding_amount', check: s => (s.extracted_data || {}).funding_amount > 0 },
    { name: 'sectors (non-empty)', check: s => (s.sectors || []).length > 0 },
    { name: 'extracted_data exists', check: s => !!(s.extracted_data && Object.keys(s.extracted_data).length > 0) },
    { name: 'has_revenue (in extracted)', check: s => !!(s.extracted_data || {}).has_revenue },
    { name: 'has_customers (in extracted)', check: s => !!(s.extracted_data || {}).has_customers },
    { name: 'execution_signals (in ext)', check: s => ((s.extracted_data || {}).execution_signals || []).length > 0 },
    { name: 'team_signals (in ext)', check: s => ((s.extracted_data || {}).team_signals || []).length > 0 },
  ];

  for (const f of fields) {
    const count = all.filter(f.check).length;
    const pct = (count / all.length * 100).toFixed(1);
    const bar = '#'.repeat(Math.round(count / all.length * 40));
    console.log(`  ${f.name.padEnd(30)} ${count.toString().padStart(5)} (${pct.padStart(5)}%) ${bar}`);
  }

  // ── 2. COMPONENT SCORE ZERO ANALYSIS ──
  console.log('\nCOMPONENT SCORE ZEROS (how many startups score 0 in each component):');
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  for (const comp of components) {
    const zeros = all.filter(s => (s[comp] || 0) === 0).length;
    const pct = (zeros / all.length * 100).toFixed(1);
    console.log(`  ${comp.padEnd(20)} ${zeros.toString().padStart(5)} zeros (${pct}%)`);
  }

  // ── 3. WHAT WOULD MOVE THE NEEDLE ──
  console.log('\nSCORE POTENTIAL: What data would unlock higher scores?');
  
  // Count startups at floor (40) with websites that could be scraped
  const atFloor = all.filter(s => s.total_god_score === 40);
  const floorWithWebsite = atFloor.filter(s => s.website && s.website.length > 5);
  const floorNoData = atFloor.filter(s => !s.description && !s.pitch && !(s.extracted_data || {}).description);
  const floorThinDesc = atFloor.filter(s => (s.description || s.pitch || '').length < 50);
  
  console.log(`  At floor (40): ${atFloor.length}`);
  console.log(`  At floor WITH website: ${floorWithWebsite.length} (could rescrape for more data)`);
  console.log(`  At floor with no description: ${floorNoData.length}`);
  console.log(`  At floor with thin description (<50 chars): ${floorThinDesc.length}`);

  // Startups 41-49 that have websites but missing key data
  const low = all.filter(s => s.total_god_score >= 41 && s.total_god_score <= 49);
  const lowWithWebsite = low.filter(s => s.website && s.website.length > 5);
  const lowMissingProblem = low.filter(s => !(s.extracted_data || {}).problem);
  const lowMissingTraction = low.filter(s => s.traction_score === 0);
  
  console.log(`\n  Score 41-49: ${low.length}`);
  console.log(`  41-49 WITH website: ${lowWithWebsite.length} (rescrape candidates)`);
  console.log(`  41-49 missing problem: ${lowMissingProblem.length}`);
  console.log(`  41-49 traction=0: ${lowMissingTraction.length}`);

  // ── 4. RESCRAPE IMPACT ESTIMATE ──
  console.log('\nRESCRAPE IMPACT ESTIMATE:');
  const withWebsite = all.filter(s => s.website && s.website.length > 5);
  const withWebsiteMissingData = withWebsite.filter(s => {
    const missing = [];
    const ext = s.extracted_data || {};
    if (!ext.problem) missing.push('problem');
    if (!ext.solution) missing.push('solution');
    if (!((s.description || '').length > 100)) missing.push('description');
    if (!ext.backed_by) missing.push('investors');
    if (!s.is_launched) missing.push('launched');
    return missing.length >= 2;
  });
  console.log(`  Total with website: ${withWebsite.length}`);
  console.log(`  With website + missing 2+ data fields: ${withWebsiteMissingData.length}`);
  console.log(`  These are prime candidates for rescraping.`);

  // ── 5. BACHELOR POTENTIAL ANALYSIS ──
  console.log('\nBACHELOR POTENTIAL (45-59 range analysis):');
  const bachelors = all.filter(s => s.total_god_score >= 45 && s.total_god_score <= 59);
  console.log(`  Total Bachelors: ${bachelors.length}`);
  
  // Find bachelors with strong individual components
  const bachelorHotPotential = bachelors.filter(s => {
    const maxComp = Math.max(s.team_score || 0, s.traction_score || 0, s.market_score || 0, s.product_score || 0, s.vision_score || 0);
    return maxComp >= 60; // Has at least one strong dimension
  });
  console.log(`  Bachelors with 1+ component ≥60: ${bachelorHotPotential.length} (have potential to be "hot")`);

  // Bachelors with 2+ strong components
  const bachelorMultiStrong = bachelors.filter(s => {
    let strong = 0;
    if ((s.team_score || 0) >= 50) strong++;
    if ((s.traction_score || 0) >= 50) strong++;
    if ((s.market_score || 0) >= 50) strong++;
    if ((s.product_score || 0) >= 50) strong++;
    if ((s.vision_score || 0) >= 50) strong++;
    return strong >= 2;
  });
  console.log(`  Bachelors with 2+ components ≥50: ${bachelorMultiStrong.length} (strong candidates)`);

  // ── 6. SAMPLE: HIGH-POTENTIAL STARTUPS STUCK AT LOW SCORES ──
  console.log('\nSAMPLE: STARTUPS WITH POTENTIAL STUCK AT LOW SCORES:');
  
  // Sort by "potential" = sum of component scores, then filter to low total
  const potentialStuck = all
    .map(s => ({
      name: s.name,
      god: s.total_god_score,
      team: s.team_score || 0,
      traction: s.traction_score || 0,
      market: s.market_score || 0,
      product: s.product_score || 0,
      vision: s.vision_score || 0,
      website: s.website ? 'yes' : 'no',
      hasDesc: (s.description || s.pitch || '').length > 50 ? 'yes' : 'no',
      potential: (s.team_score || 0) + (s.traction_score || 0) + (s.market_score || 0) + (s.product_score || 0) + (s.vision_score || 0),
    }))
    .filter(s => s.god <= 55 && s.potential >= 120)
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 20);

  for (const s of potentialStuck) {
    console.log(`  GOD ${s.god} | ${s.name.substring(0, 30).padEnd(30)} | T:${s.team} Tr:${s.traction} M:${s.market} P:${s.product} V:${s.vision} | Σ${s.potential} | web:${s.website} desc:${s.hasDesc}`);
  }

  // ── 7. SCORE BOTTLENECK ANALYSIS ──
  console.log('\nSCORE BOTTLENECK: Which component drags scores down most?');
  const avgComps = {};
  for (const comp of components) {
    const avg = all.reduce((sum, s) => sum + (s[comp] || 0), 0) / all.length;
    avgComps[comp] = avg;
    console.log(`  ${comp.padEnd(20)} avg: ${avg.toFixed(1)}`);
  }
  const weakest = Object.entries(avgComps).sort((a, b) => a[1] - b[1]);
  console.log(`  → Weakest: ${weakest[0][0]} (${weakest[0][1].toFixed(1)}), then ${weakest[1][0]} (${weakest[1][1].toFixed(1)})`);
}

main().catch(console.error);
