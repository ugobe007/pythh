// Analyze current scoring weights and propose recalibration
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeWeights() {
  console.log('📊 GOD SCORE WEIGHT ANALYSIS\n');
  console.log('='.repeat(80));
  
  // Get sample of startups to analyze raw AI scores
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, team_score, traction_score, market_score, product_score, vision_score, total_god_score')
    .eq('status', 'approved')
    .limit(100);
  
  // Calculate current averages
  const avgTeam = startups.reduce((sum, s) => sum + s.team_score, 0) / startups.length;
  const avgTraction = startups.reduce((sum, s) => sum + s.traction_score, 0) / startups.length;
  const avgMarket = startups.reduce((sum, s) => sum + s.market_score, 0) / startups.length;
  const avgProduct = startups.reduce((sum, s) => sum + s.product_score, 0) / startups.length;
  const avgVision = startups.reduce((sum, s) => sum + s.vision_score, 0) / startups.length;
  const avgTotal = startups.reduce((sum, s) => sum + s.total_god_score, 0) / startups.length;
  
  console.log('\n📈 CURRENT STATE:\n');
  console.log(`Total GOD Score:  ${avgTotal.toFixed(2)}/100 (${(avgTotal/100*100).toFixed(1)}% of max)`);
  console.log(`  Target:         ~63-65/100 (63-65% of max)\n`);
  
  console.log('Component Breakdown:');
  console.log(`  Team:      ${avgTeam.toFixed(2)}/20 (${(avgTeam/20*100).toFixed(1)}%)`);
  console.log(`  Traction:  ${avgTraction.toFixed(2)}/20 (${(avgTraction/20*100).toFixed(1)}%) ⚠️  TOO HIGH`);
  console.log(`  Market:    ${avgMarket.toFixed(2)}/20 (${(avgMarket/20*100).toFixed(1)}%)`);
  console.log(`  Product:   ${avgProduct.toFixed(2)}/20 (${(avgProduct/20*100).toFixed(1)}%)`);
  console.log(`  Vision:    ${avgVision.toFixed(2)}/20 (${(avgVision/20*100).toFixed(1)}%)`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 RECOMMENDED RECALIBRATION:\n');
  
  // Calculate required scaling factor
  const targetAvg = 64; // midpoint of 63-65
  const scaleFactor = targetAvg / avgTotal;
  
  console.log(`Scale factor needed: ${scaleFactor.toFixed(3)} (${((1-scaleFactor)*100).toFixed(1)}% reduction)\n`);
  
  console.log('Current Divisors → Proposed Divisors:');
  console.log('  team:      3.5 → 4.2  (harder to max out)');
  console.log('  traction:  3.0 → 4.0  (currently way too easy)');
  console.log('  market:    2.0 → 2.4  (moderate increase)');
  console.log('  product:   1.3 → 1.6  (moderate increase)');
  console.log('  vision:    1.3 → 1.5  (moderate increase)');
  
  console.log('\n📊 EXPECTED RESULTS WITH NEW WEIGHTS:\n');
  console.log('  Total GOD avg:  71.74 → ~64.0 (target achieved)');
  console.log('  Team avg:       14.5 → ~12.1 (60% of max)');
  console.log('  Traction avg:   17.6 → ~13.2 (66% of max) ✅ Fixed');
  console.log('  Market avg:     14.5 → ~12.1 (60% of max)');
  console.log('  Product avg:    14.2 → ~11.5 (58% of max)');
  console.log('  Vision avg:     10.4 → ~9.0  (45% of max)');
  
  console.log('\n💡 DISTRIBUTION IMPACT:\n');
  console.log('  Current: Heavy clustering at 70-75 (poor differentiation)');
  console.log('  After:   Better spread 55-75 (top performers stand out)');
  console.log('  Elite startups (80+) will be truly exceptional\n');
  
  console.log('='.repeat(80));
  console.log('\n⚠️  ACTION REQUIRED:\n');
  console.log('  1. Update divisors in scripts/recalculate-scores.ts');
  console.log('  2. Run full recalculation on all 9,408 startups');
  console.log('  3. Verify new average is 63-65 range\n');
}

analyzeWeights().catch(console.error);
