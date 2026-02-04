const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('Checking match score distribution...\n');

  // Check overall sample
  const { data: allMatches, error } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .not('match_score', 'is', null)
    .limit(50000);
  
  if (error) {
    console.log('Error:', error);
    return;
  }

  const scores = allMatches.map(m => m.match_score);
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  console.log('Sample (50k) avg match_score:', avg.toFixed(2));
  console.log('Sample size:', scores.length);
  console.log('Min:', Math.min(...scores).toFixed(2));
  console.log('Max:', Math.max(...scores).toFixed(2));
  
  // Count by ranges
  let below50 = 0, r50_60 = 0, r60_70 = 0, r70_80 = 0, r80_90 = 0, above90 = 0;
  scores.forEach(s => {
    if (s < 50) below50++;
    else if (s < 60) r50_60++;
    else if (s < 70) r60_70++;
    else if (s < 80) r70_80++;
    else if (s < 90) r80_90++;
    else above90++;
  });
  
  console.log('\nDistribution:');
  console.log('  <50:', below50, `(${(below50/scores.length*100).toFixed(1)}%)`);
  console.log('  50-60:', r50_60, `(${(r50_60/scores.length*100).toFixed(1)}%)`);
  console.log('  60-70:', r60_70, `(${(r60_70/scores.length*100).toFixed(1)}%)`);
  console.log('  70-80:', r70_80, `(${(r70_80/scores.length*100).toFixed(1)}%)`);
  console.log('  80-90:', r80_90, `(${(r80_90/scores.length*100).toFixed(1)}%)`);
  console.log('  90+:', above90, `(${(above90/scores.length*100).toFixed(1)}%)`);
  
  // What the UI would show (no limit means default 1000)
  console.log('\n--- What UI shows (default Supabase limit ~1000) ---');
  const { data: uiQuery } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .not('match_score', 'is', null);
  
  if (uiQuery?.length) {
    const uiAvg = uiQuery.reduce((sum, s) => sum + s.match_score, 0) / uiQuery.length;
    console.log('UI query avg:', uiAvg.toFixed(2));
    console.log('UI query count:', uiQuery.length);
    
    // Check what scores are in this default query
    const uiAbove90 = uiQuery.filter(m => m.match_score >= 90).length;
    console.log('Above 90 in UI sample:', uiAbove90, `(${(uiAbove90/uiQuery.length*100).toFixed(1)}%)`);
  }
  
  process.exit(0);
})();
