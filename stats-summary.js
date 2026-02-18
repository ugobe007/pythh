const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  const { data } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved');
  
  const scores = data.map(s => s.total_god_score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sorted = scores.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length;
  const stddev = Math.sqrt(variance);
  
  console.log('\n📈 OVERALL STATISTICS:');
  console.log(`   Total Startups: ${scores.length}`);
  console.log(`   Average Score:  ${avg.toFixed(1)}`);
  console.log(`   Median Score:   ${median}`);
  console.log(`   Range:          ${Math.min(...scores)} - ${Math.max(...scores)}`);
  console.log(`   Std Deviation:  ${stddev.toFixed(1)}\n`);
})();
