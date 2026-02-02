import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkFullDistribution() {
  // Get ALL approved startups
  const { data: all, error } = await supabase
    .from('startup_uploads')
    .select('total_god_score, name')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  if (error || !all) {
    console.error('Error:', error);
    return;
  }

  const scores = all.map(s => s.total_god_score).filter(s => s > 0);
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  console.log('📊 ALL Approved Startups GOD Scores:');
  console.log(`   Count: ${scores.length}`);
  console.log(`   Average: ${avg.toFixed(1)}`);
  console.log(`   Min: ${min}`);
  console.log(`   Max: ${max}`);
  console.log(`   Median: ${median}`);

  // Distribution
  const under40 = scores.filter(s => s < 40).length;
  const range40_60 = scores.filter(s => s >= 40 && s < 60).length;
  const range60_80 = scores.filter(s => s >= 60 && s < 80).length;
  const over80 = scores.filter(s => s >= 80).length;

  console.log('\n   Distribution:');
  console.log(`   < 40: ${under40} (${((under40 / scores.length) * 100).toFixed(1)}%)`);
  console.log(`   40-59: ${range40_60} (${((range40_60 / scores.length) * 100).toFixed(1)}%)`);
  console.log(`   60-79: ${range60_80} (${((range60_80 / scores.length) * 100).toFixed(1)}%)`);
  console.log(`   80+: ${over80} (${((over80 / scores.length) * 100).toFixed(1)}%)`);

  // Show top 10 highest
  console.log('\n🔥 Top 10 Highest Scores:');
  const top10 = all
    .filter(s => s.total_god_score > 0)
    .sort((a, b) => b.total_god_score - a.total_god_score)
    .slice(0, 10);

  top10.forEach((s, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${s.name.slice(0, 35).padEnd(35)} - ${s.total_god_score}`);
  });
}

checkFullDistribution().catch(console.error);
