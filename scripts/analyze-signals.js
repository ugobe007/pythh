/**
 * Analyze signal score distributions
 */
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function analyzeSignalScores() {
  // Check startup_signal_scores table
  const { data, error } = await supabase
    .from('startup_signal_scores')
    .select('signals_total, startup_id');
  
  if (error) { 
    console.error('Error fetching startup_signal_scores:', error); 
    return; 
  }
  
  const scores = data.map(d => d.signals_total).filter(s => s !== null);
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  // Distribution buckets (0-10 scale)
  const buckets = { '0-2': 0, '2-4': 0, '4-6': 0, '6-8': 0, '8-10': 0 };
  scores.forEach(s => {
    if (s < 2) buckets['0-2']++;
    else if (s < 4) buckets['2-4']++;
    else if (s < 6) buckets['4-6']++;
    else if (s < 8) buckets['6-8']++;
    else buckets['8-10']++;
  });
  
  console.log('=== startup_signal_scores Analysis ===');
  console.log('Total records:', scores.length);
  console.log('Average:', avg.toFixed(2));
  console.log('Min:', min);
  console.log('Max:', max);
  console.log('Distribution (0-10 scale):', buckets);
  
  // Check for any very high scores
  const highScores = scores.filter(s => s >= 9);
  console.log('\nScores >= 9:', highScores.length);
  if (highScores.length > 0) console.log('High scores:', highScores.slice(0,10));
}

async function analyzeMatchScores() {
  // Check match scores in startup_investor_matches
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .limit(5000);
  
  if (error) { 
    console.error('Error fetching matches:', error); 
    return; 
  }
  
  const scores = data.map(d => d.match_score).filter(s => s !== null);
  const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  // Distribution buckets (0-100 scale)
  const buckets = { '0-20': 0, '20-40': 0, '40-60': 0, '60-80': 0, '80-100': 0 };
  scores.forEach(s => {
    if (s < 20) buckets['0-20']++;
    else if (s < 40) buckets['20-40']++;
    else if (s < 60) buckets['40-60']++;
    else if (s < 80) buckets['60-80']++;
    else buckets['80-100']++;
  });
  
  console.log('\n=== startup_investor_matches (match_score) Analysis ===');
  console.log('Sample size:', scores.length);
  console.log('Average:', avg.toFixed(2));
  console.log('Min:', min);
  console.log('Max:', max);
  console.log('Distribution (0-100 scale):', buckets);
  
  // Check for scores above 99
  const veryHighScores = scores.filter(s => s >= 99);
  console.log('\nScores >= 99:', veryHighScores.length);
  if (veryHighScores.length > 0) {
    console.log('Percentage of 99+ scores:', ((veryHighScores.length / scores.length) * 100).toFixed(2) + '%');
  }
}

async function main() {
  await analyzeSignalScores();
  await analyzeMatchScores();
  process.exit(0);
}

main();
