const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

(async () => {
  const s = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎯 FINAL GOD SCORE VERIFICATION (ALL STARTUPS)');
  console.log('═'.repeat(70));
  
  const {data} = await s
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved');
  
  const avg = data.reduce((a,b) => a + b.total_god_score, 0) / data.length;
  const below40 = data.filter(s => s.total_god_score < 40).length;
  const range_40_60 = data.filter(s => s.total_god_score >= 40 && s.total_god_score < 60).length;
  const range_60_80 = data.filter(s => s.total_god_score >= 60 && s.total_god_score < 80).length;
  const above80 = data.filter(s => s.total_god_score >= 80).length;
  
  console.log('\n📊 DISTRIBUTION:');
  console.log('   Total startups:', data.length);
  console.log('   Below 40:', below40, `(${(below40/data.length*100).toFixed(1)}%)`);
  console.log('   40-60:', range_40_60, `(${(range_40_60/data.length*100).toFixed(1)}%)`);
  console.log('   60-80:', range_60_80, `(${(range_60_80/data.length*100).toFixed(1)}%)`);
  console.log('   80+:', above80, `(${(above80/data.length*100).toFixed(1)}%)`);
  console.log('');
  console.log('📈 AVERAGE:', avg.toFixed(2), '/ 100');
  console.log('   Target Range: 50-62');
  console.log('');
  
  if (avg >= 50 && avg <= 62) {
    console.log('   ✅✅✅ TARGET ACHIEVED! ✅✅✅');
  } else if (avg >= 45 && avg < 50) {
    console.log('   🟡 Close (floor may need to be 42-45)');
  } else if (avg > 62) {
    console.log('   ⚠️  Above target (floor too high, reduce to 35-38)');
  } else {
    console.log('   ⚠️  Below target (run full recalc with new V5 divisors)');
  }
  
  console.log('\n' + '═'.repeat(70));
  process.exit(0);
})();
