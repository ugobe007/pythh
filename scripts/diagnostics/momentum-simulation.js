#!/usr/bin/env node
/**
 * MOMENTUM LAYER SIMULATION
 * ============================
 * READ-ONLY — does NOT modify any scores.
 *
 * Shows what would happen if the momentum layer were integrated into
 * the recalculate-scores pipeline as:
 *   finalScore = GOD + bootstrap + signals + momentum
 *
 * Answers the key questions:
 *   1. How many startups gain momentum bonus?
 *   2. What's the average / max / distribution of bonus?
 *   3. Does any startup jump tiers (e.g., Bachelors → Masters)?
 *   4. What does the degree distribution look like before/after?
 *   5. Is there any gaming risk (garbage being rewarded)?
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateMomentumScore, loadScoreHistoryBatch } = require('../../server/services/momentumScoringService');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function tierLabel(score) {
  if (score >= 80) return 'PhD';
  if (score >= 60) return 'Masters';
  if (score >= 45) return 'Bachelors';
  return 'Freshman';
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MOMENTUM LAYER SIMULATION (READ-ONLY)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Load all approved startups ──
  let allStartups = [];
  let page = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, tagline, description, pitch, website, sectors, extracted_data, mrr, arr, customer_count, growth_rate_monthly, customer_growth_monthly, has_technical_cofounder, team_size, founder_avg_age, is_launched, has_demo, has_revenue, has_customers, latest_funding_amount, latest_funding_round, nps_score, experiments_run_last_month, created_at, updated_at')
      .eq('status', 'approved')
      .range(page * PS, (page + 1) * PS - 1);
    if (error) { console.error('DB error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    if (data.length < PS) break;
    page++;
  }

  console.log(`📊 Loaded ${allStartups.length} approved startups\n`);

  // ── Load score history for trajectory dimension ──
  console.log('📊 Loading score history for trajectory analysis...');
  const startupIds = allStartups.map(s => s.id);
  const historyMap = await loadScoreHistoryBatch(supabase, startupIds);
  console.log(`   Score history loaded for ${historyMap.size} startups\n`);

  // ── Calculate momentum for every startup ──
  const results = [];
  for (const startup of allStartups) {
    const history = historyMap.get(startup.id) || [];
    const momentum = calculateMomentumScore(startup, { scoreHistory: history });
    results.push({
      startup,
      momentum,
      oldScore: startup.total_god_score,
      newScore: Math.min(startup.total_god_score + momentum.total, 100),
      oldTier: tierLabel(startup.total_god_score),
      newTier: tierLabel(Math.min(startup.total_god_score + momentum.total, 100)),
    });
  }

  // ── Overall Stats ──
  const withMomentum = results.filter(r => r.momentum.total > 0);
  const bonuses = withMomentum.map(r => r.momentum.total).sort((a, b) => a - b);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  OVERALL IMPACT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Startups with momentum: ${withMomentum.length} / ${results.length} (${(withMomentum.length / results.length * 100).toFixed(1)}%)`);
  console.log(`  Startups without:       ${results.length - withMomentum.length}`);
  if (bonuses.length > 0) {
    console.log(`  Average bonus:          +${(bonuses.reduce((s, v) => s + v, 0) / bonuses.length).toFixed(1)}`);
    console.log(`  Median bonus:           +${percentile(bonuses, 50).toFixed(1)}`);
    console.log(`  P90 bonus:              +${percentile(bonuses, 90).toFixed(1)}`);
    console.log(`  Max bonus:              +${bonuses[bonuses.length - 1].toFixed(1)}`);
    console.log(`  Min bonus:              +${bonuses[0].toFixed(1)}`);
  }
  console.log();

  // ── Bonus Distribution ──
  console.log('📊 BONUS DISTRIBUTION:');
  const buckets = [
    { label: '0 (no momentum)', min: 0, max: 0 },
    { label: '0.1-1.0', min: 0.1, max: 1.0 },
    { label: '1.1-2.0', min: 1.1, max: 2.0 },
    { label: '2.1-3.0', min: 2.1, max: 3.0 },
    { label: '3.1-5.0', min: 3.1, max: 5.0 },
    { label: '5.1-8.0', min: 5.1, max: 8.0 },
  ];
  for (const b of buckets) {
    const count = results.filter(r => {
      if (b.min === 0 && b.max === 0) return r.momentum.total === 0;
      return r.momentum.total >= b.min && r.momentum.total <= b.max;
    }).length;
    const pct = (count / results.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / results.length * 60));
    console.log(`   ${b.label.padEnd(15)} ${String(count).padStart(5)} (${pct.padStart(5)}%) ${bar}`);
  }
  console.log();

  // ── Degree Distribution: Before vs After ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DEGREE DISTRIBUTION: BEFORE vs AFTER MOMENTUM');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const tiers = ['PhD', 'Masters', 'Bachelors', 'Freshman'];
  for (const tier of tiers) {
    const before = results.filter(r => r.oldTier === tier).length;
    const after = results.filter(r => r.newTier === tier).length;
    const diff = after - before;
    const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    const pctBefore = (before / results.length * 100).toFixed(1);
    const pctAfter = (after / results.length * 100).toFixed(1);
    console.log(`  ${tier.padEnd(10)} ${before.toString().padStart(5)} (${pctBefore}%) → ${after.toString().padStart(5)} (${pctAfter}%)  [${diffStr}]`);
  }
  console.log();

  // ── Tier Jumps ──
  const tierJumps = results.filter(r => r.oldTier !== r.newTier);
  console.log(`📊 TIER JUMPS: ${tierJumps.length} startups would change tier`);
  if (tierJumps.length > 0) {
    // Group by transition
    const transitions = {};
    for (const j of tierJumps) {
      const key = `${j.oldTier} → ${j.newTier}`;
      if (!transitions[key]) transitions[key] = [];
      transitions[key].push(j);
    }
    for (const [trans, jumps] of Object.entries(transitions)) {
      console.log(`   ${trans}: ${jumps.length}`);
      // Show top 5
      const top = jumps.sort((a, b) => b.momentum.total - a.momentum.total).slice(0, 5);
      for (const j of top) {
        console.log(`     ${j.startup.name}: ${j.oldScore} → ${j.newScore} (momentum +${j.momentum.total})`);
      }
      if (jumps.length > 5) console.log(`     ... and ${jumps.length - 5} more`);
    }
  }
  console.log();

  // ── Momentum by Current Tier ──
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MOMENTUM BY CURRENT TIER');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const tier of tiers) {
    const tierResults = results.filter(r => r.oldTier === tier);
    const tierWithMom = tierResults.filter(r => r.momentum.total > 0);
    const tierBonuses = tierWithMom.map(r => r.momentum.total);
    const avg = tierBonuses.length > 0
      ? (tierBonuses.reduce((s, v) => s + v, 0) / tierBonuses.length).toFixed(1)
      : '0.0';
    console.log(`  ${tier.padEnd(10)} ${tierWithMom.length}/${tierResults.length} have momentum (${(tierWithMom.length / (tierResults.length || 1) * 100).toFixed(1)}%), avg bonus: +${avg}`);
  }
  console.log();

  // ── Signal Frequency ──
  console.log('📊 MOST COMMON MOMENTUM SIGNALS:');
  const signalFreq = {};
  for (const r of results) {
    for (const sig of r.momentum.signals) {
      signalFreq[sig] = (signalFreq[sig] || 0) + 1;
    }
  }
  const sortedSigs = Object.entries(signalFreq).sort((a, b) => b[1] - a[1]);
  for (const [sig, count] of sortedSigs.slice(0, 15)) {
    const pct = (count / results.length * 100).toFixed(1);
    console.log(`   ${sig.padEnd(25)} ${count.toString().padStart(5)} (${pct}%)`);
  }
  console.log();

  // ── Dimension Contribution ──
  console.log('📊 DIMENSION CONTRIBUTION (avg across all with momentum):');
  const dims = ['revenueTrajectory', 'customerTrajectory', 'productMaturity', 'teamStrength', 'dataCompleteness', 'scoreTrajectory'];
  for (const dim of dims) {
    const vals = withMomentum.map(r => r.momentum.breakdown[dim]);
    const avg = vals.length > 0 ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2) : '0.00';
    const max = vals.length > 0 ? Math.max(...vals).toFixed(1) : '0.0';
    const nonZero = vals.filter(v => v > 0).length;
    console.log(`   ${dim.padEnd(22)} avg: ${avg.padStart(5)}  max: ${max.padStart(4)}  populated: ${nonZero}/${withMomentum.length}`);
  }
  console.log();

  // ── Top 20 Biggest Momentum Winners ──
  console.log('📊 TOP 20 MOMENTUM WINNERS:');
  const top20 = [...results].sort((a, b) => b.momentum.total - a.momentum.total).slice(0, 20);
  for (const r of top20) {
    const jump = r.oldTier !== r.newTier ? ` ↗ ${r.newTier}` : '';
    console.log(`   +${r.momentum.total.toFixed(1).padStart(4)} | GOD ${r.oldScore} → ${r.newScore} | ${r.oldTier}${jump} | ${r.startup.name} | [${r.momentum.signals.join(', ')}]`);
  }
  console.log();

  // ── Safety Check: Freshman with High Momentum ──
  console.log('🛡️  SAFETY CHECK — Freshman with momentum > 3:');
  const freshmanHighMom = results.filter(r => r.oldTier === 'Freshman' && r.momentum.total > 3);
  if (freshmanHighMom.length === 0) {
    console.log('   ✅ None — momentum layer is not rewarding sparse-data Freshman');
  } else {
    console.log(`   ⚠️  ${freshmanHighMom.length} Freshman have momentum > 3:`);
    for (const r of freshmanHighMom.slice(0, 10)) {
      console.log(`     ${r.startup.name}: +${r.momentum.total} [${r.momentum.signals.join(', ')}]`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  SIMULATION COMPLETE — No scores modified.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
