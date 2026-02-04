const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // NEW UI query (with order by recent)
  const { data } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .not('match_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  
  if (data?.length) {
    const avg = data.reduce((sum, s) => sum + s.match_score, 0) / data.length;
    console.log('NEW UI query (recent 1000):');
    console.log('  Average:', avg.toFixed(1));
    console.log('  Min:', Math.min(...data.map(d => d.match_score)).toFixed(1));
    console.log('  Max:', Math.max(...data.map(d => d.match_score)).toFixed(1));
  }
  
  // OLD UI query (no order - returns random/oldest)
  const { data: oldData } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .not('match_score', 'is', null);
  
  if (oldData?.length) {
    const oldAvg = oldData.reduce((sum, s) => sum + s.match_score, 0) / oldData.length;
    console.log('\nOLD UI query (default order):');
    console.log('  Average:', oldAvg.toFixed(1));
  }
  
  process.exit(0);
})();
