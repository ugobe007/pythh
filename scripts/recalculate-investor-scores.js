#!/usr/bin/env node
/**
 * RECALCULATE INVESTOR SCORES v3
 * ==============================
 * Uses the rebalanced investorScoringService v2 to score all investors.
 * Previous scoring median was 1.6/10 because it required data (exits, fund size)
 * that 90%+ of investors don't have.
 * 
 * v3 weights what investors ACTUALLY provide:
 *   Profile Completeness (0-3): bio, thesis, geography
 *   Investment Focus (0-3): sectors, stage, type
 *   Capital Readiness (0-2): check size, fund, leads
 *   Track Record (0-2): investments, exits (bonus)
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

// ---- Inline the scoring logic (same as investorScoringService.ts v2) ----

function calculateInvestorScore(investor) {
  const signals = [];
  
  // PROFILE COMPLETENESS (0-3)
  let profileScore = 0;
  const bio = investor.bio || '';
  if (bio.length > 200) { profileScore += 0.8; signals.push('Detailed bio'); }
  else if (bio.length > 50) { profileScore += 0.5; signals.push('Has bio'); }
  else if (bio.length > 0) { profileScore += 0.2; }
  
  if (investor.name && investor.firm) { profileScore += 0.4; }
  else if (investor.name || investor.firm) { profileScore += 0.2; }
  
  const geos = investor.geography_focus || [];
  if (geos.length >= 1) { profileScore += 0.5; }
  
  const thesis = investor.investment_thesis || '';
  if (thesis.length > 200) { profileScore += 0.8; signals.push('Deep thesis'); }
  else if (thesis.length > 50) { profileScore += 0.5; signals.push('Has thesis'); }
  else if (thesis.length > 0) { profileScore += 0.2; }
  
  // Social proof
  let socialCount = 0;
  if (investor.linkedin_url) socialCount++;
  if (investor.twitter_url) socialCount++;
  if (investor.is_verified) socialCount++;
  profileScore += Math.min(socialCount * 0.25, 0.5);
  
  profileScore = Math.min(profileScore, 3);
  
  // INVESTMENT FOCUS (0-3)
  let focusScore = 0;
  const sectors = investor.sectors || [];
  if (sectors.length >= 1 && sectors.length <= 3) { focusScore += 1.2; signals.push(`Focus: ${sectors.slice(0,3).join(', ')}`); }
  else if (sectors.length <= 6) { focusScore += 0.9; }
  else if (sectors.length > 6) { focusScore += 0.5; }
  
  const stages = investor.stage || [];
  if (stages.length >= 1 && stages.length <= 2) { focusScore += 1.0; }
  else if (stages.length <= 4) { focusScore += 0.7; }
  else if (stages.length > 0) { focusScore += 0.4; }
  
  const invType = investor.type || '';
  if (invType === 'VC' || invType === 'vc') { focusScore += 0.6; }
  else if (invType === 'Angel' || invType === 'angel') { focusScore += 0.5; }
  else if (['PE','CVC','Family Office'].includes(invType)) { focusScore += 0.4; }
  else if (invType) { focusScore += 0.3; }
  
  focusScore = Math.min(focusScore, 3);
  
  // CAPITAL READINESS (0-2)
  let capitalScore = 0;
  const minCheck = investor.check_size_min || 0;
  const maxCheck = investor.check_size_max || 0;
  if (minCheck > 0 && maxCheck > 0) { capitalScore += 0.8; }
  else if (minCheck > 0 || maxCheck > 0) { capitalScore += 0.4; }
  
  const fundSize = investor.active_fund_size || 0;
  if (fundSize >= 500_000_000) { capitalScore += 0.7; signals.push('Large fund $500M+'); }
  else if (fundSize >= 100_000_000) { capitalScore += 0.6; }
  else if (fundSize >= 20_000_000) { capitalScore += 0.4; }
  else if (fundSize > 0) { capitalScore += 0.2; }
  
  if (investor.leads_rounds) { capitalScore += 0.5; signals.push('Leads rounds'); }
  else if (investor.follows_rounds) { capitalScore += 0.2; }
  
  capitalScore = Math.min(capitalScore, 2);
  
  // TRACK RECORD (0-2) - bonus
  let trackScore = 0;
  const investments = investor.total_investments || 0;
  if (investments >= 100) { trackScore += 1.0; signals.push('100+ investments'); }
  else if (investments >= 50) { trackScore += 0.8; }
  else if (investments >= 20) { trackScore += 0.6; }
  else if (investments >= 5) { trackScore += 0.3; }
  
  const exits = investor.successful_exits || 0;
  if (exits >= 10) { trackScore += 1.0; signals.push('10+ exits'); }
  else if (exits >= 5) { trackScore += 0.6; }
  else if (exits >= 1) { trackScore += 0.3; }
  
  trackScore = Math.min(trackScore, 2);
  
  // TOTAL
  const total = Math.min(profileScore + focusScore + capitalScore + trackScore, 10);
  
  let tier;
  if (total >= 7) tier = 'elite';
  else if (total >= 5) tier = 'strong';
  else if (total >= 3) tier = 'solid';
  else tier = 'emerging';
  
  return {
    total: Math.round(total * 10) / 10,
    breakdown: { profile_completeness: profileScore, investment_focus: focusScore, capital_readiness: capitalScore, track_record: trackScore },
    tier,
    signals,
  };
}

async function main() {
  console.log(`\n🏦 INVESTOR SCORE RECALCULATION v3 ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('='.repeat(50));
  
  // Fetch all investors
  let allInvestors = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from('investors')
      .select('id, name, firm, bio, sectors, stage, type, check_size_min, check_size_max, active_fund_size, investment_thesis, geography_focus, total_investments, successful_exits, leads_rounds, follows_rounds, investor_score, investor_tier, linkedin_url, twitter_url, is_verified')
      .range(offset, offset + BATCH_SIZE - 1);
    
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allInvestors.push(...data);
    offset += data.length;
    if (data.length < BATCH_SIZE) break;
  }
  
  console.log(`📊 Total investors: ${allInvestors.length}`);
  
  // Score all
  const results = allInvestors.map(inv => {
    const score = calculateInvestorScore(inv);
    return { ...inv, newScore: score.total, newTier: score.tier, breakdown: score.breakdown, signals: score.signals };
  });
  
  // Distribution
  const tierCounts = { elite: 0, strong: 0, solid: 0, emerging: 0 };
  const scores = results.map(r => r.newScore);
  results.forEach(r => tierCounts[r.newTier]++);
  
  scores.sort((a, b) => a - b);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const median = scores[Math.floor(scores.length / 2)];
  
  console.log(`\n📈 Score Distribution (NEW v3):`);
  console.log(`   Mean: ${mean.toFixed(1)} | Median: ${median.toFixed(1)} | Min: ${scores[0]} | Max: ${scores[scores.length - 1]}`);
  console.log(`   Tiers: Elite ${tierCounts.elite} (${(tierCounts.elite/scores.length*100).toFixed(1)}%) | Strong ${tierCounts.strong} (${(tierCounts.strong/scores.length*100).toFixed(1)}%) | Solid ${tierCounts.solid} (${(tierCounts.solid/scores.length*100).toFixed(1)}%) | Emerging ${tierCounts.emerging} (${(tierCounts.emerging/scores.length*100).toFixed(1)}%)`);
  
  // Histogram
  const buckets = {};
  for (let i = 0; i <= 10; i++) buckets[i] = 0;
  scores.forEach(s => buckets[Math.floor(s)]++);
  console.log('\n   Histogram:');
  for (let i = 0; i <= 10; i++) {
    const bar = '#'.repeat(Math.round(buckets[i] / scores.length * 60));
    console.log(`   ${i.toString().padStart(2)}: ${buckets[i].toString().padStart(5)} ${bar}`);
  }
  
  // Compare old vs new
  const oldScores = allInvestors.map(i => i.investor_score || 0);
  const oldMean = oldScores.reduce((s, v) => s + v, 0) / oldScores.length;
  const changed = results.filter(r => Math.abs(r.newScore - (r.investor_score || 0)) > 0.05).length;
  console.log(`\n   Old mean: ${oldMean.toFixed(1)} → New mean: ${mean.toFixed(1)} (delta: +${(mean - oldMean).toFixed(1)})`);
  console.log(`   Changed: ${changed} / ${results.length} investors`);
  
  // Top 10
  const top10 = [...results].sort((a, b) => b.newScore - a.newScore).slice(0, 10);
  console.log('\n🏆 Top 10 Investors:');
  top10.forEach((r, i) => {
    console.log(`   ${i+1}. Score ${r.newScore} (${r.newTier}) | ${(r.name || '').substring(0, 25).padEnd(25)} | ${(r.firm || '').substring(0, 20)} | ${r.signals.slice(0, 3).join(', ')}`);
  });
  
  if (DRY_RUN) {
    console.log('\n⚙️  DRY RUN - no changes written. Run without --dry-run to apply.');
    return;
  }
  
  // Apply updates in batches
  console.log(`\n📝 Applying updates to ${changed} investors...`);
  let updated = 0;
  let errors = 0;
  
  for (let i = 0; i < results.length; i += 50) {
    const batch = results.slice(i, i + 50);
    const promises = batch.map(async (r) => {
      const oldScore = r.investor_score || 0;
      if (Math.abs(r.newScore - oldScore) <= 0.05 && r.investor_tier === r.newTier) return;
      
      const { error } = await supabase.from('investors')
        .update({ investor_score: r.newScore, investor_tier: r.newTier })
        .eq('id', r.id);
      
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
