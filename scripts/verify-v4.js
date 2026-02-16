const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const {data} = await supabase
    .from('startup_uploads')
    .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .limit(1000);
  
  const avgGod = data.reduce((sum, row) => sum + row.total_god_score, 0) / data.length;
  const avgTeam = data.reduce((sum, row) => sum + row.team_score, 0) / data.length;
  const avgTraction = data.reduce((sum, row) => sum + row.traction_score, 0) / data.length;
  const avgMarket = data.reduce((sum, row) => sum + row.market_score, 0) / data.length;
  const avgProduct = data.reduce((sum, row) => sum + row.product_score, 0) / data.length;
  const avgVision = data.reduce((sum, row) => sum + row.vision_score, 0) / data.length;
  const componentSum = avgTeam + avgTraction + avgMarket + avgProduct + avgVision;
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 V4 FINAL CALIBRATION RESULTS');
  console.log('='.repeat(70));
  console.log('');
  console.log('Total GOD Score:   ', avgGod.toFixed(2), '/ 100');
  console.log('Target Range:       63.00 - 65.00');
  console.log('Delta:             ', (avgGod - 64).toFixed(2), 'pts', avgGod > 64 ? 'ABOVE' : 'BELOW');
  console.log('');
  console.log('Component Averages (Expected with V4 divisors):');
  console.log('  Team:            ', avgTeam.toFixed(2), '/ 20  (divisor: 3.9)');
  console.log('  Traction:        ', avgTraction.toFixed(2), '/ 20  (divisor: 3.9)');
  console.log('  Market:          ', avgMarket.toFixed(2), '/ 20  (divisor: 2.3)');
  console.log('  Product:         ', avgProduct.toFixed(2), '/ 20  (divisor: 1.6)');
  console.log('  Vision:          ', avgVision.toFixed(2), '/ 20  (divisor: 1.4)');
  console.log('  ──────────────────────────────');
  console.log('  Component Sum:   ', componentSum.toFixed(2), '/ 100');
  console.log('');
  console.log('Verification:       ', Math.abs(componentSum - avgGod) < 0.1 ? '✅ Components match' : '❌ Mismatch!');
  console.log('');
  const status = avgGod >= 63 && avgGod <= 65 ? '✅ TARGET ACHIEVED' : 
                 avgGod >= 65 && avgGod <= 68 ? '✅ ACCEPTABLE (close to target)' : 
                 '⚠️  Outside acceptable range';
  console.log('Status:            ', status);
  console.log('='.repeat(70) + '\n');
  
  process.exit(0);
})();
