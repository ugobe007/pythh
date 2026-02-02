// Check database for matches
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkMatches() {
  console.log('🔍 Checking database counts...\n');
  
  // Check startup counts
  const { count: approved } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  
  const { count: totalStartups } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true });
  
  const { count: investors } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  console.log('✅ Approved startups:', approved);
  console.log('📊 Total startups:', totalStartups);
  console.log('👥 Total investors:', investors);
  console.log('');
  
  // Check total count
  const { count: totalCount } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total matches:', totalCount);
  
  // Check high-quality matches (score >= 60)
  const { data: highQuality, count: highCount } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact' })
    .gte('match_score', 60)
    .limit(5);
  
  console.log('Matches with score >= 60:', highCount);
  
  if (highQuality && highQuality.length > 0) {
    console.log('\nSample high-quality matches:');
    console.table(highQuality.map(m => ({
      startup_id: m.startup_id?.substring(0, 8),
      investor_id: m.investor_id?.substring(0, 8),
      score: m.match_score,
      status: m.status || 'NULL'
    })));
  }
  
  // Check match score distribution
  const { data: allMatches } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .limit(1000);
  
  if (allMatches && allMatches.length > 0) {
    const scores = allMatches.map(m => m.match_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    
    console.log('\nScore distribution (first 1000):');
    console.log('  Average:', avg.toFixed(2));
    console.log('  Max:', max);
    console.log('  Min:', min);
    console.log('  >= 80:', scores.filter(s => s >= 80).length);
    console.log('  >= 70:', scores.filter(s => s >= 70).length);
    console.log('  >= 60:', scores.filter(s => s >= 60).length);
  }
}

checkMatches().catch(console.error);
