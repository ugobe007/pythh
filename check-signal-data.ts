import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkSignalData() {
  // Check GOD score distribution
  const { data: godScores } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .not('total_god_score', 'is', null);
  
  // Check match scores
  const { data: matches } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .limit(1000);
  
  if (godScores) {
    const scores = godScores.map(s => s.total_god_score).filter(s => s > 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    console.log('\n📊 GOD Score Distribution:');
    console.log('  Average:', avg.toFixed(1));
    console.log('  Min:', min);
    console.log('  Max:', max);
    console.log('  Count:', scores.length);
  }
  
  if (matches) {
    const scores = matches.map(m => m.match_score).filter(s => s > 0);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log('\n🎯 Match Score Distribution:');
    console.log('  Average:', avg.toFixed(1));
    console.log('  Sample size:', scores.length);
  }
}

checkSignalData().catch(console.error);
