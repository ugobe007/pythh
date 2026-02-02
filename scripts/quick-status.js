// Quick status check script
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n📊 HOT HONEY STATUS CHECK\n');
  
  // Social signals
  const { count: signalCount } = await supabase
    .from('social_signals')
    .select('*', { count: 'exact', head: true });
  console.log('🔗 Social Signals collected:', signalCount);
  
  // Score distribution
  const { data: scores } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved');
  
  if (!scores || scores.length === 0) {
    console.log('No approved startups found');
    return;
  }
  
  const total = scores.length;
  const avg = scores.reduce((a, s) => a + (s.total_god_score || 0), 0) / total;
  
  const ranges = {
    '40-49': scores.filter(s => s.total_god_score >= 40 && s.total_god_score < 50).length,
    '50-59': scores.filter(s => s.total_god_score >= 50 && s.total_god_score < 60).length,
    '60-69': scores.filter(s => s.total_god_score >= 60 && s.total_god_score < 70).length,
    '70-79': scores.filter(s => s.total_god_score >= 70 && s.total_god_score < 80).length,
    '80+': scores.filter(s => s.total_god_score >= 80).length,
  };
  
  console.log('\n📈 GOD Score Distribution:');
  console.log('  40-49:', ranges['40-49'], `(${(ranges['40-49']/total*100).toFixed(1)}%)`);
  console.log('  50-59:', ranges['50-59'], `(${(ranges['50-59']/total*100).toFixed(1)}%)`);
  console.log('  60-69:', ranges['60-69'], `(${(ranges['60-69']/total*100).toFixed(1)}%)`);
  console.log('  70-79:', ranges['70-79'], `(${(ranges['70-79']/total*100).toFixed(1)}%)`);
  console.log('  80+:  ', ranges['80+'], `(${(ranges['80+']/total*100).toFixed(1)}%)`);
  console.log('\n📊 Average GOD Score:', avg.toFixed(1));
  console.log('📦 Total approved startups:', total);
  
  // Compare with BEFORE (54.6% were in 40-49)
  const improvement = 54.6 - (ranges['40-49']/total*100);
  console.log(`\n✨ Improvement: 40-49 band reduced by ${improvement.toFixed(1)}% from 54.6%`);
}

main().catch(console.error);
