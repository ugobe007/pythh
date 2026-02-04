/**
 * Analyze match score distribution
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // Get total count
  const { count: total } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });
  
  console.log('Total matches:', total);
  
  // Get a sample from recent matches
  const { data: recent, error: err1 } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .order('created_at', { ascending: false })
    .limit(5000);
  
  if (err1) { console.error(err1); return; }
  
  console.log('\n=== RECENT 5000 MATCHES ===');
  analyzeScores(recent.map(d => d.match_score));
  
  // Get oldest matches
  const { data: oldest, error: err2 } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .order('created_at', { ascending: true })
    .limit(5000);
  
  if (err2) { console.error(err2); return; }
  
  console.log('\n=== OLDEST 5000 MATCHES ===');
  analyzeScores(oldest.map(d => d.match_score));
  
  // Get random sample (middle of created_at range)
  const { data: middle, error: err3 } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .limit(5000)
    .range(100000, 105000);
  
  if (err3) { console.error(err3); return; }
  
  if (middle && middle.length > 0) {
    console.log('\n=== MIDDLE SAMPLE (100k-105k) ===');
    analyzeScores(middle.map(d => d.match_score));
  }
}

function analyzeScores(scores) {
  scores = scores.filter(s => s !== null);
  if (scores.length === 0) {
    console.log('  No scores found');
    return;
  }
  
  console.log('  Count:', scores.length);
  console.log('  Min:', Math.min(...scores));
  console.log('  Max:', Math.max(...scores));
  console.log('  Avg:', (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(2));
  
  // Distribution
  const buckets = {};
  for (let i = 0; i <= 100; i += 10) {
    const key = i + '-' + (i + 10);
    buckets[key] = scores.filter(s => s >= i && s < i + 10).length;
  }
  console.log('  Distribution:');
  Object.entries(buckets).forEach(([k, v]) => {
    if (v > 0) {
      const pct = ((v / scores.length) * 100).toFixed(1);
      console.log('    ' + k.padStart(7) + ': ' + v.toString().padStart(5) + ' (' + pct + '%)');
    }
  });
}

main();
