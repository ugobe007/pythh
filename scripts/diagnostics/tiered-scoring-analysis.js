/**
 * TIERED SCORING ANALYSIS
 * ========================
 * READ-ONLY — does NOT modify any scores.
 *
 * Answers: "Do different startups need different divisors/multipliers?"
 * 
 * Analyzes:
 *   1. Data richness distribution — how many fields does each startup actually have?
 *   2. Correlation between data richness and GOD score
 *   3. Where are the "garbage in" startups vs real performers?
 *   4. How do scoring components behave across tiers?
 *   5. What would tier-specific divisors look like?
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Data richness scoring (what the GOD scorer actually reads) ──
function measureDataRichness(s) {
  const ext = s.extracted_data || {};
  // These are the fields calculateHotScore actually uses
  const checks = [
    // Basic profile (VIBE inputs)
    { name: 'value_proposition', has: !!(ext.value_proposition && ext.value_proposition.length > 10) || !!(s.tagline && s.tagline.length > 10) },
    { name: 'problem', has: !!(ext.problem && ext.problem.length > 10) },
    { name: 'solution', has: !!(ext.solution && ext.solution.length > 10) },
    { name: 'pitch/description', has: !!((s.pitch || s.description) && (s.pitch || s.description).length > 10) },
    { name: 'market_size', has: !!(ext.market_size) },
    { name: 'industries/sectors', has: !!(s.sectors && s.sectors.length > 0) || !!(ext.industries && ext.industries.length > 0) },
    { name: 'tagline', has: !!(s.tagline && s.tagline.length > 5) },
    { name: 'website', has: !!(s.website && s.website.length > 5) },
    
    // Team signals (scoreTeam, scoreFounderAge, scoreFounderCourage, scoreFounderSpeed)
    { name: 'team_size', has: !!(s.team_size && s.team_size > 0) },
    { name: 'has_technical_cofounder', has: !!(s.has_technical_cofounder) },
    { name: 'team_companies', has: !!(ext.team_companies && ext.team_companies.length > 0) },
    { name: 'founded_date', has: !!(ext.founded_date || s.created_at) },
    { name: 'founder_avg_age', has: !!(s.founder_avg_age) },
    { name: 'founder_courage', has: !!(ext.founder_courage) },
    
    // Traction signals (scoreTraction) 
    { name: 'mrr', has: !!(s.mrr && s.mrr > 0) },
    { name: 'revenue/arr', has: !!(s.arr && s.arr > 0) || !!(ext.revenue && ext.revenue > 0) },
    { name: 'growth_rate', has: !!(s.growth_rate_monthly || ext.growth_rate) },
    { name: 'customer_count', has: !!(s.customer_count && s.customer_count > 0) },
    { name: 'active_users', has: !!(ext.active_users && ext.active_users > 0) },
    { name: 'is_launched', has: !!(s.is_launched) },
    
    // Product signals (scoreProduct)
    { name: 'has_demo', has: !!(s.has_demo) },
    { name: 'unique_ip', has: !!(ext.unique_ip) },
    { name: 'defensibility', has: !!(ext.defensibility) },
    
    // Market signals (scoreMarket, scoreUniqueInsight)
    { name: 'backed_by', has: !!(ext.backed_by && ext.backed_by.length > 0) || !!(s.lead_investor) },
    { name: 'previous_funding', has: !!(s.latest_funding_amount && s.latest_funding_amount > 0) },
    { name: 'funding_stage', has: !!(s.latest_funding_round) },
    
    // Behavioral (psych)
    { name: 'fomo_signal', has: !!(s.fomo_signal_strength && s.fomo_signal_strength > 0) },
    { name: 'conviction_signal', has: !!(s.conviction_signal_strength && s.conviction_signal_strength > 0) },
  ];
  
  const fieldCount = checks.filter(c => c.has).length;
  const totalFields = checks.length;
  const completeness = fieldCount / totalFields;
  const presentFields = checks.filter(c => c.has).map(c => c.name);
  const missingFields = checks.filter(c => !c.has).map(c => c.name);
  
  // Tier based on data richness
  let tier;
  if (completeness >= 0.60) tier = 'A-Rich';
  else if (completeness >= 0.40) tier = 'B-Standard';
  else if (completeness >= 0.25) tier = 'C-Sparse';
  else tier = 'D-Minimal';
  
  return { fieldCount, totalFields, completeness, tier, presentFields, missingFields };
}

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(values) {
  if (!values.length) return { count:0, avg:0, median:0, min:0, max:0, p10:0, p25:0, p75:0, p90:0 };
  const sorted = [...values].sort((a,b) => a - b);
  const sum = sorted.reduce((s,v) => s + v, 0);
  return {
    count: sorted.length,
    avg: +(sum / sorted.length).toFixed(1),
    median: +percentile(sorted, 50).toFixed(1),
    min: +sorted[0].toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
    p10: +percentile(sorted, 10).toFixed(1),
    p25: +percentile(sorted, 25).toFixed(1),
    p75: +percentile(sorted, 75).toFixed(1),
    p90: +percentile(sorted, 90).toFixed(1),
  };
}

async function main() {
  console.log('📊 TIERED SCORING ANALYSIS (READ-ONLY)\n');
  
  // Fetch all approved startups with ALL relevant fields
  let all = [];
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus, psychological_multiplier, enhanced_god_score, pitch, description, tagline, website, team_size, has_technical_cofounder, founder_avg_age, mrr, arr, growth_rate_monthly, customer_count, is_launched, has_demo, sectors, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength, pivots_made, extracted_data, latest_funding_amount, latest_funding_round, lead_investor, has_revenue, has_customers, growth_rate, nps_score, users_who_would_be_very_disappointed, organic_referral_rate, dau_wau_ratio, experiments_run_last_month, hypotheses_validated, pivot_speed_days, status')
      .eq('status', 'approved')
      .range(page * PS, (page+1) * PS - 1);
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PS) break;
    page++;
  }
  
  console.log(`Loaded: ${all.length} approved startups\n`);
  
  // ── 1. Data richness distribution ──
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 1: DATA RICHNESS DISTRIBUTION');
  console.log('  (How many of the 28 scoring-relevant fields does each startup have?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const enriched = all.map(s => ({
    ...s,
    _richness: measureDataRichness(s),
  }));
  
  const tiers = { 'A-Rich': [], 'B-Standard': [], 'C-Sparse': [], 'D-Minimal': [] };
  for (const s of enriched) {
    tiers[s._richness.tier].push(s);
  }
  
  for (const [tier, startups] of Object.entries(tiers)) {
    const pct = ((startups.length / all.length) * 100).toFixed(1);
    const fieldCounts = startups.map(s => s._richness.fieldCount);
    const fStats = stats(fieldCounts);
    console.log(`  ${tier}: ${startups.length} startups (${pct}%)`);
    console.log(`    Fields populated: avg=${fStats.avg}  median=${fStats.median}  [${fStats.min}..${fStats.max}] out of 28`);
    
    // GOD score distribution in this tier
    const godScores = startups.map(s => s.total_god_score || 40);
    const gStats = stats(godScores);
    console.log(`    GOD scores: avg=${gStats.avg}  median=${gStats.median}  [${gStats.min}..${gStats.max}]  p10=${gStats.p10}  p90=${gStats.p90}`);
    
    // At floor
    const atFloor = godScores.filter(v => v === 40).length;
    console.log(`    At floor (40): ${atFloor} (${((atFloor / startups.length) * 100).toFixed(1)}%)\n`);
  }
  
  // ── 2. Component score behavior by tier ──
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 2: COMPONENT SCORES BY DATA TIER');
  console.log('  (Do components behave differently for rich vs sparse startups?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  
  for (const [tier, startups] of Object.entries(tiers)) {
    if (startups.length === 0) continue;
    console.log(`  ${tier} (${startups.length} startups):`);
    for (const comp of components) {
      const vals = startups.map(s => s[comp] || 0);
      const st = stats(vals);
      console.log(`    ${comp.padEnd(18)} avg=${String(st.avg).padStart(5)}  median=${String(st.median).padStart(5)}  p10=${String(st.p10).padStart(5)}  p90=${String(st.p90).padStart(5)}`);
    }
    console.log('');
  }
  
  // ── 3. The "garbage identification" analysis ──
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 3: GARBAGE IDENTIFICATION');
  console.log('  (Separating genuinely sparse startups from low-quality entries)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Startups with GOD=40 (floor) — are they garbage or just data-poor?
  const floorStartups = enriched.filter(s => s.total_god_score === 40);
  const aboveFloor = enriched.filter(s => s.total_god_score > 40);
  
  console.log(`  Floor startups (score=40): ${floorStartups.length}`);
  const floorTierDist = {};
  for (const s of floorStartups) {
    floorTierDist[s._richness.tier] = (floorTierDist[s._richness.tier] || 0) + 1;
  }
  for (const [t, c] of Object.entries(floorTierDist)) {
    console.log(`    ${t}: ${c} (${((c / floorStartups.length) * 100).toFixed(1)}%)`);
  }
  
  // Check: do any floor startups actually have decent data?
  const floorWithData = floorStartups.filter(s => s._richness.completeness >= 0.25);
  console.log(`\n  Floor startups WITH reasonable data (≥25% fields): ${floorWithData.length}`);
  if (floorWithData.length > 0) {
    console.log('  These are potentially UNDERSCORED — they have data but still hit floor:');
    const sample = floorWithData.slice(0, 10);
    for (const s of sample) {
      const r = s._richness;
      console.log(`    ${s.name?.substring(0,30).padEnd(30) || 'unknown'.padEnd(30)} ${r.fieldCount}/${r.totalFields} fields  present: ${r.presentFields.join(', ')}`);
    }
  }
  
  console.log(`\n  Above-floor startups (score>40): ${aboveFloor.length}`);
  const aboveTierDist = {};
  for (const s of aboveFloor) {
    aboveTierDist[s._richness.tier] = (aboveTierDist[s._richness.tier] || 0) + 1;
  }
  for (const [t, c] of Object.entries(aboveTierDist)) {
    console.log(`    ${t}: ${c} (${((c / aboveFloor.length) * 100).toFixed(1)}%)`);
  }
  
  // ── 4. The effective rawTotal range by tier ──
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 4: EFFECTIVE RAWTOTAL BY TIER');
  console.log('  (Back-calculated: rawTotal ≈ (GOD/100) × 25)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  for (const [tier, startups] of Object.entries(tiers)) {
    if (startups.length === 0) continue;
    const rawTotals = startups.map(s => {
      const god = Math.max((s.total_god_score || 40) - Math.min(s.signals_bonus || 0, 10), 40);
      return (god / 100) * 25;
    });
    const st = stats(rawTotals);
    console.log(`  ${tier}: rawTotal avg=${st.avg}  median=${st.median}  [${st.min}..${st.max}]  p90=${st.p90}`);
    
    // What divisor would give this tier a centered distribution?
    // Target: avg GOD ≈ 55 for each tier (same center, different precision)
    const targetAvg = 55;
    const idealDivisor = (st.avg / (targetAvg / 100)) / 10;
    console.log(`    To center this tier at ~55 avg: divisor ≈ ${idealDivisor.toFixed(1)}`);
  }
  
  // ── 5. What field combinations distinguish high vs low performers? ──
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 5: FIELD PATTERNS THAT PREDICT HIGH SCORES');
  console.log('  (Which fields matter most for separating good from bad?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const highPerformers = enriched.filter(s => s.total_god_score >= 60);
  const lowPerformers = enriched.filter(s => s.total_god_score <= 45);
  
  const allFieldNames = enriched[0]?._richness ? measureDataRichness(all[0]) : null;
  if (allFieldNames) {
    // Check each field: what % of high performers have it vs low performers?
    const checks = [
      'value_proposition', 'problem', 'solution', 'pitch/description', 'market_size',
      'industries/sectors', 'tagline', 'website', 'team_size', 'has_technical_cofounder',
      'team_companies', 'founded_date', 'founder_avg_age', 'founder_courage',
      'mrr', 'revenue/arr', 'growth_rate', 'customer_count', 'active_users', 'is_launched',
      'has_demo', 'unique_ip', 'defensibility', 'backed_by', 'previous_funding', 'funding_stage',
      'fomo_signal', 'conviction_signal'
    ];
    
    console.log(`  ${'Field'.padEnd(25)} ${'High (≥60)'.padStart(12)} ${'Low (≤45)'.padStart(12)}  ${'Lift'.padStart(8)}`);
    console.log(`  ${'─'.repeat(60)}`);
    
    const fieldAnalysis = [];
    for (const fieldName of checks) {
      const highHas = highPerformers.filter(s => s._richness.presentFields.includes(fieldName)).length;
      const lowHas = lowPerformers.filter(s => s._richness.presentFields.includes(fieldName)).length;
      const highPct = highPerformers.length > 0 ? (highHas / highPerformers.length * 100) : 0;
      const lowPct = lowPerformers.length > 0 ? (lowHas / lowPerformers.length * 100) : 0;
      const lift = highPct - lowPct;
      fieldAnalysis.push({ fieldName, highPct, lowPct, lift });
    }
    
    // Sort by lift (biggest difference between high and low performers)
    fieldAnalysis.sort((a, b) => b.lift - a.lift);
    for (const f of fieldAnalysis) {
      const marker = f.lift > 20 ? ' ★★★' : f.lift > 10 ? ' ★★' : f.lift > 5 ? ' ★' : '';
      console.log(`  ${f.fieldName.padEnd(25)} ${(f.highPct.toFixed(1)+'%').padStart(12)} ${(f.lowPct.toFixed(1)+'%').padStart(12)}  ${('+'+f.lift.toFixed(1)).padStart(8)}${marker}`);
    }
  }
  
  // ── 6. Tiered divisor simulation ──
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 6: TIERED DIVISOR SIMULATION');
  console.log('  (What if each data tier had its own divisor?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Current: everyone uses divisor 25.0
  // Proposal: tier-specific divisors that reward rich data
  const tierDivisors = {
    'A-Rich':     { divisor: 20.0, label: 'Rich data → lower divisor → higher scores (reward quality data)' },
    'B-Standard': { divisor: 25.0, label: 'Standard data → current divisor (baseline)' },
    'C-Sparse':   { divisor: 28.0, label: 'Sparse data → higher divisor → compressed (less certainty)' },
    'D-Minimal':  { divisor: 30.0, label: 'Minimal data → highest divisor (very uncertain)' },
  };
  
  console.log('  Scenario: Tier-specific divisors\n');
  
  let allSimulated = [];
  for (const [tier, startups] of Object.entries(tiers)) {
    if (startups.length === 0) continue;
    const cfg = tierDivisors[tier];
    
    const current = startups.map(s => s.total_god_score || 40);
    const simulated = startups.map(s => {
      const signals = Math.min(s.signals_bonus || 0, 10);
      const baseGod = Math.max((s.total_god_score || 40) - signals, 40);
      const rawTotal = (baseGod / 100) * 25; // back-calculate
      const newGod = Math.min((rawTotal / cfg.divisor) * 10, 10) * 10;
      return Math.min(Math.round(Math.max(newGod, 40) + signals), 100);
    });
    allSimulated.push(...simulated);
    
    const curStats = stats(current);
    const simStats = stats(simulated);
    const curFloor = current.filter(v => v === 40).length;
    const simFloor = simulated.filter(v => v === 40).length;
    
    console.log(`  ${tier} (divisor=${cfg.divisor}): ${cfg.label}`);
    console.log(`    Current:   avg=${curStats.avg}  median=${curStats.median}  floor=${curFloor} (${((curFloor/startups.length)*100).toFixed(1)}%)`);
    console.log(`    Simulated: avg=${simStats.avg}  median=${simStats.median}  floor=${simFloor} (${((simFloor/startups.length)*100).toFixed(1)}%)`);
    console.log(`    Change:    avg ${simStats.avg > curStats.avg ? '+' : ''}${(simStats.avg - curStats.avg).toFixed(1)}  floor ${simFloor - curFloor > 0 ? '+' : ''}${simFloor - curFloor}\n`);
  }
  
  // Overall distribution for tiered vs current
  const allCurrent = enriched.map(s => s.total_god_score || 40);
  const allCurStats = stats(allCurrent);
  const allSimStats = stats(allSimulated);
  console.log(`  OVERALL COMPARISON:`);
  console.log(`    Current (flat div=25): avg=${allCurStats.avg}  median=${allCurStats.median}  p10=${allCurStats.p10}  p90=${allCurStats.p90}`);
  console.log(`    Tiered divisors:       avg=${allSimStats.avg}  median=${allSimStats.median}  p10=${allSimStats.p10}  p90=${allSimStats.p90}`);
  
  // ── 7. Psych/Behavioral signal readiness ──
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 7: BEHAVIORAL SIGNAL READINESS (PSYCH + WHISPER)');
  console.log('  (Are investor behavior signals populated? What data exists?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const psychFields = ['fomo_signal_strength', 'conviction_signal_strength', 'urgency_signal_strength', 'risk_signal_strength'];
  for (const f of psychFields) {
    const nonZero = all.filter(s => s[f] && s[f] > 0).length;
    const pct = ((nonZero / all.length) * 100).toFixed(1);
    console.log(`  ${f.padEnd(30)} ${nonZero} / ${all.length} (${pct}%)`);
  }
  
  const hasPsychMult = all.filter(s => s.psychological_multiplier && s.psychological_multiplier > 0).length;
  console.log(`\n  psychological_multiplier > 0:  ${hasPsychMult} / ${all.length} (${((hasPsychMult/all.length)*100).toFixed(1)}%)`);
  
  const hasEnhanced = all.filter(s => s.enhanced_god_score && s.enhanced_god_score !== s.total_god_score).length;
  console.log(`  enhanced ≠ base:              ${hasEnhanced} / ${all.length} (${((hasEnhanced/all.length)*100).toFixed(1)}%)`);
  
  // ── Summary ──
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY: THE CASE FOR TIERED SCORING');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  CURRENT PROBLEM:');
  console.log('  One divisor (25.0) treats all 7,003 startups identically.');
  console.log('  Result: 47% stuck at floor because sparse data → low rawTotal → floor.');
  console.log('  Meanwhile, data-rich startups that SHOULD score 80+ are capped at ~70.');
  console.log('');
  console.log('  TIERED APPROACH:');
  console.log('  ┌─────────────┬──────────┬──────────────────────────────────────┐');
  console.log('  │ Tier        │ Divisor  │ Effect                               │');
  console.log('  ├─────────────┼──────────┼──────────────────────────────────────┤');
  console.log('  │ A-Rich      │ 20.0     │ Reward quality data, full range      │');
  console.log('  │ B-Standard  │ 25.0     │ Current baseline                     │');
  console.log('  │ C-Sparse    │ 28.0     │ Compress (less certainty)            │');
  console.log('  │ D-Minimal   │ 30.0     │ Highest compression (most uncertain) │');
  console.log('  └─────────────┴──────────┴──────────────────────────────────────┘');
  console.log('');
  console.log('  SEPARATION OF CONCERNS:');
  console.log('  • GOD Score (tiered divisors)  → Startup quality (what IS)');
  console.log('  • Signals + Whispers           → Market intelligence (what\'s HAPPENING)');
  console.log('  • Psych/Behavioral             → Investor behavior (who\'s ACTING)');
  console.log('  All three layers are additive but serve different purposes.');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
