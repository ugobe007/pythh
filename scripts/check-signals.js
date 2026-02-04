const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

(async () => {
  // Check signal scores distribution
  const { data: matches, error } = await supabase
    .from('startup_investor_matches')
    .select('match_score, signal_score')
    .not('signal_score', 'is', null)
    .limit(1000);
  
  if (error) { console.error(error); return; }
  
  const signalScores = matches.map(m => m.signal_score).filter(s => s !== null);
  const avg = signalScores.reduce((a,b) => a+b, 0) / signalScores.length;
  const min = Math.min(...signalScores);
  const max = Math.max(...signalScores);
  
  // Distribution buckets
  const buckets = { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0 };
  signalScores.forEach(s => {
    if (s < 20) buckets['0-20']++;
    else if (s < 40) buckets['20-40']++;
    else if (s < 60) buckets['40-60']++;
    else if (s < 80) buckets['60-80']++;
    else buckets['80-100']++;
  });
  
  console.log('=== Signal Score Analysis ===');
  console.log('Sample size:', signalScores.length);
  console.log('Average:', avg.toFixed(2));
  console.log('Min:', min);
  console.log('Max:', max);
  console.log('Distribution:', buckets);
  
  // Show some examples
  console.log('\nTop 10 signal scores:');
  matches.sort((a,b) => b.signal_score - a.signal_score).slice(0,10).forEach(m => {
    console.log('  signal:', m.signal_score, 'match:', m.match_score);
  });
  
  // Check how many have signal_score
  const { count: totalMatches } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });
  
  const { count: withSignal } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .not('signal_score', 'is', null);
  
  console.log('\nTotal matches:', totalMatches);
  console.log('With signal_score:', withSignal);
})();
