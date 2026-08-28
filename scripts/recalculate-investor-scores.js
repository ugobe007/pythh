#!/usr/bin/env node
/**
 * RECALCULATE INVESTOR GOD SCORES v4
 * ====================================
 * Converts investor scoring to the same 0-100 GOD scale used for startups,
 * enabling unified ranking across the platform.
 *
 * Score components (0-100 total):
 *   Profile Completeness  (0-25): bio, thesis, geography, social proof, public thesis themes
 *   Investment Focus      (0-25): sectors, stage, investment type (incl. operator_angel)
 *   Capital Readiness     (0-20): check size, fund size, leads_rounds
 *   Track Record          (0-20): investments, exits, notable_investments, operator founders
 *   Activity & Velocity   (0-10): last_investment_date recency, deployment_velocity_index
 *
 * Operator / successful-founder public thesis (blog/LinkedIn themes) folds into
 * profile/focus/track via lib/operatorFounderInvestors.js — see lib/investorGodScore.js.
 * Tier thresholds (0-100):
 *   Elite:    ≥ 70  (top ~3-5%)
 *   Strong:   ≥ 50  (next ~30%)
 *   Solid:    ≥ 30  (mid tier)
 *   Emerging: < 30  (sparse data)
 *
 * Run: node scripts/recalculate-investor-scores.js [--dry-run]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateInvestorScore } = require('../lib/investorGodScore');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

// calculateInvestorScore lives in lib/investorGodScore.js (operator-founder thesis aware)

async function main() {
  console.log(`\n🏦 INVESTOR SCORE RECALCULATION v3 ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));
  
  // Fetch all investors — include enriched fields from enrich-investor-deployment.js
  let allInvestors = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('investors')
      .select([
        'id, name, firm, bio, sectors, stage, type, is_individual, capital_type',
        'check_size_min, check_size_max, active_fund_size, fund_size_estimate_usd',
        'investment_thesis, geography_focus, signals, blog_url',
        'total_investments, successful_exits, notable_investments',
        'leads_rounds, follows_rounds',
        'last_investment_date, deployment_velocity_index',
        'investor_score, investor_tier',
        'linkedin_url, twitter_url, is_verified',
        'entity_gate',
      ].join(', '))
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allInvestors.push(...data);
    offset += data.length;
    if (data.length < BATCH_SIZE) break;
  }

  const qualified = allInvestors.filter(i => i.entity_gate !== 'junk');
  console.log(`📊 Total investors: ${allInvestors.length} (${qualified.length} non-junk, scoring all)`);

  // Score all
  const results = allInvestors.map(inv => {
    const score = calculateInvestorScore(inv);
    return { ...inv, newScore: score.total, newTier: score.tier, breakdown: score.breakdown, newSignals: score.signals };
  });

  // Distribution (0-100 buckets)
  const tierCounts = { elite: 0, strong: 0, solid: 0, emerging: 0 };
  const scoreVals = results.map(r => r.newScore);
  results.forEach(r => tierCounts[r.newTier]++);
  scoreVals.sort((a, b) => a - b);

  const mean   = scoreVals.reduce((s, v) => s + v, 0) / scoreVals.length;
  const median = scoreVals[Math.floor(scoreVals.length / 2)];
  const p75    = scoreVals[Math.floor(scoreVals.length * 0.75)];
  const p90    = scoreVals[Math.floor(scoreVals.length * 0.90)];

  console.log(`\n📈 GOD Score Distribution (v4, 0-100):`);
  console.log(`   Mean: ${mean.toFixed(1)} | Median: ${median} | p75: ${p75} | p90: ${p90}`);
  console.log(`   Min: ${scoreVals[0]} | Max: ${scoreVals[scoreVals.length - 1]}`);
  console.log(`   Tiers: Elite ${tierCounts.elite} (${(tierCounts.elite/scoreVals.length*100).toFixed(1)}%) | Strong ${tierCounts.strong} (${(tierCounts.strong/scoreVals.length*100).toFixed(1)}%) | Solid ${tierCounts.solid} (${(tierCounts.solid/scoreVals.length*100).toFixed(1)}%) | Emerging ${tierCounts.emerging} (${(tierCounts.emerging/scoreVals.length*100).toFixed(1)}%)`);

  // Histogram in 10-pt bands
  const bands = [
    [0,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,89],[90,100]
  ];
  console.log('\n   Histogram:');
  for (const [lo, hi] of bands) {
    const n = scoreVals.filter(s => s >= lo && s <= hi).length;
    const bar = '#'.repeat(Math.round(n / scoreVals.length * 60));
    console.log(`   ${(lo+'-'+hi).padStart(6)}: ${n.toString().padStart(5)} ${bar}`);
  }

  const oldScores = allInvestors.map(i => Number(i.investor_score) || 0);
  const oldMean = oldScores.reduce((s, v) => s + v, 0) / oldScores.length;
  const changed = results.filter(r => Math.abs(r.newScore - (Number(r.investor_score) || 0)) > 0.5).length;
  console.log(`\n   Old mean: ${oldMean.toFixed(1)} → New GOD mean: ${mean.toFixed(1)}`);
  console.log(`   Changed: ${changed} / ${results.length} investors`);

  // Top 20
  const top20 = [...results].sort((a, b) => b.newScore - a.newScore).slice(0, 20);
  console.log('\n🏆 Top 20 Investors by GOD Score:');
  top20.forEach((r, i) => {
    const bd = r.breakdown;
    console.log(`   ${(i+1).toString().padStart(2)}. GOD ${String(r.newScore).padStart(3)} (${r.newTier.padEnd(8)}) | ${(r.name || '').substring(0,26).padEnd(26)} | ${(r.firm || '').substring(0,22).padEnd(22)} | P${bd.profile} F${bd.focus} C${bd.capital} T${bd.track} A${bd.activity}`);
  });

  if (DRY_RUN) {
    console.log('\n⚙️  DRY RUN — no changes written. Run without --dry-run to apply.');
    return;
  }

  // Apply updates in batches, writing score + breakdown + signals
  console.log(`\n📝 Applying updates to ${changed} investors...`);
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < results.length; i += 50) {
    const batch = results.slice(i, i + 50);
    const promises = batch.map(async (r) => {
      const oldScore = Number(r.investor_score) || 0;
      if (Math.abs(r.newScore - oldScore) <= 0.5 && r.investor_tier === r.newTier) return;

      const { error } = await supabase.from('investors').update({
        investor_score: r.newScore,
        investor_tier:  r.newTier,
        score_breakdown: r.breakdown,
        score_signals:   r.newSignals,
        last_scored_at:  new Date().toISOString(),
      }).eq('id', r.id);

      if (error) {
        errors++;
        if (errors <= 3) console.error(`   Error updating ${r.name}: ${error.message}`);
      } else {
        updated++;
      }
    });

    await Promise.all(promises);
    if ((i + 50) % 500 === 0 || i + 50 >= results.length) {
      process.stdout.write(`   Progress: ${Math.min(i + 50, results.length)}/${results.length}\r`);
    }
  }

  console.log(`\n✅ Complete: ${updated} updated, ${errors} errors`);
}

main().catch(console.error);
