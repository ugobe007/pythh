const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Total count
  const { count } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  console.log('Total matches:', count);
  
  // Recent matches (ordered by created_at DESC)
  const { data: recent } = await supabase
    .from('startup_investor_matches')
    .select('match_score, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (recent?.length) {
    const scores = recent.map(m => m.match_score).filter(s => s != null);
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    console.log('\n=== Recent 1000 matches (newest first) ===');
    console.log('  Avg:', avg.toFixed(2));
    console.log('  Min:', Math.min(...scores).toFixed(2));
    console.log('  Max:', Math.max(...scores).toFixed(2));
    console.log('  First (newest):', recent[0]?.created_at);
    console.log('  Last (1000th):', recent[recent.length-1]?.created_at);
    
    const above90 = scores.filter(s => s >= 90).length;
    const below60 = scores.filter(s => s < 60).length;
    console.log('  Above 90:', above90, '('+(above90/scores.length*100).toFixed(1)+'%)');
    console.log('  Below 60:', below60, '('+(below60/scores.length*100).toFixed(1)+'%)');
  }
  
  // Oldest matches (what UI is probably fetching)
  const { data: oldest } = await supabase
    .from('startup_investor_matches')
    .select('match_score, created_at')
    .order('created_at', { ascending: true })
    .limit(1000);
  
  if (oldest?.length) {
    const scores = oldest.map(m => m.match_score).filter(s => s != null);
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    console.log('\n=== Oldest 1000 matches (what UI might fetch) ===');
    console.log('  Avg:', avg.toFixed(2));
    console.log('  Min:', Math.min(...scores).toFixed(2));
    console.log('  Max:', Math.max(...scores).toFixed(2));
    console.log('  First (oldest):', oldest[0]?.created_at);
    
    const above90 = scores.filter(s => s >= 90).length;
    console.log('  Above 90:', above90, '('+(above90/scores.length*100).toFixed(1)+'%)');
  }
  
  process.exit(0);
})();
