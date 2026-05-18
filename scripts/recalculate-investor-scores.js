#!/usr/bin/env node
/**
 * RECALCULATE INVESTOR GOD SCORES v4
 * ====================================
 * Converts investor scoring to the same 0-100 GOD scale used for startups,
 * enabling unified ranking across the platform.
 *
 * Score components (0-100 total):
 *   Profile Completeness  (0-25): bio, thesis, geography, social proof
 *   Investment Focus      (0-25): sectors, stage, investment type/thesis
 *   Capital Readiness     (0-20): check size, fund size, leads_rounds
 *   Track Record          (0-20): investments, exits, notable_investments
 *   Activity & Velocity   (0-10): last_investment_date recency, deployment_velocity_index
 *
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

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 200;

// ─────────────────────────────────────────────────────────────────────────────
// INVESTOR GOD SCORE v4 — 0-100 scale
// ─────────────────────────────────────────────────────────────────────────────

function calculateInvestorScore(investor) {
  const signals = [];

  // ── PROFILE COMPLETENESS (0-25) ──────────────────────────────────────────
  let profileScore = 0;

  const bio = investor.bio || '';
  if (bio.length > 200) { profileScore += 8; signals.push('Detailed bio'); }
  else if (bio.length > 50) { profileScore += 5; signals.push('Has bio'); }
  else if (bio.length > 0) { profileScore += 2; }

  if (investor.name && investor.firm) { profileScore += 4; }
  else if (investor.name || investor.firm) { profileScore += 2; }

  const geos = investor.geography_focus || [];
  if (geos.length >= 1) { profileScore += 5; signals.push('Geography defined'); }

  const thesis = investor.investment_thesis || '';
  if (thesis.length > 200) { profileScore += 6; signals.push('Deep thesis'); }
  else if (thesis.length > 50) { profileScore += 4; signals.push('Has thesis'); }
  else if (thesis.length > 0) { profileScore += 2; }

  // Social proof
  let socialCount = 0;
  if (investor.linkedin_url) socialCount++;
  if (investor.twitter_url) socialCount++;
  if (investor.is_verified) { socialCount++; signals.push('Verified'); }
  profileScore += Math.min(socialCount * 2, 4);

  profileScore = Math.min(Math.round(profileScore), 25);

  // ── INVESTMENT FOCUS (0-25) ───────────────────────────────────────────────
  let focusScore = 0;

  const sectors = investor.sectors || [];
  if (sectors.length >= 1 && sectors.length <= 3) { focusScore += 10; signals.push(`Focus: ${sectors.slice(0,2).join(', ')}`); }
  else if (sectors.length <= 6) { focusScore += 7; }
  else if (sectors.length > 6) { focusScore += 4; }

  const stages = investor.stage || [];
  if (stages.length >= 1 && stages.length <= 2) { focusScore += 9; }
  else if (stages.length <= 4) { focusScore += 6; }
  else if (stages.length > 0) { focusScore += 3; }

  const invType = (investor.type || '').toLowerCase();
  if (invType === 'vc') { focusScore += 5; }
  else if (invType === 'angel') { focusScore += 4; }
  else if (['pe','cvc','family office','accelerator','corporate vc'].includes(invType)) { focusScore += 3; }
  else if (invType) { focusScore += 2; }

  focusScore = Math.min(Math.round(focusScore), 25);

  // ── CAPITAL READINESS (0-20) ──────────────────────────────────────────────
  let capitalScore = 0;

  const minCheck = investor.check_size_min || 0;
  const maxCheck = investor.check_size_max || 0;
  if (minCheck > 0 && maxCheck > 0) { capitalScore += 8; signals.push(`Check: $${(minCheck/1e6).toFixed(1)}M–$${(maxCheck/1e6).toFixed(1)}M`); }
  else if (minCheck > 0 || maxCheck > 0) { capitalScore += 4; }

  // Fund size — prefer fund_size_estimate_usd (from enrichment), fallback to active_fund_size
  const fundSize = investor.fund_size_estimate_usd || investor.active_fund_size || 0;
  if (fundSize >= 1_000_000_000) { capitalScore += 7; signals.push('Mega fund $1B+'); }
  else if (fundSize >= 500_000_000) { capitalScore += 6; signals.push('Large fund $500M+'); }
  else if (fundSize >= 100_000_000) { capitalScore += 5; }
  else if (fundSize >= 20_000_000) { capitalScore += 3; }
  else if (fundSize > 0) { capitalScore += 2; }

  if (investor.leads_rounds) { capitalScore += 5; signals.push('Leads rounds'); }
  else if (investor.follows_rounds) { capitalScore += 2; }

  capitalScore = Math.min(Math.round(capitalScore), 20);

  // ── TRACK RECORD (0-20) ───────────────────────────────────────────────────
  let trackScore = 0;

  const investments = investor.total_investments || 0;
  if (investments >= 100) { trackScore += 8; signals.push('100+ investments'); }
  else if (investments >= 50) { trackScore += 6; }
  else if (investments >= 20) { trackScore += 4; }
  else if (investments >= 5) { trackScore += 2; }

  const exits = investor.successful_exits || 0;
  if (exits >= 10) { trackScore += 8; signals.push('10+ exits'); }
  else if (exits >= 5) { trackScore += 5; }
  else if (exits >= 1) { trackScore += 2; }

  // notable_investments is an array or JSON in DB — presence = signal
  const notable = investor.notable_investments;
  const notableCount = Array.isArray(notable) ? notable.length
    : (notable && typeof notable === 'object' ? Object.keys(notable).length : 0);
  if (notableCount >= 5) { trackScore += 4; signals.push(`${notableCount} notable investments`); }
  else if (notableCount >= 1) { trackScore += 2; }

  trackScore = Math.min(Math.round(trackScore), 20);

  // ── ACTIVITY & VELOCITY (0-10) ────────────────────────────────────────────
  // Rewards recently-active investors. Fills the "activity=0" gap that existed
  // in v3 because last_investment_date was only 18.7% populated.
  let activityScore = 0;

  const lastInvDate = investor.last_investment_date;
  if (lastInvDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastInvDate).getTime()) / 86_400_000);
    if (daysSince <= 60)   { activityScore += 8; signals.push('Invested <60 days ago'); }
    else if (daysSince <= 180) { activityScore += 6; signals.push('Invested <6 months ago'); }
    else if (daysSince <= 365) { activityScore += 4; }
    else if (daysSince <= 730) { activityScore += 2; }
    // >2 years = 0 activity credit
  }

  // deployment_velocity_index (0-100) from enrich-investor-deployment.js
  const velocity = investor.deployment_velocity_index || 0;
  if (velocity >= 70) { activityScore += 2; signals.push('High deployment velocity'); }
  else if (velocity >= 40) { activityScore += 1; }

  activityScore = Math.min(Math.round(activityScore), 10);

  // ── TOTAL & TIER ──────────────────────────────────────────────────────────
  const total = Math.min(profileScore + focusScore + capitalScore + trackScore + activityScore, 100);

  let tier;
  if (total >= 70) tier = 'elite';
  else if (total >= 50) tier = 'strong';
  else if (total >= 30) tier = 'solid';
  else tier = 'emerging';

  return {
    total: Math.round(total),
    breakdown: {
      profile:    profileScore,
      focus:      focusScore,
      capital:    capitalScore,
      track:      trackScore,
      activity:   activityScore,
    },
    tier,
    signals,
  };
}

async function main() {
  console.log(`\n🏦 INVESTOR SCORE RECALCULATION v3 ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));
  
  // Fetch all investors — include enriched fields from enrich-investor-deployment.js
  let allInvestors = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('investors')
      .select([
        'id, name, firm, bio, sectors, stage, type',
        'check_size_min, check_size_max, active_fund_size, fund_size_estimate_usd',
        'investment_thesis, geography_focus',
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
