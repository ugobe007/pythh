// Quick check of current GOD score average
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data } = await supabase
    .from('startup_uploads')
    .select('total_god_score, enhanced_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .limit(1000);
  
  const avgBase = data.reduce((sum, s) => sum + s.total_god_score, 0) / data.length;
  const avgEnhanced = data.reduce((sum, s) => sum + s.enhanced_god_score, 0) / data.length;
  const avgTeam = data.reduce((sum, s) => sum + s.team_score, 0) / data.length;
  const avgTraction = data.reduce((sum, s) => sum + s.traction_score, 0) / data.length;
  const avgMarket = data.reduce((sum, s) => sum + s.market_score, 0) / data.length;
  const avgProduct = data.reduce((sum, s) => sum + s.product_score, 0) / data.length;
  const avgVision = data.reduce((sum, s) => sum + s.vision_score, 0) / data.length;
  
  console.log('\n📊 CURRENT GOD SCORE AVERAGES:\n');
  console.log(`Base GOD:     ${avgBase.toFixed(2)}/100  (Target: 63-65)`);
  console.log(`Enhanced:     ${avgEnhanced.toFixed(2)}/85`);
  console.log('\nComponents:');
  console.log(`  Team:       ${avgTeam.toFixed(2)}/20`);
  console.log(`  Traction:   ${avgTraction.toFixed(2)}/20`);
  console.log(`  Market:     ${avgMarket.toFixed(2)}/20`);
  console.log(`  Product:    ${avgProduct.toFixed(2)}/20`);
  console.log(`  Vision:     ${avgVision.toFixed(2)}/20`);
  console.log(`\n${avgBase >= 63 && avgBase <= 65 ? '✅ TARGET ACHIEVED!' : avgBase < 63 ? '⚠️  Below target' : '⚠️  Still too high'}\n`);
})();
