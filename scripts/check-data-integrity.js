const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const {data, error} = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .limit(1000);
  
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  let mismatch = 0;
  let correct = 0;
  let totalGodSum = 0;
  let componentSum = 0;
  const examples = [];
  
  data.forEach(r => {
    const sum = r.team_score + r.traction_score + r.market_score + r.product_score + r.vision_score;
    const diff = Math.abs(r.total_god_score - sum);
    totalGodSum += r.total_god_score;
    componentSum += sum;
    
    if (diff > 1) {
      mismatch++;
      if (examples.length < 5) {
        examples.push({name: r.name, god: r.total_god_score, sum, diff});
      }
    } else {
      correct++;
    }
  });
  
  console.log('════════════════════════════════════════════════════════');
  console.log('✅ DATA INTEGRITY CHECK');
  console.log('════════════════════════════════════════════════════════\n');
  
  console.log('📊 RESULTS:');
  console.log('  ✅ Correct:  ', correct, '/', data.length, `(${((correct / data.length) * 100).toFixed(1)}%)`);
  console.log('  ❌ Mismatch: ', mismatch, '/', data.length, `(${((mismatch / data.length) * 100).toFixed(1)}%)`);
  
  console.log('\n📈 AVERAGES:');
  console.log('  Total GOD Score (stored):     ', (totalGodSum / data.length).toFixed(2), '/ 100');
  console.log('  Component Sum (calculated):   ', (componentSum / data.length).toFixed(2), '/ 100');
  console.log('  Difference:                   ', Math.abs((totalGodSum - componentSum) / data.length).toFixed(2), 'pts');
  
  if (examples.length > 0) {
    console.log('\n⚠️  MISMATCH EXAMPLES:');
    examples.forEach(e => {
      console.log(`  ${e.name}: GOD=${e.god}, Sum=${e.sum}, Diff=${e.diff}`);
    });
  }
  
  console.log('\n════════════════════════════════════════════════════════');
  if (mismatch === 0) {
    console.log('✅ DATA INTEGRITY: PERFECT');
  } else if (mismatch < data.length * 0.01) {
    console.log('✅ DATA INTEGRITY: ACCEPTABLE (<1% mismatch)');
  } else if (mismatch < data.length * 0.05) {
    console.log('⚠️  DATA INTEGRITY: NEEDS ATTENTION (1-5% mismatch)');
  } else {
    console.log('🚨 DATA INTEGRITY: CRITICAL (>5% mismatch)');
  }
  console.log('════════════════════════════════════════════════════════\n');
  
  process.exit(mismatch === 0 ? 0 : 1);
})();
