import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGODScores() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const scores = data?.map(s => s.total_god_score).filter(s => s !== null && s !== undefined) || [];
  
  if (scores.length === 0) {
    console.log('No approved startups with GOD scores found.');
    return;
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(scores.length / 2)];

  // Distribution buckets
  const buckets = {
    '0-20': scores.filter(s => s >= 0 && s < 20).length,
    '20-40': scores.filter(s => s >= 20 && s < 40).length,
    '40-60': scores.filter(s => s >= 60 && s < 60).length,
    '60-80': scores.filter(s => s >= 60 && s < 80).length,
    '80-100': scores.filter(s => s >= 80 && s <= 100).length,
  };

  console.log('\n📊 GOD Score Statistics:\n');
  console.log(`  Total approved startups: ${scores.length}`);
  console.log(`  Average GOD score: ${avg.toFixed(2)}`);
  console.log(`  Median GOD score: ${median.toFixed(2)}`);
  console.log(`  Min GOD score: ${min.toFixed(2)}`);
  console.log(`  Max GOD score: ${max.toFixed(2)}`);
  console.log(`\n  Distribution:`);
  console.log(`    0-20:   ${buckets['0-20']} (${((buckets['0-20'] / scores.length) * 100).toFixed(1)}%)`);
  console.log(`    20-40:  ${buckets['20-40']} (${((buckets['20-40'] / scores.length) * 100).toFixed(1)}%)`);
  console.log(`    40-60:  ${buckets['40-60']} (${((buckets['40-60'] / scores.length) * 100).toFixed(1)}%)`);
  console.log(`    60-80:  ${buckets['60-80']} (${((buckets['60-80'] / scores.length) * 100).toFixed(1)}%)`);
  console.log(`    80-100: ${buckets['80-100']} (${((buckets['80-100'] / scores.length) * 100).toFixed(1)}%)`);
  console.log();
}

checkGODScores().catch(console.error);
