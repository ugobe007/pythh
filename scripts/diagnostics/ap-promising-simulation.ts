/**
 * AP + Promising Simulation
 * Runs the AP scoring service against ALL Bachelor and Freshman startups
 * to project the impact before any live changes.
 * 
 * READ-ONLY — does NOT modify any database records.
 */
import { createClient } from '@supabase/supabase-js';
import { calculateAPBonus, calculatePromisingBonus, AP_SCORING_CONFIG } from '../../server/services/apScoringService';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function simulate() {
  console.log('=== AP + PROMISING SIMULATION ===\n');
  console.log('Config:', JSON.stringify(AP_SCORING_CONFIG, null, 2));

  // Load all approved startups
  const allStartups: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, extracted_data, pitch, description, tagline, website, stage, sectors, is_launched, has_demo, has_revenue, has_customers, growth_rate, team_signals, execution_signals, credential_signals, lead_investor, latest_funding_amount, latest_funding_round, latest_funding_date, created_at, followon_investors, is_oversubscribed, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, advisors, strategic_partners, founders, founder_avg_age, has_technical_cofounder, customer_count, arr, mrr, contrarian_belief, why_now, unfair_advantage')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .range(from, from + batchSize - 1);
    
    if (error) { console.error('Error:', error); break; }
    if (!data || data.length === 0) break;
    allStartups.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  console.log(`\nTotal approved startups: ${allStartups.length}`);
  
  // Current distribution
  const currentPhD = allStartups.filter(s => s.total_god_score >= 80).length;
  const currentMasters = allStartups.filter(s => s.total_god_score >= 60 && s.total_god_score < 80).length;
  const currentBachelor = allStartups.filter(s => s.total_god_score >= 45 && s.total_god_score < 60).length;
  const currentFreshman = allStartups.filter(s => s.total_god_score >= 40 && s.total_god_score < 45).length;
  
  console.log('\n=== CURRENT DISTRIBUTION ===');
  console.log(`  PhD (80+):     ${currentPhD} (${(currentPhD/allStartups.length*100).toFixed(1)}%)`);
  console.log(`  Masters (60-79): ${currentMasters} (${(currentMasters/allStartups.length*100).toFixed(1)}%)`);
  console.log(`  Bachelor (45-59): ${currentBachelor} (${(currentBachelor/allStartups.length*100).toFixed(1)}%)`);
  console.log(`  Freshman (40-44): ${currentFreshman} (${(currentFreshman/allStartups.length*100).toFixed(1)}%)`);

  // Run simulation
  let apApplied = 0;
  let apTotalBonus = 0;
  let promisingApplied = 0;
  let promisingTotalBonus = 0;
  let freshmanToBachelor = 0;
  let bachelorToMasters = 0;
  let bachelorToPhD = 0;
  
  const apResults: any[] = [];
  const promisingResults: any[] = [];
  const simulatedScores: number[] = [];

  for (const s of allStartups) {
    const god = s.total_god_score || 0;
    let newScore = god;
    
    if (god >= 45 && god <= 59) {
      const ap = calculateAPBonus(s);
      if (ap.bonus > 0) {
        apApplied++;
        apTotalBonus += ap.bonus;
        newScore = Math.min(god + Math.round(ap.bonus), 100);
        apResults.push({ name: s.name, from: god, to: newScore, bonus: ap.bonus, dims: ap.dimensions, flags: ap.flags });
      }
    } else if (god >= 40 && god <= 44) {
      const prom = calculatePromisingBonus(s);
      if (prom.bonus > 0) {
        promisingApplied++;
        promisingTotalBonus += prom.bonus;
        newScore = Math.min(god + Math.round(prom.bonus), 100);
        promisingResults.push({ name: s.name, from: god, to: newScore, bonus: prom.bonus, dims: prom.dimensions, flags: prom.flags });
      }
    }
    
    if (god < 45 && newScore >= 45) freshmanToBachelor++;
    if (god < 60 && newScore >= 60) bachelorToMasters++;
    if (god < 80 && newScore >= 80) bachelorToPhD++;
    
    simulatedScores.push(newScore);
  }

  // Simulated distribution
  const simPhD = simulatedScores.filter(s => s >= 80).length;
  const simMasters = simulatedScores.filter(s => s >= 60 && s < 80).length;
  const simBachelor = simulatedScores.filter(s => s >= 45 && s < 60).length;
  const simFreshman = simulatedScores.filter(s => s >= 40 && s < 45).length;
  
  console.log('\n=== SIMULATED DISTRIBUTION (with AP + Promising) ===');
  console.log(`  PhD (80+):     ${simPhD} (${(simPhD/allStartups.length*100).toFixed(1)}%) [was: ${currentPhD}] ${simPhD > currentPhD ? '+' + (simPhD - currentPhD) : ''}`);
  console.log(`  Masters (60-79): ${simMasters} (${(simMasters/allStartups.length*100).toFixed(1)}%) [was: ${currentMasters}] ${simMasters > currentMasters ? '+' + (simMasters - currentMasters) : ''}`);
  console.log(`  Bachelor (45-59): ${simBachelor} (${(simBachelor/allStartups.length*100).toFixed(1)}%) [was: ${currentBachelor}] ${simBachelor !== currentBachelor ? (simBachelor - currentBachelor > 0 ? '+' : '') + (simBachelor - currentBachelor) : ''}`);
  console.log(`  Freshman (40-44): ${simFreshman} (${(simFreshman/allStartups.length*100).toFixed(1)}%) [was: ${currentFreshman}] ${simFreshman !== currentFreshman ? (simFreshman - currentFreshman > 0 ? '+' : '') + (simFreshman - currentFreshman) : ''}`);

  // AP summary
  console.log('\n=== AP BACHELOR RESULTS ===');
  console.log(`  Startups receiving AP bonus: ${apApplied} / ${currentBachelor} (${(apApplied/currentBachelor*100).toFixed(1)}%)`);
  console.log(`  Average AP bonus: ${apApplied > 0 ? (apTotalBonus/apApplied).toFixed(1) : 0} pts`);
  console.log(`  Promoted to Masters: ${bachelorToMasters}`);
  console.log(`  Promoted to PhD: ${bachelorToPhD}`);
  
  // AP bonus distribution
  const apBonusBuckets = [0, 1, 2, 3, 4, 5, 6];
  console.log('\n  AP Bonus Distribution:');
  for (const b of apBonusBuckets) {
    const count = apResults.filter(r => Math.round(r.bonus) === b).length;
    if (count > 0) {
      const bar = '█'.repeat(Math.min(Math.round(count / 5), 50));
      console.log(`    +${b} pts: ${count} ${bar}`);
    }
  }

  // AP dimension breakdown
  console.log('\n  AP Dimension Activation:');
  const apWithProductDemand = apResults.filter(r => r.flags.some((f: string) => f.includes('Product'))).length;
  const apWithFunding = apResults.filter(r => r.flags.some((f: string) => f.includes('Funding'))).length;
  const apWithTeam = apResults.filter(r => r.flags.some((f: string) => f.includes('Team'))).length;
  const apWithSmartMoney = apResults.filter(r => r.flags.some((f: string) => f.includes('SmartMoney'))).length;
  console.log(`    📋 Product×Demand: ${apWithProductDemand} (${(apWithProductDemand/Math.max(apApplied,1)*100).toFixed(1)}%)`);
  console.log(`    💰 Funding: ${apWithFunding} (${(apWithFunding/Math.max(apApplied,1)*100).toFixed(1)}%)`);
  console.log(`    ⭐ Team: ${apWithTeam} (${(apWithTeam/Math.max(apApplied,1)*100).toFixed(1)}%)`);
  console.log(`    🏆 SmartMoney: ${apWithSmartMoney} (${(apWithSmartMoney/Math.max(apApplied,1)*100).toFixed(1)}%)`);

  // Promising summary
  console.log('\n=== PROMISING FRESHMAN RESULTS ===');
  console.log(`  Startups receiving bonus: ${promisingApplied} / ${currentFreshman} (${(promisingApplied/currentFreshman*100).toFixed(1)}%)`);
  console.log(`  Average bonus: ${promisingApplied > 0 ? (promisingTotalBonus/promisingApplied).toFixed(1) : 0} pts`);
  console.log(`  Promoted to Bachelor: ${freshmanToBachelor}`);
  
  // Promising bonus distribution
  console.log('\n  Promising Bonus Distribution:');
  for (const b of [1, 2, 3, 4]) {
    const count = promisingResults.filter(r => Math.round(r.bonus) === b).length;
    if (count > 0) {
      const bar = '█'.repeat(Math.min(Math.round(count / 5), 50));
      console.log(`    +${b} pts: ${count} ${bar}`);
    }
  }

  // Promising dimension breakdown
  console.log('\n  Promising Dimension Activation:');
  const pWithSector = promisingResults.filter(r => r.flags.some((f: string) => f.includes('Sector'))).length;
  const pWithProduct = promisingResults.filter(r => r.flags.some((f: string) => f.includes('Product'))).length;
  const pWithFunding = promisingResults.filter(r => r.flags.some((f: string) => f.includes('Funded'))).length;
  const pWithStory = promisingResults.filter(r => r.flags.some((f: string) => f.includes('Story'))).length;
  const pWithTeam = promisingResults.filter(r => r.flags.some((f: string) => f.includes('Team'))).length;
  console.log(`    🔥 Hot Sector: ${pWithSector} (${(pWithSector/Math.max(promisingApplied,1)*100).toFixed(1)}%)`);
  console.log(`    🚀 Product: ${pWithProduct} (${(pWithProduct/Math.max(promisingApplied,1)*100).toFixed(1)}%)`);
  console.log(`    💰 Funded: ${pWithFunding} (${(pWithFunding/Math.max(promisingApplied,1)*100).toFixed(1)}%)`);
  console.log(`    📝 Story: ${pWithStory} (${(pWithStory/Math.max(promisingApplied,1)*100).toFixed(1)}%)`);
  console.log(`    ⭐ Team: ${pWithTeam} (${(pWithTeam/Math.max(promisingApplied,1)*100).toFixed(1)}%)`);

  // Top AP promotions
  console.log('\n=== TOP AP PROMOTIONS (to Masters) ===');
  const topAP = apResults.filter(r => r.to >= 60).sort((a, b) => b.to - a.to || b.bonus - a.bonus).slice(0, 20);
  for (const r of topAP) {
    console.log(`  ${r.name}: ${r.from} → ${r.to} (+${r.bonus}) | ${r.flags.join(' ')}`);
  }

  // Top Promising promotions
  console.log('\n=== TOP PROMISING PROMOTIONS (to Bachelor) ===');
  const topProm = promisingResults.filter(r => r.to >= 45).sort((a, b) => b.to - a.to || b.bonus - a.bonus).slice(0, 20);
  for (const r of topProm) {
    console.log(`  ${r.name}: ${r.from} → ${r.to} (+${r.bonus}) | ${r.flags.join(' ')}`);
  }

  // Net movement summary
  console.log('\n=== NET MOVEMENT SUMMARY ===');
  console.log(`  Freshman → Bachelor: ${freshmanToBachelor}`);
  console.log(`  Bachelor → Masters:  ${bachelorToMasters}`);
  console.log(`  Bachelor → PhD:      ${bachelorToPhD}`);
  console.log(`  Total AP bonuses:    ${apApplied}`);
  console.log(`  Total Promising:     ${promisingApplied}`);
  console.log(`  Untouched:           ${allStartups.length - apApplied - promisingApplied}`);
  
  // Avg/Max/Min stats
  const avg = simulatedScores.reduce((a, b) => a + b, 0) / simulatedScores.length;
  const max = Math.max(...simulatedScores);
  const min = Math.min(...simulatedScores);
  console.log(`\n  Stats: Avg: ${avg.toFixed(1)} | Max: ${max} | Min: ${min}`);
}

simulate().catch(console.error);
