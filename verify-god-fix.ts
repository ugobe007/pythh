import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function verifyFix() {
  const { data } = await supabase
    .from('startup_uploads')
    .select('total_god_score, name')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(200);

  if (data) {
    const scores = data.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Distribution
    const under40 = scores.filter(s => s < 40).length;
    const range40_60 = scores.filter(s => s >= 40 && s < 60).length;
    const range60_80 = scores.filter(s => s >= 60 && s < 80).length;
    const over80 = scores.filter(s => s >= 80).length;
    
    console.log('\n🎯 GOD SCORE FIX VERIFICATION (200 samples)');
    console.log('='.repeat(60));
    console.log(`\n📊 Distribution:`);
    console.log(`   Average: ${avg.toFixed(1)} (target: 55-65)`);
    console.log(`   Median: ${median}`);
    console.log(`   Min: ${min}`);
    console.log(`   Max: ${max}`);
    
    console.log(`\n   By Range:`);
    console.log(`   < 40:  ${under40.toString().padStart(3)} (${((under40/scores.length)*100).toFixed(1)}%)`);
    console.log(`   40-59: ${range40_60.toString().padStart(3)} (${((range40_60/scores.length)*100).toFixed(1)}%)`);
    console.log(`   60-79: ${range60_80.toString().padStart(3)} (${((range60_80/scores.length)*100).toFixed(1)}%)`);
    console.log(`   80+:   ${over80.toString().padStart(3)} (${((over80/scores.length)*100).toFixed(1)}%)`);
    
    // Status
    if (avg >= 55 && avg <= 65) {
      console.log(`\n✅ STATUS: HEALTHY - Scores in target range!`);
    } else if (avg > 65 && avg < 75) {
      console.log(`\n⚠️  STATUS: SLIGHTLY HIGH - Close to target but monitor`);
    } else if (avg < 55) {
      console.log(`\n🔴 STATUS: TOO LOW - Still needs adjustment`);
    } else {
      console.log(`\n🔴 STATUS: TOO HIGH - Needs normalization`);
    }
    
    console.log(`\n💡 Sample of updated scores:`);
    data.slice(0, 15).forEach(s => {
      const emoji = s.total_god_score >= 80 ? '🔥' : s.total_god_score >= 60 ? '✨' : s.total_god_score >= 40 ? '⚡' : '📊';
      console.log(`   ${emoji} ${s.name.slice(0, 35).padEnd(35)}: ${s.total_god_score.toString().padStart(3)}`);
    });
  }
}

verifyFix().catch(console.error);
