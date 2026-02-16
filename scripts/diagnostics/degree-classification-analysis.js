/**
 * STARTUP DEGREE CLASSIFICATION ANALYSIS
 * ========================================
 * READ-ONLY — does NOT modify any scores.
 *
 * Profiles the PhD-level startups (80+) to understand what earned their score,
 * then maps the full population into degree tiers and identifies:
 *   - What the PhD profile looks like (the gold standard)
 *   - Who's "studying for their Masters" (forward movement signals)
 *   - Where the Bachelors startups plateau vs progress
 *   - What separates each tier from the next
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

function fieldPresenceRate(startups, fieldCheck) {
  if (!startups.length) return 0;
  return +(startups.filter(fieldCheck).length / startups.length * 100).toFixed(1);
}

// Measure "forward movement" — evidence of studying for the next degree
function measureMomentum(s) {
  const ext = s.extracted_data || {};
  let signals = [];
  let score = 0;
  
  // Revenue trajectory (has revenue AND growth)
  if ((s.mrr > 0 || s.arr > 0) && s.growth_rate_monthly > 0) {
    signals.push('revenue+growth');
    score += 2;
  } else if (s.mrr > 0 || s.arr > 0) {
    signals.push('has_revenue');
    score += 1;
  } else if (s.has_revenue) {
    signals.push('revenue_claimed');
    score += 0.5;
  }
  
  // Customer trajectory
  if (s.customer_count > 0 && s.customer_growth_monthly > 0) {
    signals.push('customers+growth');
    score += 2;
  } else if (s.customer_count > 0) {
    signals.push('has_customers');
    score += 1;
  } else if (s.has_customers) {
    signals.push('customers_claimed');
    score += 0.5;
  }
  
  // Product maturity
  if (s.is_launched && s.has_demo) {
    signals.push('launched+demo');
    score += 1.5;
  } else if (s.is_launched) {
    signals.push('launched');
    score += 1;
  }
  
  // Team depth
  if (s.has_technical_cofounder && s.team_size >= 3) {
    signals.push('strong_team');
    score += 1.5;
  } else if (s.has_technical_cofounder || s.team_size >= 3) {
    signals.push('some_team');
    score += 0.75;
  }
  
  // Founder age signal
  if (s.founder_avg_age && s.founder_avg_age > 0) {
    signals.push('founder_age_known');
    score += 0.5;
  }
  
  // Funding progression
  if (s.latest_funding_amount > 0) {
    signals.push('funded');
    score += 1;
    if (s.latest_funding_round && ['series_a','series_b','series_c'].includes(s.latest_funding_round.toLowerCase().replace(/\s/g,'_'))) {
      signals.push('later_stage');
      score += 1;
    }
  }
  
  // Data completeness momentum (fields being filled = doing homework)
  const fieldCount = [
    s.tagline, s.pitch || s.description, s.website,
    s.mrr, s.arr, s.customer_count, s.growth_rate_monthly,
    s.team_size, s.has_technical_cofounder, s.founder_avg_age,
    s.is_launched, s.has_demo, s.sectors?.length > 0,
    s.latest_funding_amount, s.nps_score, s.experiments_run_last_month,
  ].filter(v => v !== null && v !== undefined && v !== false && v !== 0 && v !== '').length;
  
  if (fieldCount >= 12) { signals.push('data_rich'); score += 2; }
  else if (fieldCount >= 8) { signals.push('data_good'); score += 1; }
  else if (fieldCount >= 5) { signals.push('data_partial'); score += 0.5; }
  
  // Scoring component balance (multiple strong areas = well-rounded)
  const compAbove50 = [s.team_score, s.traction_score, s.market_score, s.product_score, s.vision_score]
    .filter(v => v && v >= 50).length;
  if (compAbove50 >= 4) { signals.push('balanced_strong'); score += 1.5; }
  else if (compAbove50 >= 3) { signals.push('balanced_moderate'); score += 1; }
  else if (compAbove50 >= 2) { signals.push('developing'); score += 0.5; }
  
  return { score: Math.min(score, 15), signals, fieldCount };
}

async function main() {
  console.log('🎓 STARTUP DEGREE CLASSIFICATION ANALYSIS (READ-ONLY)\n');
  
  let all = [];
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus, psychological_multiplier, enhanced_god_score, pitch, description, tagline, website, team_size, has_technical_cofounder, founder_avg_age, mrr, arr, growth_rate_monthly, customer_count, customer_growth_monthly, is_launched, has_demo, has_revenue, has_customers, sectors, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength, latest_funding_amount, latest_funding_round, lead_investor, nps_score, users_who_would_be_very_disappointed, organic_referral_rate, dau_wau_ratio, experiments_run_last_month, hypotheses_validated, pivot_speed_days, pivots_made, extracted_data, created_at, updated_at, status')
      .eq('status', 'approved')
      .range(page * PS, (page+1) * PS - 1);
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PS) break;
    page++;
  }
  
  console.log(`Loaded: ${all.length} approved startups\n`);
  
  // ── Degree classification ──
  const degrees = {
    'PhD (80+)':       all.filter(s => s.total_god_score >= 80),
    'Masters (60-79)': all.filter(s => s.total_god_score >= 60 && s.total_god_score < 80),
    'Bachelors (45-59)': all.filter(s => s.total_god_score >= 45 && s.total_god_score < 60),
    'Freshman (40-44)': all.filter(s => s.total_god_score >= 40 && s.total_god_score < 45),
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: DEGREE DISTRIBUTION
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 1: DEGREE DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  for (const [degree, startups] of Object.entries(degrees)) {
    const pct = ((startups.length / all.length) * 100).toFixed(1);
    const godStats = stats(startups.map(s => s.total_god_score));
    console.log(`  ${degree}: ${startups.length} startups (${pct}%)`);
    console.log(`    GOD: avg=${godStats.avg}  median=${godStats.median}  [${godStats.min}..${godStats.max}]\n`);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: PhD PROFILE — THE GOLD STANDARD
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 2: PhD PROFILE — WHAT EARNS 80+');
  console.log('  (These startups did their homework and aced the exams)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const phd = degrees['PhD (80+)'];
  
  // Component score profile
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  console.log('  Component scores (what they aced):');
  for (const comp of components) {
    const vals = phd.map(s => s[comp] || 0);
    const st = stats(vals);
    const above50 = vals.filter(v => v >= 50).length;
    const above80 = vals.filter(v => v >= 80).length;
    console.log(`    ${comp.padEnd(18)} avg=${String(st.avg).padStart(5)}  median=${String(st.median).padStart(5)}  ≥50: ${((above50/phd.length)*100).toFixed(0)}%  ≥80: ${((above80/phd.length)*100).toFixed(0)}%`);
  }
  
  // Field presence — what data do PhDs have?
  console.log('\n  Data profile (what homework they turned in):');
  const fieldChecks = [
    ['tagline', s => s.tagline && s.tagline.length > 5],
    ['pitch/description', s => (s.pitch || s.description) && (s.pitch || s.description).length > 10],
    ['website', s => s.website && s.website.length > 5],
    ['sectors', s => s.sectors && s.sectors.length > 0],
    ['is_launched', s => s.is_launched],
    ['has_demo', s => s.has_demo],
    ['team_size', s => s.team_size && s.team_size > 0],
    ['has_technical_cofounder', s => s.has_technical_cofounder],
    ['founder_avg_age', s => s.founder_avg_age && s.founder_avg_age > 0],
    ['mrr', s => s.mrr && s.mrr > 0],
    ['arr', s => s.arr && s.arr > 0],
    ['revenue (has_revenue)', s => s.has_revenue],
    ['growth_rate', s => s.growth_rate_monthly && s.growth_rate_monthly > 0],
    ['customer_count', s => s.customer_count && s.customer_count > 0],
    ['has_customers', s => s.has_customers],
    ['latest_funding', s => s.latest_funding_amount && s.latest_funding_amount > 0],
    ['lead_investor', s => s.lead_investor],
    ['nps_score', s => s.nps_score && s.nps_score > 0],
    ['experiments_run', s => s.experiments_run_last_month && s.experiments_run_last_month > 0],
    ['hypotheses_validated', s => s.hypotheses_validated && s.hypotheses_validated > 0],
    ['fomo_signal', s => s.fomo_signal_strength && s.fomo_signal_strength > 0],
    ['conviction_signal', s => s.conviction_signal_strength && s.conviction_signal_strength > 0],
  ];
  
  console.log(`    ${'Field'.padEnd(25)} ${'PhD'.padStart(6)}  ${'Masters'.padStart(8)}  ${'Bachelors'.padStart(10)}  ${'Freshman'.padStart(10)}`);
  console.log(`    ${'─'.repeat(65)}`);
  for (const [name, check] of fieldChecks) {
    const phdRate = fieldPresenceRate(phd, check);
    const mastersRate = fieldPresenceRate(degrees['Masters (60-79)'], check);
    const bachRate = fieldPresenceRate(degrees['Bachelors (45-59)'], check);
    const freshRate = fieldPresenceRate(degrees['Freshman (40-44)'], check);
    console.log(`    ${name.padEnd(25)} ${(phdRate+'%').padStart(6)}  ${(mastersRate+'%').padStart(8)}  ${(bachRate+'%').padStart(10)}  ${(freshRate+'%').padStart(10)}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: PhD ROSTER — WHO ARE THEY?
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 3: PhD ROSTER (80+ GOD Score)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const phdSorted = [...phd].sort((a,b) => b.total_god_score - a.total_god_score);
  for (const s of phdSorted.slice(0, 40)) {
    const comps = [s.team_score||0, s.traction_score||0, s.market_score||0, s.product_score||0, s.vision_score||0];
    const above50 = comps.filter(v => v >= 50).length;
    const sig = Math.min(s.signals_bonus || 0, 10);
    console.log(`    ${String(s.total_god_score).padStart(3)} ${s.name?.substring(0,28).padEnd(28) || 'unknown'.padEnd(28)}  T:${String(s.team_score||0).padStart(3)} Tr:${String(s.traction_score||0).padStart(3)} M:${String(s.market_score||0).padStart(3)} P:${String(s.product_score||0).padStart(3)} V:${String(s.vision_score||0).padStart(3)}  sig:${sig}  ${above50}/5 strong`);
  }
  if (phdSorted.length > 40) console.log(`    ... and ${phdSorted.length - 40} more`);
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: COMPONENT COMPARISON ACROSS DEGREES
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 4: WHAT EACH DEGREE LOOKS LIKE (COMPONENT AVERAGES)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  console.log(`  ${'Component'.padEnd(18)} ${'PhD'.padStart(6)} ${'Masters'.padStart(8)} ${'Bachelors'.padStart(10)} ${'Freshman'.padStart(10)}  ${'PhD→Fresh gap'.padStart(14)}`);
  console.log(`  ${'─'.repeat(70)}`);
  for (const comp of components) {
    const vals = {};
    for (const [degree, startups] of Object.entries(degrees)) {
      vals[degree] = stats(startups.map(s => s[comp] || 0)).avg;
    }
    const gap = vals['PhD (80+)'] - vals['Freshman (40-44)'];
    console.log(`  ${comp.padEnd(18)} ${String(vals['PhD (80+)']).padStart(6)} ${String(vals['Masters (60-79)']).padStart(8)} ${String(vals['Bachelors (45-59)']).padStart(10)} ${String(vals['Freshman (40-44)']).padStart(10)}  ${('+'+gap.toFixed(0)).padStart(14)}`);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 5: FORWARD MOVEMENT — WHO'S STUDYING FOR THE NEXT DEGREE?
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 5: FORWARD MOVEMENT (WHO\'S STUDYING FOR NEXT DEGREE?)');
  console.log('  (Momentum = evidence of growth, improvement, data enrichment)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Calculate momentum for every startup
  const withMomentum = all.map(s => ({
    ...s,
    momentum: measureMomentum(s),
  }));
  
  for (const [degree, _] of Object.entries(degrees)) {
    const group = withMomentum.filter(s => {
      const g = s.total_god_score;
      if (degree === 'PhD (80+)') return g >= 80;
      if (degree === 'Masters (60-79)') return g >= 60 && g < 80;
      if (degree === 'Bachelors (45-59)') return g >= 45 && g < 60;
      return g >= 40 && g < 45;
    });
    
    const momScores = group.map(s => s.momentum.score);
    const momStats = stats(momScores);
    
    // High momentum = studying for next degree
    const highMom = group.filter(s => s.momentum.score >= 6);
    const medMom = group.filter(s => s.momentum.score >= 3 && s.momentum.score < 6);
    const lowMom = group.filter(s => s.momentum.score < 3);
    
    console.log(`  ${degree} (${group.length} startups):`);
    console.log(`    Momentum: avg=${momStats.avg}  median=${momStats.median}  [${momStats.min}..${momStats.max}]`);
    console.log(`    High momentum (≥6): ${highMom.length} (${((highMom.length/group.length)*100).toFixed(1)}%) — studying for NEXT degree`);
    console.log(`    Med momentum (3-5): ${medMom.length} (${((medMom.length/group.length)*100).toFixed(1)}%) — progressing`);
    console.log(`    Low momentum (<3):  ${lowMom.length} (${((lowMom.length/group.length)*100).toFixed(1)}%) — stalled or no evidence\n`);
  }
  
  // ── Masters studying for PhD ──
  console.log('  MASTERS → PhD CANDIDATES (score 60-79, high momentum):');
  const mastersCandidates = withMomentum
    .filter(s => s.total_god_score >= 60 && s.total_god_score < 80 && s.momentum.score >= 6)
    .sort((a,b) => b.momentum.score - a.momentum.score);
  
  for (const s of mastersCandidates.slice(0, 15)) {
    console.log(`    ${String(s.total_god_score).padStart(3)} ${s.name?.substring(0,28).padEnd(28) || 'unknown'.padEnd(28)}  momentum: ${s.momentum.score.toFixed(1)}  [${s.momentum.signals.join(', ')}]`);
  }
  if (mastersCandidates.length > 15) console.log(`    ... and ${mastersCandidates.length - 15} more`);
  
  // ── Bachelors studying for Masters ──
  console.log('\n  BACHELORS → MASTERS CANDIDATES (score 45-59, high momentum):');
  const bachelorsCandidates = withMomentum
    .filter(s => s.total_god_score >= 45 && s.total_god_score < 60 && s.momentum.score >= 5)
    .sort((a,b) => b.momentum.score - a.momentum.score);
  
  for (const s of bachelorsCandidates.slice(0, 15)) {
    console.log(`    ${String(s.total_god_score).padStart(3)} ${s.name?.substring(0,28).padEnd(28) || 'unknown'.padEnd(28)}  momentum: ${s.momentum.score.toFixed(1)}  [${s.momentum.signals.join(', ')}]`);
  }
  if (bachelorsCandidates.length > 15) console.log(`    ... and ${bachelorsCandidates.length - 15} more`);
  
  // ── Freshmen studying for Bachelors ──
  console.log('\n  FRESHMAN → BACHELORS CANDIDATES (score 40-44, any momentum):');
  const freshmanCandidates = withMomentum
    .filter(s => s.total_god_score >= 40 && s.total_god_score < 45 && s.momentum.score >= 3)
    .sort((a,b) => b.momentum.score - a.momentum.score);
  
  for (const s of freshmanCandidates.slice(0, 15)) {
    console.log(`    ${String(s.total_god_score).padStart(3)} ${s.name?.substring(0,28).padEnd(28) || 'unknown'.padEnd(28)}  momentum: ${s.momentum.score.toFixed(1)}  [${s.momentum.signals.join(', ')}]`);
  }
  if (freshmanCandidates.length > 15) console.log(`    ... and ${freshmanCandidates.length - 15} more`);
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 6: THE GRADUATION REQUIREMENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 6: GRADUATION REQUIREMENTS');
  console.log('  (What must a startup demonstrate to move to the next tier?)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // What % of PhDs have N components ≥ 50?
  for (const [degree, startups] of Object.entries(degrees)) {
    const balanceDist = [0,1,2,3,4,5].map(n => {
      const count = startups.filter(s => {
        const above50 = [s.team_score, s.traction_score, s.market_score, s.product_score, s.vision_score]
          .filter(v => v && v >= 50).length;
        return above50 === n;
      }).length;
      return { n, count, pct: ((count / startups.length) * 100).toFixed(1) };
    });
    console.log(`  ${degree}: components ≥ 50`);
    for (const b of balanceDist) {
      const bar = '█'.repeat(Math.round(b.pct / 3));
      console.log(`    ${b.n}/5: ${String(b.count).padStart(5)} (${b.pct.padStart(5)}%) ${bar}`);
    }
    console.log('');
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 7: THE SPREAD — WHAT DOES THE IDEAL DISTRIBUTION LOOK LIKE?
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 7: THE IDEAL SPREAD');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const currentDist = {
    'PhD (80+)': degrees['PhD (80+)'].length,
    'Masters (60-79)': degrees['Masters (60-79)'].length,
    'Bachelors (45-59)': degrees['Bachelors (45-59)'].length,
    'Freshman (40-44)': degrees['Freshman (40-44)'].length,
  };
  
  // Real-world university analogy
  // US: ~40% bachelors, ~13% masters, ~4% doctoral
  // Startups: different because most are early stage
  // But the SHAPE matters: PhD should be rare, Masters selective, Bachelors common
  console.log('  Current distribution vs target shape:\n');
  console.log(`  ${'Degree'.padEnd(20)} ${'Current #'.padStart(10)} ${'Current %'.padStart(10)} ${'Target %'.padStart(10)} ${'Gap'.padStart(8)}`);
  console.log(`  ${'─'.repeat(60)}`);
  
  const targets = {
    'PhD (80+)': 5,        // ~5% earn doctorate
    'Masters (60-79)': 20, // ~20% strong performers
    'Bachelors (45-59)': 40, // ~40% doing decent work
    'Freshman (40-44)': 35, // ~35% very early or under-resourced
  };
  
  for (const [degree, count] of Object.entries(currentDist)) {
    const curPct = ((count / all.length) * 100).toFixed(1);
    const targetPct = targets[degree];
    const gap = (parseFloat(curPct) - targetPct).toFixed(1);
    console.log(`  ${degree.padEnd(20)} ${String(count).padStart(10)} ${(curPct+'%').padStart(10)} ${(targetPct+'%').padStart(10)} ${(gap > 0 ? '+' : '') + gap + '%'.padStart(8)}`);
  }
  
  console.log('\n  What this tells us:');
  const phdPct = currentDist['PhD (80+)'] / all.length * 100;
  const mastersPct = currentDist['Masters (60-79)'] / all.length * 100;
  const bachPct = currentDist['Bachelors (45-59)'] / all.length * 100;
  const freshPct = currentDist['Freshman (40-44)'] / all.length * 100;
  
  if (phdPct < 3) console.log('  ⚠ PhD tier is UNDER-POPULATED — scoring may be too harsh at top');
  else if (phdPct > 10) console.log('  ⚠ PhD tier is OVER-POPULATED — scoring too generous at top');
  else console.log('  ✓ PhD tier looks healthy');
  
  if (freshPct > 50) console.log('  ⚠ Freshman tier is BLOATED — too many stuck at floor');
  else if (freshPct < 20) console.log('  ✓ Freshman tier well-sized');
  else console.log('  ~ Freshman tier slightly large but acceptable');
  
  // ═══════════════════════════════════════════════════════════════════
  // SECTION 8: SIGNAL LAYER STATUS
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  SECTION 8: THREE-LAYER STATUS');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  // Signals layer
  const hasSignals = all.filter(s => s.signals_bonus && s.signals_bonus > 0).length;
  const sigStats = stats(all.filter(s => s.signals_bonus > 0).map(s => s.signals_bonus));
  console.log(`  LAYER 2: SIGNALS (market intelligence)`);
  console.log(`    Startups with signals: ${hasSignals} / ${all.length} (${((hasSignals/all.length)*100).toFixed(1)}%)`);
  console.log(`    Signal bonus when present: avg=${sigStats.avg}  median=${sigStats.median}  max=${sigStats.max}\n`);
  
  // Psych layer
  const hasPsych = all.filter(s => s.psychological_multiplier && s.psychological_multiplier > 0).length;
  console.log(`  LAYER 3: BEHAVIORAL (investor intelligence)`);
  console.log(`    Startups with psych signal: ${hasPsych} / ${all.length} (${((hasPsych/all.length)*100).toFixed(1)}%)`);
  console.log(`    Status: Pipeline fixed (Feb 14), but data sources not yet connected\n`);
  
  // ═══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY: THE DEGREE SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('  PhD (80+):     Aced all exams. Multi-component strength.');
  console.log('                 These earned it — don\'t dilute this tier.');
  console.log('');
  console.log('  Masters (60-79): Strong in 2-3 areas. Legitimate contenders.');
  console.log('                   Reward forward movement with signal/momentum credit.');
  console.log('');
  console.log('  Bachelors (45-59): Doing some things right. 1-2 strong areas.');
  console.log('                     Need DATA ENRICHMENT to advance (fill in fields).');
  console.log('');
  console.log('  Freshman (40-44): Floor. Either genuinely early or data-poor.');
  console.log('                    Separate the "studying" from the "stalled".');
  console.log('');
  console.log('  KEY INSIGHT: The divisor isn\'t the main problem.');
  console.log('  The problem is that 74.8% of D-Minimal startups lack the DATA');
  console.log('  for the scorer to differentiate them. They\'re not ALL bad —');
  console.log('  they\'re UNKNOWABLE with current data.');
  console.log('');
  console.log('  FORWARD MOVEMENT recognition would reward startups that are');
  console.log('  "studying for their Masters" without penalizing those who');
  console.log('  legitimately haven\'t earned it yet.');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
