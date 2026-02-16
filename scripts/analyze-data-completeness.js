const {createClient} = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('\n🔍 DATA COMPLETENESS ANALYSIS\n');
  console.log('═'.repeat(70));
  
  // Get sample of top and bottom scoring startups
  const {data: top} = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, extracted_data')
    .eq('status', 'approved')
    .order('total_god_score', {ascending: false})
    .limit(50);
  
  const {data: bottom} = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, extracted_data')
    .eq('status', 'approved')
    .order('total_god_score', {ascending: true})
    .limit(50);
  
  // Analyze top 50
  let topWithData = 0;
  let topWithoutData = 0;
  let topAvg = 0;
  
  top.forEach(s => {
    topAvg += s.total_god_score;
    if (s.extracted_data && Object.keys(s.extracted_data).length > 3) {
      topWithData++;
    } else {
      topWithoutData++;
    }
  });
  
  // Analyze bottom 50
  let bottomWithData = 0;
  let bottomWithoutData = 0;
  let bottomAvg = 0;
  let bottomZeroScores = 0;
  
  bottom.forEach(s => {
    bottomAvg += s.total_god_score;
    if (s.total_god_score === 0 || s.total_god_score < 10) {
      bottomZeroScores++;
    }
    if (s.extracted_data && Object.keys(s.extracted_data).length > 3) {
      bottomWithData++;
    } else {
      bottomWithoutData++;
    }
  });
  
  console.log('📊 TOP 50 STARTUPS:');
  console.log('  Average GOD Score:', (topAvg/50).toFixed(2), '/100');
  console.log('  With extracted data:', topWithData, '(' + (topWithData/50*100).toFixed(0) + '%)');
  console.log('  Without/sparse data:', topWithoutData, '(' + (topWithoutData/50*100).toFixed(0) + '%)');
  console.log('');
  
  console.log('📊 BOTTOM 50 STARTUPS:');
  console.log('  Average GOD Score:', (bottomAvg/50).toFixed(2), '/100');
  console.log('  Near-zero scores (<10):', bottomZeroScores, '(' + (bottomZeroScores/50*100).toFixed(0) + '%)');
  console.log('  With extracted data:', bottomWithData, '(' + (bottomWithData/50*100).toFixed(0) + '%)');
  console.log('  Without/sparse data:', bottomWithoutData, '(' + (bottomWithoutData/50*100).toFixed(0) + '%)');
  console.log('');
  
  console.log('🔍 BOTTOM 10 STARTUPS (Detailed):');
  console.log('─'.repeat(70));
  bottom.slice(0, 10).forEach(s => {
    const dataFields = s.extracted_data ? Object.keys(s.extracted_data).length : 0;
    const hasData = dataFields > 3 ? '✅' : '❌';
    console.log(`  ${s.name.substring(0, 25).padEnd(25)} | GOD: ${String(s.total_god_score).padStart(2)} | ${hasData} Data fields: ${dataFields}`);
    console.log(`    Components: T:${s.team_score} Tr:${s.traction_score} M:${s.market_score} P:${s.product_score} V:${s.vision_score}`);
  });
  
  console.log('\n═'.repeat(70));
  console.log('');
  console.log('📊 DIAGNOSIS:');
  const dataImbalance = bottomWithoutData - topWithoutData;
  if (dataImbalance > 20) {
    console.log('  🚨 CONFIRMED: Low-scoring startups have significantly less data');
    console.log(`     Data gap: ${dataImbalance} more startups without data in bottom 50`);
    console.log('');
    console.log('  💡 RECOMMENDATION:');
    console.log('     Option A: Filter out startups with <3 data fields from GOD scoring');
    console.log('     Option B: Implement "Bootstrap Score" for sparse-data startups');
    console.log('     Option C: Reduce divisors (more generous scoring for all)');
  } else {
    console.log('  ✅ Data completeness is similar across score ranges');
  console.log('     The low scores may be accurate based on available data.');
  }
  console.log('');
  console.log('═'.repeat(70));
  
  process.exit(0);
})();
