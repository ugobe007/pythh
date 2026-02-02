import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function quickCheck() {
  const { data } = await supabase
    .from('startup_uploads')
    .select('total_god_score, name')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(20);

  if (data) {
    const scores = data.map(s => s.total_god_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    console.log('📊 Quick Score Check (20 samples):');
    console.log(`   Average: ${avg.toFixed(1)}`);
    console.log(`   Min: ${Math.min(...scores)}`);
    console.log(`   Max: ${Math.max(...scores)}`);
    console.log('\n   Sample:');
    data.slice(0, 10).forEach(s => {
      console.log(`   ${s.name.slice(0, 30).padEnd(30)}: ${s.total_god_score}`);
    });
  }
}

quickCheck().catch(console.error);
