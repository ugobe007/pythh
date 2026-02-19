require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY from .env
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeScores() {
  // Get GOD score distribution
  const { data: scores, error } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status, created_at')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\n📊 GOD SCORE DISTRIBUTION (Approved Startups)\n');
  console.log('Total Approved:', scores.length);
  
  const avg = scores.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / scores.length;
  const max = Math.max(...scores.map(s => s.total_god_score || 0));
  const min = Math.min(...scores.map(s => s.total_god_score || 0));
  const median = scores[Math.floor(scores.length / 2)]?.total_god_score || 0;
  
  console.log('Average:', avg.toFixed(2));
  console.log('Median:', median);
  console.log('Range:', min, '-', max);
  
  // Distribution buckets
  const buckets = { '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80+': 0 };
  scores.forEach(s => {
    const score = s.total_god_score || 0;
    if (score < 50) buckets['40-49']++;
    else if (score < 60) buckets['50-59']++;
    else if (score < 70) buckets['60-69']++;
    else if (score < 80) buckets['70-79']++;
    else buckets['80+']++;
  });
  
  console.log('\nDistribution:');
  Object.entries(buckets).forEach(([range, count]) => {
    const pct = ((count / scores.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(count / 10));
    console.log(`  ${range}: ${count} (${pct}%) ${bar}`);
  });
  
  // Check component score averages
  console.log('\n📈 COMPONENT SCORE AVERAGES\n');
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  components.forEach(comp => {
    const validScores = scores.filter(s => s[comp] != null);
    if (validScores.length > 0) {
      const compAvg = validScores.reduce((sum, s) => sum + s[comp], 0) / validScores.length;
      console.log(`  ${comp.replace('_score', '').toUpperCase()}: ${compAvg.toFixed(2)} (n=${validScores.length})`);
    }
  });
  
  // Top 10
  console.log('\n🏆 TOP 10 STARTUPS\n');
  scores.slice(0, 10).forEach((s, i) => {
    console.log(`${i+1}. ${s.name} - GOD: ${s.total_god_score}`);
    console.log(`   T:${s.team_score || 'N/A'} TR:${s.traction_score || 'N/A'} M:${s.market_score || 'N/A'} P:${s.product_score || 'N/A'} V:${s.vision_score || 'N/A'}`);
  });
  
  // Bottom 10
  console.log('\n⚠️  BOTTOM 10 STARTUPS\n');
  scores.slice(-10).reverse().forEach((s, i) => {
    console.log(`${i+1}. ${s.name} - GOD: ${s.total_god_score}`);
    console.log(`   T:${s.team_score || 'N/A'} TR:${s.traction_score || 'N/A'} M:${s.market_score || 'N/A'} P:${s.product_score || 'N/A'} V:${s.vision_score || 'N/A'}`);
  });
}

analyzeScores().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
