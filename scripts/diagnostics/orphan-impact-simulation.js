/**
 * ORPHANED FUNCTION IMPACT SIMULATION
 * ====================================
 * READ-ONLY — does NOT modify any scores or the scoring system.
 *
 * Simulates what would happen if the 5 orphaned scoring functions
 * were wired into calculateHotScore. Shows:
 *   1. Data availability for each function's input fields
 *   2. Per-function score distribution (what they WOULD produce)
 *   3. New rawTotal distribution under several divisor scenarios
 *   4. Before/after comparison of overall GOD score distribution
 *
 * Usage:
 *   node scripts/diagnostics/orphan-impact-simulation.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ── Replicas of the 5 orphaned functions (exact logic from startupScoringService.ts) ──

function scoreGrit(s) {
  let score = 0;
  let hasAnyData = false;

  if (s.pivots_made !== undefined && s.pivots_made !== null && s.pivot_history) {
    hasAnyData = true;
    if (s.pivots_made === 1 || s.pivots_made === 2) score += 0.7;
    else if (s.pivots_made === 0 && s.created_at) {
      const months = (Date.now() - new Date(s.created_at).getTime()) / (1000*60*60*24*30);
      if (months > 12 && s.customer_count && s.customer_count > 10) score += 0.5;
    } else if (s.pivots_made >= 3) score += 0.3;
  }

  if (s.customer_feedback_frequency) {
    hasAnyData = true;
    if (s.customer_feedback_frequency === 'daily') score += 0.7;
    else if (s.customer_feedback_frequency === 'weekly') score += 0.5;
    else if (s.customer_feedback_frequency === 'monthly') score += 0.3;
  }

  if (s.time_to_iterate_days !== undefined && s.time_to_iterate_days !== null) {
    hasAnyData = true;
    if (s.time_to_iterate_days <= 7) score += 0.6;
    else if (s.time_to_iterate_days <= 14) score += 0.4;
    else if (s.time_to_iterate_days <= 30) score += 0.2;
  }

  if (!hasAnyData) return 0.3; // default
  return Math.min(score, 2.0);
}

function scoreProblemValidation(s) {
  let score = 0;

  if (s.customer_interviews_conducted !== undefined && s.customer_interviews_conducted !== null) {
    if (s.customer_interviews_conducted >= 50) score += 0.75;
    else if (s.customer_interviews_conducted >= 20) score += 0.6;
    else if (s.customer_interviews_conducted >= 10) score += 0.4;
    else if (s.customer_interviews_conducted >= 5) score += 0.2;
  }

  if (s.customer_pain_data && typeof s.customer_pain_data === 'object') {
    const pain = s.customer_pain_data;
    if (pain.cost_of_problem && pain.cost_of_problem > 100000) score += 0.3;
    else if (pain.cost_of_problem && pain.cost_of_problem > 10000) score += 0.2;
    if (pain.frequency === 'daily') score += 0.1;
    if (pain.willingness_to_pay_validated) score += 0.1;
  }

  if (s.icp_clarity === 'crystal_clear') score += 0.4;
  else if (s.icp_clarity === 'moderate') score += 0.2;

  if (s.problem_discovery_depth === 'deep') score += 0.35;
  else if (s.problem_discovery_depth === 'moderate') score += 0.2;
  else if (s.problem_discovery_depth === 'surface') score += 0.05;

  // Default if NO data at all
  if (score === 0 && !s.customer_interviews_conducted && !s.customer_pain_data &&
      !s.icp_clarity && !s.problem_discovery_depth) {
    return 0.6;
  }
  return Math.min(score, 2);
}

function scoreUserLove(s) {
  let score = 0;

  if (s.users_who_would_be_very_disappointed !== undefined && s.users_who_would_be_very_disappointed !== null) {
    if (s.users_who_would_be_very_disappointed >= 40) score += 0.6;
    else if (s.users_who_would_be_very_disappointed >= 25) score += 0.4;
    else if (s.users_who_would_be_very_disappointed >= 15) score += 0.2;
  }

  if (s.nps_score !== undefined && s.nps_score !== null) {
    if (s.nps_score >= 70) score += 0.5;
    else if (s.nps_score >= 50) score += 0.4;
    else if (s.nps_score >= 30) score += 0.25;
    else if (s.nps_score >= 0) score += 0.1;
  }

  if (s.organic_referral_rate !== undefined && s.organic_referral_rate !== null) {
    if (s.organic_referral_rate >= 50) score += 0.4;
    else if (s.organic_referral_rate >= 30) score += 0.3;
    else if (s.organic_referral_rate >= 15) score += 0.2;
    else if (s.organic_referral_rate >= 5) score += 0.1;
  }

  if (s.dau_wau_ratio !== undefined && s.dau_wau_ratio !== null) {
    if (s.dau_wau_ratio >= 0.6) score += 0.5;
    else if (s.dau_wau_ratio >= 0.4) score += 0.35;
    else if (s.dau_wau_ratio >= 0.25) score += 0.2;
    else if (s.dau_wau_ratio >= 0.15) score += 0.1;
  }

  // Proxies if no direct user love data
  if (score === 0) {
    // (retention_rate, churn_rate, prepaying_customers, passionate_customers
    //  not selected in query — skip proxies for simulation)
  }

  if (score === 0) return 0.5; // default
  return Math.min(score, 2);
}

function scoreEcosystem(s) {
  let score = 0;

  if (s.strategic_partners && Array.isArray(s.strategic_partners) && s.strategic_partners.length > 0) {
    const active = s.strategic_partners.filter(p =>
      p.relationship_stage === 'signed' || p.relationship_stage === 'revenue_generating'
    );
    const rev = active.filter(p => p.relationship_stage === 'revenue_generating');
    if (rev.length >= 2) score += 0.75;
    else if (rev.length === 1) score += 0.5;
    else if (active.length >= 3) score += 0.4;
    else if (active.length >= 1) score += 0.25;

    const dist = active.filter(p => p.type === 'distribution');
    if (dist.some(p => p.relationship_stage === 'revenue_generating')) score += 0.25;
  }

  if (s.advisors && Array.isArray(s.advisors) && s.advisors.length > 0) {
    const notableKw = ['ceo','cto','founder','vp','director','professor','phd'];
    const hasNotable = s.advisors.some(a =>
      notableKw.some(kw =>
        (a.background||'').toLowerCase().includes(kw) ||
        (a.role||'').toLowerCase().includes(kw)
      )
    );
    if (s.advisors.length >= 3 && hasNotable) score += 0.5;
    else if (hasNotable) score += 0.3;
    else if (s.advisors.length >= 2) score += 0.2;
  }

  return Math.max(Math.min(score, 1.5), 0);
}

function scoreLearningVelocity(s) {
  let score = 0;

  if (s.experiments_run_last_month !== undefined && s.experiments_run_last_month !== null) {
    if (s.experiments_run_last_month >= 10) score += 0.5;
    else if (s.experiments_run_last_month >= 5) score += 0.35;
    else if (s.experiments_run_last_month >= 2) score += 0.2;
    else if (s.experiments_run_last_month >= 1) score += 0.1;
  }

  if (s.hypotheses_validated !== undefined && s.hypotheses_validated !== null) {
    if (s.hypotheses_validated >= 20) score += 0.4;
    else if (s.hypotheses_validated >= 10) score += 0.3;
    else if (s.hypotheses_validated >= 5) score += 0.2;
    else if (s.hypotheses_validated >= 1) score += 0.1;
  }

  if (s.pivot_speed_days !== undefined && s.pivot_speed_days !== null) {
    if (s.pivot_speed_days <= 7) score += 0.3;
    else if (s.pivot_speed_days <= 14) score += 0.2;
    else if (s.pivot_speed_days <= 30) score += 0.1;
  }

  if (s.customer_feedback_frequency === 'daily') score += 0.3;
  else if (s.customer_feedback_frequency === 'weekly') score += 0.2;
  else if (s.customer_feedback_frequency === 'monthly') score += 0.1;

  // Proxies
  if (score === 0) {
    if (s.pivots_made && s.pivots_made >= 2) score += 0.4;
    else if (s.pivots_made && s.pivots_made >= 1) score += 0.25;
    if (s.customer_interviews_conducted && s.customer_interviews_conducted >= 30) score += 0.4;
    else if (s.customer_interviews_conducted && s.customer_interviews_conducted >= 10) score += 0.2;
    if (s.problem_discovery_depth === 'deep') score += 0.3;
    else if (s.problem_discovery_depth === 'moderate') score += 0.15;
  }

  if (score === 0) return 0.4; // default
  return Math.min(score, 1.5);
}

// ── Stats helpers ──

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(values) {
  if (!values.length) return { min:0, max:0, avg:0, median:0, p10:0, p90:0, nonZero:0 };
  const sorted = [...values].sort((a,b) => a - b);
  const sum = sorted.reduce((s,v) => s + v, 0);
  const avg = sum / sorted.length;
  const nonZero = sorted.filter(v => v > 0).length;
  return {
    count: sorted.length,
    min: +sorted[0].toFixed(2),
    max: +sorted[sorted.length-1].toFixed(2),
    avg: +avg.toFixed(2),
    median: +percentile(sorted, 50).toFixed(2),
    p10: +percentile(sorted, 10).toFixed(2),
    p25: +percentile(sorted, 25).toFixed(2),
    p75: +percentile(sorted, 75).toFixed(2),
    p90: +percentile(sorted, 90).toFixed(2),
    nonZero,
    nonZeroPct: ((nonZero/sorted.length)*100).toFixed(1) + '%'
  };
}

function histogram(values, buckets) {
  const r = {};
  for (const [label, lo, hi] of buckets) r[label] = values.filter(v => v >= lo && v < hi).length;
  return r;
}

// ── Main ──

async function main() {
  console.log('🧪 ORPHANED FUNCTION IMPACT SIMULATION (READ-ONLY)\n');

  // Fetch data needed by orphaned functions
  let all = [];
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, signals_bonus, pivots_made, pivot_history, customer_feedback_frequency, time_to_iterate_days, customer_interviews_conducted, customer_pain_data, icp_clarity, problem_discovery_depth, nps_score, users_who_would_be_very_disappointed, organic_referral_rate, dau_wau_ratio, strategic_partners, advisors, platform_dependencies, experiments_run_last_month, hypotheses_validated, pivot_speed_days, customer_count, created_at, status')
      .eq('status', 'approved')
      .range(page * PS, (page+1) * PS - 1);
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PS) break;
    page++;
  }

  console.log('Loaded:', all.length, 'approved startups\n');

  // ── 1. Data availability ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 1: DATA AVAILABILITY FOR ORPHANED FUNCTION FIELDS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fieldGroups = {
    'scoreGrit': ['pivots_made', 'pivot_history', 'customer_feedback_frequency', 'time_to_iterate_days'],
    'scoreProblemValidation': ['customer_interviews_conducted', 'customer_pain_data', 'icp_clarity', 'problem_discovery_depth'],
    'scoreUserLove': ['nps_score', 'users_who_would_be_very_disappointed', 'organic_referral_rate', 'dau_wau_ratio'],
    'scoreEcosystem': ['strategic_partners', 'advisors', 'platform_dependencies'],
    'scoreLearningVelocity': ['experiments_run_last_month', 'hypotheses_validated', 'pivot_speed_days'],
  };

  for (const [fn, fields] of Object.entries(fieldGroups)) {
    console.log(`  ${fn}():`);
    let anyFieldPresent = 0;
    for (const f of fields) {
      const nonNull = all.filter(d => {
        const v = d[f];
        if (v === null || v === undefined) return false;
        if (typeof v === 'string' && v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      }).length;
      const pct = ((nonNull/all.length)*100).toFixed(1);
      console.log(`    ${f.padEnd(40)} ${String(nonNull).padStart(5)} / ${all.length}  (${pct}%)`);
      if (nonNull > 0) anyFieldPresent = Math.max(anyFieldPresent, nonNull);
    }
    const anyPct = ((anyFieldPresent/all.length)*100).toFixed(1);
    console.log(`    → Best field coverage: ${anyPct}%\n`);
  }

  // ── 2. Per-function score distribution ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 2: WHAT EACH FUNCTION WOULD SCORE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fnScores = {
    grit: [], problemVal: [], userLove: [], ecosystem: [], learningVel: []
  };
  const fnNames = {
    grit: 'scoreGrit (max 2.0)',
    problemVal: 'scoreProblemValidation (max 2.0)',
    userLove: 'scoreUserLove (max 2.0)',
    ecosystem: 'scoreEcosystem (max 1.5)',
    learningVel: 'scoreLearningVelocity (max 1.5)',
  };
  const orphanTotals = [];

  for (const s of all) {
    const g = scoreGrit(s);
    const pv = scoreProblemValidation(s);
    const ul = scoreUserLove(s);
    const eco = scoreEcosystem(s);
    const lv = scoreLearningVelocity(s);
    fnScores.grit.push(g);
    fnScores.problemVal.push(pv);
    fnScores.userLove.push(ul);
    fnScores.ecosystem.push(eco);
    fnScores.learningVel.push(lv);
    orphanTotals.push(g + pv + ul + eco + lv);
  }

  for (const [key, label] of Object.entries(fnNames)) {
    const st = stats(fnScores[key]);
    // How many are at default?
    const defaults = { grit: 0.3, problemVal: 0.6, userLove: 0.5, ecosystem: 0, learningVel: 0.4 };
    const atDefault = fnScores[key].filter(v => Math.abs(v - defaults[key]) < 0.001).length;
    console.log(`  ${label}:`);
    console.log(`    avg=${st.avg}  median=${st.median}  [${st.min}..${st.max}]`);
    console.log(`    At default (${defaults[key]}): ${atDefault} / ${all.length} (${((atDefault/all.length)*100).toFixed(1)}%)\n`);
  }

  const orphanStats = stats(orphanTotals);
  console.log(`  TOTAL orphaned (all 5 combined):`);
  console.log(`    avg=${orphanStats.avg}  median=${orphanStats.median}  [${orphanStats.min}..${orphanStats.max}]`);
  console.log(`    p10=${orphanStats.p10}  p25=${orphanStats.p25}  p75=${orphanStats.p75}  p90=${orphanStats.p90}\n`);

  // ── 3. Impact on rawTotal and GOD score under different divisors ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 3: GOD SCORE IMPACT (SIMULATED)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Current GOD scores
  const currentGod = all.map(s => s.total_god_score || 40);
  const signals = all.map(s => Math.min(s.signals_bonus || 0, 10));

  // Estimate current rawTotal from current GOD
  // currentGod = min((rawTotal / 25) * 10, 10) * 10
  // So rawTotal = (currentGod / 100) * 25 (if not floored)
  const estimatedRaw = all.map((s, i) => {
    const base = Math.max(currentGod[i] - signals[i], 40);
    return (base / 100) * 25;
  });

  // New rawTotal = estimatedRaw + orphanTotal
  const newRaw = all.map((s, i) => estimatedRaw[i] + orphanTotals[i]);

  const scoreBuckets = [
    ['< 40', 0, 40],
    ['40-49', 40, 50],
    ['50-59', 50, 60],
    ['60-69', 60, 70],
    ['70-79', 70, 80],
    ['80-89', 80, 90],
    ['90-100', 90, 101],
  ];

  // Current max rawTotal: 21, new max: 21 + 9 = 30
  const divisors = [25.0, 28.0, 30.0, 33.0, 35.7];

  console.log('  Current distribution (divisor=25, no orphans):');
  const curHist = histogram(currentGod, scoreBuckets);
  for (const [b, c] of Object.entries(curHist)) {
    const bar = '#'.repeat(Math.round(c / Math.max(1, ...Object.values(curHist)) * 30));
    console.log(`    ${b.padEnd(7)}: ${String(c).padStart(5)} ${bar}`);
  }
  const curFloor = currentGod.filter(v => v === 40).length;
  console.log(`    At floor (40): ${curFloor} (${((curFloor/all.length)*100).toFixed(1)}%)`);
  console.log(`    avg=${stats(currentGod).avg}  median=${stats(currentGod).median}\n`);

  for (const div of divisors) {
    const simulated = all.map((s, i) => {
      const godRaw = Math.min((newRaw[i] / div) * 10, 10) * 10;
      const floored = Math.max(godRaw, 40); // floor
      const withSignals = Math.min(Math.round(floored + signals[i]), 100);
      return withSignals;
    });

    console.log(`  Simulated with orphans, divisor=${div} (max raw ${div <= 30 ? '30→' + Math.round(30/div*100) : '30→' + Math.round(30/div*100)}):`)
    const simHist = histogram(simulated, scoreBuckets);
    for (const [b, c] of Object.entries(simHist)) {
      const bar = '#'.repeat(Math.round(c / Math.max(1, ...Object.values(simHist)) * 30));
      console.log(`    ${b.padEnd(7)}: ${String(c).padStart(5)} ${bar}`);
    }
    const simFloor = simulated.filter(v => v === 40).length;
    const simStats = stats(simulated);
    console.log(`    At floor (40): ${simFloor} (${((simFloor/all.length)*100).toFixed(1)}%)`);
    console.log(`    avg=${simStats.avg}  median=${simStats.median}  p10=${simStats.p10}  p90=${simStats.p90}\n`);
  }

  // ── 4. Example startups: who moves most? ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SECTION 4: WHO MOVES MOST? (divisor=30 scenario)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const div30 = 30.0;
  const withOrphans = all.map((s, i) => {
    const godRaw = Math.min((newRaw[i] / div30) * 10, 10) * 10;
    const floored = Math.max(godRaw, 40);
    return Math.min(Math.round(floored + signals[i]), 100);
  });

  const deltas = all.map((s, i) => ({
    name: s.name,
    current: currentGod[i],
    simulated: withOrphans[i],
    delta: withOrphans[i] - currentGod[i],
    orphanBreakdown: {
      grit: fnScores.grit[i],
      problemVal: fnScores.problemVal[i],
      userLove: fnScores.userLove[i],
      ecosystem: fnScores.ecosystem[i],
      learningVel: fnScores.learningVel[i],
    }
  }));

  // Sort by biggest positive delta
  deltas.sort((a, b) => b.delta - a.delta);

  console.log('  Top 15 biggest score INCREASES:');
  for (const d of deltas.slice(0, 15)) {
    const ob = d.orphanBreakdown;
    console.log(`    ${d.name.substring(0,30).padEnd(30)} ${d.current} → ${d.simulated} (+${d.delta})  [G:${ob.grit} PV:${ob.problemVal} UL:${ob.userLove} Eco:${ob.ecosystem} LV:${ob.learningVel}]`);
  }

  // Sort by biggest negative delta (losers — floor compression victims)
  deltas.sort((a, b) => a.delta - b.delta);
  console.log('\n  Top 15 biggest score DECREASES:');
  for (const d of deltas.slice(0, 15)) {
    const ob = d.orphanBreakdown;
    console.log(`    ${d.name.substring(0,30).padEnd(30)} ${d.current} → ${d.simulated} (${d.delta})  [G:${ob.grit} PV:${ob.problemVal} UL:${ob.userLove} Eco:${ob.ecosystem} LV:${ob.learningVel}]`);
  }

  // Delta distribution
  const allDeltas = deltas.map(d => d.delta);
  const dStats = stats(allDeltas);
  console.log(`\n  Delta distribution (divisor=30):`);
  console.log(`    avg=${dStats.avg}  median=${dStats.median}  min=${dStats.min}  max=${dStats.max}`);
  console.log(`    p10=${dStats.p10}  p25=${dStats.p25}  p75=${dStats.p75}  p90=${dStats.p90}`);
  const noChange = allDeltas.filter(d => d === 0).length;
  const improved = allDeltas.filter(d => d > 0).length;
  const worsened = allDeltas.filter(d => d < 0).length;
  console.log(`    Improved: ${improved}  No change: ${noChange}  Worsened: ${worsened}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Orphaned functions add avg ${orphanStats.avg} raw pts per startup`);
  console.log(`  Default-only contribution: ${(0.3+0.6+0.5+0+0.4).toFixed(1)} pts (when startup has NO data for these fields)`);
  console.log(`  Current max rawTotal: 21.0 → New max with orphans: 30.0`);
  console.log(`  To maintain same avg, divisor should go from 25.0 to ~${(25 * 30/21).toFixed(1)}`);
  console.log(`  Recommendation: divisor=30 preserves relative ordering while adding differentiation`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
