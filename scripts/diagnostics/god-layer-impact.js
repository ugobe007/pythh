/**
 * GOD SCORE LAYER IMPACT DIAGNOSTIC
 * ===================================
 * READ-ONLY analysis — does NOT modify any scores.
 *
 * Decomposes every approved startup's score into its constituent layers:
 *   Layer 0 – baseBoost (vibe + content presence, min 4.2)
 *   Layer 1 – Component scores (team, traction, market, product, vision, courage, insight, age)
 *   Layer 2 – Bootstrap bonus (sparse-data additive, 0-15)
 *   Layer 3 – Signals bonus (external intelligence, 0-10)
 *   Layer 4 – Psychological bonus (behavioral, 0-10 on 0-100 scale)
 *
 * Also detects ORPHANED scoring functions (defined but never wired into calculateHotScore).
 *
 * Usage:
 *   node scripts/diagnostics/god-layer-impact.js
 *   node scripts/diagnostics/god-layer-impact.js --sample 200   # random sample
 *   node scripts/diagnostics/god-layer-impact.js --json          # machine-readable output
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const sampleSize = (() => {
  const idx = args.indexOf('--sample');
  return idx >= 0 ? parseInt(args[idx + 1], 10) : 0;
})();
const jsonOutput = args.includes('--json');

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function stats(values) {
  if (!values.length) return { min: 0, max: 0, avg: 0, median: 0, p10: 0, p25: 0, p75: 0, p90: 0, stddev: 0, nonZero: 0, nonZeroPct: '0%' };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const avg = sum / sorted.length;
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / sorted.length;
  const nonZero = sorted.filter(v => v > 0).length;
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: +avg.toFixed(2),
    median: +percentile(sorted, 50).toFixed(2),
    p10: +percentile(sorted, 10).toFixed(2),
    p25: +percentile(sorted, 25).toFixed(2),
    p75: +percentile(sorted, 75).toFixed(2),
    p90: +percentile(sorted, 90).toFixed(2),
    stddev: +Math.sqrt(variance).toFixed(2),
    nonZero,
    nonZeroPct: ((nonZero / sorted.length) * 100).toFixed(1) + '%',
  };
}

function histogram(values, buckets) {
  const result = {};
  for (const [label, lo, hi] of buckets) {
    result[label] = values.filter(v => v >= lo && v < hi).length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('🔍 GOD Layer Impact Diagnostic (READ-ONLY)\n');

  // Fetch all approved startups with score-related columns
  // NOTE: bootstrap_bonus is NOT stored — it's computed at runtime and baked into total_god_score
  let allStartups = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, enhanced_god_score, psychological_multiplier, psychological_bonus, team_score, traction_score, market_score, product_score, vision_score, signals_bonus, grit_score, ecosystem_score, problem_validation_score, benchmark_score, status, mrr, customer_count, arr, team_size, has_technical_cofounder, is_launched, pitch, description, tagline, website, sectors, founder_voice_score, social_score')
      .eq('status', 'approved')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('DB error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`📊 Loaded ${allStartups.length} approved startups\n`);

  if (sampleSize && sampleSize < allStartups.length) {
    // Fisher-Yates shuffle → take first N
    for (let i = allStartups.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allStartups[i], allStartups[j]] = [allStartups[j], allStartups[i]];
    }
    allStartups = allStartups.slice(0, sampleSize);
    console.log(`🎲 Sampled ${sampleSize} startups\n`);
  }

  // ---------------------------------------------------------------------------
  // Decompose each startup
  // ---------------------------------------------------------------------------
  // NOTE: bootstrap_bonus is NOT stored as a separate column.
  //   It's computed at runtime and added directly to total_god_score.
  //   So "base GOD from calculateHotScore" vs "bootstrap" isn't recoverable
  //   from DB alone. We define:
  //     baseGodEstimate = total_god_score - signals_bonus
  //   This includes the bootstrap baked in.
  const layers = {
    totalGod: [],          // final stored total_god_score (0-100)
    enhancedGod: [],       // enhanced_god_score (0-100)
    psychBonus: [],        // psychological bonus raw (0-1 on 0-10 scale)
    psychBonusScaled: [],  // psych × 10 (actual points added on 0-100 scale)
    signalsBonus: [],      // signals_bonus (0-10), points on 0-100
    // Component scores (stored as 0-100 normalized per recalculate-scores.ts)
    teamScore: [],
    tractionScore: [],
    marketScore: [],
    productScore: [],
    visionScore: [],
    // Orphaned function scores (stored in DB but NOT used by calculateHotScore)
    gritScore: [],
    ecosystemScore: [],
    problemValidationScore: [],
    benchmarkScore: [],
  };

  // Derived: base GOD estimate (includes bootstrap)
  const baseGodEstimate = [];

  for (const s of allStartups) {
    const total = s.total_god_score || 0;
    const enhanced = s.enhanced_god_score || total;
    // FIX: Use psychological_multiplier (the real scoring column)
    // psychological_bonus is a GHOST column with legacy 1.0 values (meaningless)
    const psych = s.psychological_multiplier || 0;
    const signals = Math.min(s.signals_bonus || 0, 10);

    layers.totalGod.push(total);
    layers.enhancedGod.push(enhanced);
    layers.psychBonus.push(psych);
    layers.psychBonusScaled.push(+(psych * 10).toFixed(1));
    layers.signalsBonus.push(signals);
    layers.teamScore.push(s.team_score || 0);
    layers.tractionScore.push(s.traction_score || 0);
    layers.marketScore.push(s.market_score || 0);
    layers.productScore.push(s.product_score || 0);
    layers.visionScore.push(s.vision_score || 0);
    layers.gritScore.push(s.grit_score || 0);
    layers.ecosystemScore.push(s.ecosystem_score || 0);
    layers.problemValidationScore.push(s.problem_validation_score || 0);
    layers.benchmarkScore.push(s.benchmark_score || 0);

    baseGodEstimate.push(Math.max(total - signals, 0));
  }

  // ---------------------------------------------------------------------------
  // Score buckets for distribution
  // ---------------------------------------------------------------------------
  const scoreBuckets = [
    ['40-49', 40, 50],
    ['50-59', 50, 60],
    ['60-69', 60, 70],
    ['70-79', 70, 80],
    ['80-89', 80, 90],
    ['90-100', 90, 101],
  ];

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  const report = {
    summary: {
      totalStartups: allStartups.length,
      timestamp: new Date().toISOString(),
    },
    layerStats: {
      'Base GOD (total − signals)': stats(baseGodEstimate),
      'Signals Bonus (0-10)': stats(layers.signalsBonus),
      'Psych Bonus (×10, 0-10 on 100 scale)': stats(layers.psychBonusScaled),
      'Total GOD (stored)': stats(layers.totalGod),
      'Enhanced GOD (stored)': stats(layers.enhancedGod),
    },
    componentStats: {
      'Team (0-100)': stats(layers.teamScore),
      'Traction (0-100)': stats(layers.tractionScore),
      'Market (0-100)': stats(layers.marketScore),
      'Product (0-100)': stats(layers.productScore),
      'Vision (0-100)': stats(layers.visionScore),
    },
    orphanedScoreStats: {
      note: 'These are stored in the DB but the scoring functions that populate them are NOT called by calculateHotScore',
      'Grit Score': stats(layers.gritScore),
      'Ecosystem Score': stats(layers.ecosystemScore),
      'Problem Validation Score': stats(layers.problemValidationScore),
      'Benchmark Score': stats(layers.benchmarkScore),
    },
    totalGodDistribution: histogram(layers.totalGod, scoreBuckets),
    baseGodDistribution: histogram(baseGodEstimate, scoreBuckets),
    enhancedGodDistribution: histogram(layers.enhancedGod, scoreBuckets),
    // Layer impact: how many points each layer contributes on average
    avgLayerImpact: {
      baseGodEstimate: +((baseGodEstimate.reduce((s, v) => s + v, 0)) / baseGodEstimate.length).toFixed(2),
      signals: +((layers.signalsBonus.reduce((s, v) => s + v, 0)) / layers.signalsBonus.length).toFixed(2),
      psychScaled: +((layers.psychBonusScaled.reduce((s, v) => s + v, 0)) / layers.psychBonusScaled.length).toFixed(2),
    },
    // Orphaned functions: defined in startupScoringService.ts but NOT wired into calculateHotScore
    orphanedFunctions: {
      warning: 'These scoring functions exist in startupScoringService.ts but are NEVER CALLED by calculateHotScore',
      functions: [
        { name: 'scoreGrit()', maxPoints: 2.0, description: 'Pivot history, customer feedback frequency, iteration speed' },
        { name: 'scoreProblemValidation()', maxPoints: 2.0, description: 'Customer interviews, pain data, ICP clarity, problem discovery depth' },
        { name: 'scoreEcosystem()', maxPoints: 1.5, description: 'Strategic partnerships, advisors, platform dependency risk' },
        { name: 'scoreUserLove()', maxPoints: 2.0, description: 'Sean Ellis test, NPS, organic referral, DAU/WAU ratio' },
        { name: 'scoreLearningVelocity()', maxPoints: 1.5, description: 'Experiments run, hypotheses validated, pivot speed, feedback frequency' },
      ],
      totalOrphanedPoints: 9.0,
      implication: 'These 5 functions could add up to 9.0 raw points but contribute ZERO to scores. Grit, PMF validation, user love, and learning velocity are scored but never counted.',
    },
  };

  // ---------------------------------------------------------------------------
  // Top / Bottom examples
  // ---------------------------------------------------------------------------
  const sorted = [...allStartups].sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0));
  report.topStartups = sorted.slice(0, 10).map(s => ({
    name: s.name,
    totalGod: s.total_god_score,
    enhanced: s.enhanced_god_score,
    bootstrap: s.bootstrap_bonus || 0,
    signals: s.signals_bonus || 0,
    psych: s.psychological_multiplier || 0,
    team: s.team_score,
    traction: s.traction_score,
    market: s.market_score,
    product: s.product_score,
    vision: s.vision_score,
  }));
  report.bottomStartups = sorted.slice(-10).map(s => ({
    name: s.name,
    totalGod: s.total_god_score,
    enhanced: s.enhanced_god_score,
    bootstrap: s.bootstrap_bonus || 0,
    signals: s.signals_bonus || 0,
    psych: s.psychological_multiplier || 0,
    team: s.team_score,
    traction: s.traction_score,
    market: s.market_score,
    product: s.product_score,
    vision: s.vision_score,
  }));

  // ---------------------------------------------------------------------------
  // Anomalies: signals pushing score disproportionately
  // ---------------------------------------------------------------------------
  const anomalies = allStartups.filter(s => {
    const sig = s.signals_bonus || 0;
    const god = s.total_god_score || 0;
    // Flag when signals constitute > 20% of total
    return sig > 0 && (sig / god) > 0.2;
  });
  report.anomalies = {
    count: anomalies.length,
    pctOfTotal: ((anomalies.length / allStartups.length) * 100).toFixed(1) + '%',
    examples: anomalies.slice(0, 5).map(s => ({
      name: s.name,
      totalGod: s.total_god_score,
      signals: s.signals_bonus || 0,
      base: Math.max((s.total_god_score || 0) - (s.signals_bonus || 0), 0),
    })),
  };

  // ---------------------------------------------------------------------------
  // Floor compression: how many are sitting exactly at 40
  // ---------------------------------------------------------------------------
  const atFloor = allStartups.filter(s => (s.total_god_score || 0) === 40).length;
  report.floorCompression = {
    atExactly40: atFloor,
    pct: ((atFloor / allStartups.length) * 100).toFixed(1) + '%',
    observation: atFloor > allStartups.length * 0.15
      ? '⚠️  > 15% of startups at floor — poor differentiation in bottom tier'
      : '✅ Floor compression within acceptable range',
  };

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
}

// ---------------------------------------------------------------------------
// Pretty-print for terminal
// ---------------------------------------------------------------------------
function printReport(r) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  GOD SCORE LAYER IMPACT DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Startups analyzed: ${r.summary.totalStartups}`);
  console.log(`  Timestamp: ${r.summary.timestamp}\n`);

  console.log('── LAYER STATISTICS ──────────────────────────────────────────');
  for (const [label, s] of Object.entries(r.layerStats)) {
    console.log(`\n  ${label}:`);
    console.log(`    avg=${s.avg}  median=${s.median}  stddev=${s.stddev}`);
    console.log(`    min=${s.min}  p10=${s.p10}  p25=${s.p25}  p75=${s.p75}  p90=${s.p90}  max=${s.max}`);
    console.log(`    non-zero: ${s.nonZero} (${s.nonZeroPct})`);
  }

  console.log('\n── COMPONENT SCORES ─────────────────────────────────────────');
  for (const [label, s] of Object.entries(r.componentStats)) {
    console.log(`  ${label}: avg=${s.avg}  median=${s.median}  stddev=${s.stddev}  [${s.min}..${s.max}]`);
  }

  console.log('\n── AVG LAYER IMPACT (per startup) ───────────────────────────');
  const impact = r.avgLayerImpact;
  console.log(`  Base GOD (incl bootstrap): ${impact.baseGodEstimate} pts`);
  console.log(`  Signals:                  +${impact.signals} pts`);
  console.log(`  Psych (×10):              +${impact.psychScaled} pts`);
  console.log(`  ──────────────────`);
  console.log(`  Expected total: ${(impact.baseGodEstimate + impact.signals + impact.psychScaled).toFixed(2)} pts`);

  console.log('\n── TOTAL GOD DISTRIBUTION ────────────────────────────────────');
  for (const [bucket, count] of Object.entries(r.totalGodDistribution)) {
    const bar = '█'.repeat(Math.round(count / Math.max(...Object.values(r.totalGodDistribution)) * 30));
    console.log(`  ${bucket}: ${String(count).padStart(5)} ${bar}`);
  }

  console.log('\n── BASE GOD DISTRIBUTION (sans signals) ─────────────────────');
  for (const [bucket, count] of Object.entries(r.baseGodDistribution)) {
    const bar = '█'.repeat(Math.round(count / Math.max(1, ...Object.values(r.baseGodDistribution)) * 30));
    console.log(`  ${bucket}: ${String(count).padStart(5)} ${bar}`);
  }

  console.log('\n── ORPHANED SCORING COLUMNS (stored but unused) ────────────');
  if (r.orphanedScoreStats) {
    console.log(`  ${r.orphanedScoreStats.note}`);
    for (const [label, s] of Object.entries(r.orphanedScoreStats)) {
      if (label === 'note') continue;
      console.log(`  ${label}: avg=${s.avg}  median=${s.median}  non-zero: ${s.nonZero} (${s.nonZeroPct})  [${s.min}..${s.max}]`);
    }
  }

  console.log('\n── FLOOR COMPRESSION ────────────────────────────────────────');
  const fc = r.floorCompression;
  console.log(`  At exactly 40: ${fc.atExactly40} (${fc.pct})`);
  console.log(`  ${fc.observation}`);

  console.log('\n── ANOMALIES (bonus > 30% of total) ─────────────────────────');
  console.log(`  Count: ${r.anomalies.count} (${r.anomalies.pctOfTotal})`);
  if (r.anomalies.examples.length) {
    for (const ex of r.anomalies.examples) {
      console.log(`    ${ex.name}: total=${ex.totalGod}, base=${ex.base}, sig=+${ex.signals}`);
    }
  }

  console.log('\n── TOP 10 STARTUPS ──────────────────────────────────────────');
  for (const s of r.topStartups) {
    console.log(`  ${String(s.totalGod).padStart(3)} | ${s.name.substring(0, 30).padEnd(30)} | T:${s.team} Tr:${s.traction} M:${s.market} P:${s.product} V:${s.vision} | boot:${s.bootstrap} sig:${s.signals} psy:${s.psych}`);
  }

  console.log('\n── BOTTOM 10 STARTUPS ───────────────────────────────────────');
  for (const s of r.bottomStartups) {
    console.log(`  ${String(s.totalGod).padStart(3)} | ${s.name.substring(0, 30).padEnd(30)} | T:${s.team} Tr:${s.traction} M:${s.market} P:${s.product} V:${s.vision} | boot:${s.bootstrap} sig:${s.signals} psy:${s.psych}`);
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  ⚠️  ORPHANED SCORING FUNCTIONS (defined but never called)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  ${r.orphanedFunctions.warning}\n`);
  for (const fn of r.orphanedFunctions.functions) {
    console.log(`  ❌ ${fn.name} (max ${fn.maxPoints} pts)`);
    console.log(`     → ${fn.description}`);
  }
  console.log(`\n  Total orphaned capacity: ${r.orphanedFunctions.totalOrphanedPoints} raw points`);
  console.log(`  ${r.orphanedFunctions.implication}`);
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
