import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data } = await s.from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(1000);
  
  if (!data || data.length === 0) {
    console.log('No data found');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    GOD SCORE HEALTH CHECK (POST-FIX)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Total GOD score
  const godScores = data.map(d => d.total_god_score);
  const godAvg = godScores.reduce((a,b) => a+b, 0) / godScores.length;
  console.log('TOTAL GOD SCORE:');
  console.log(`  Count: ${godScores.length}`);
  console.log(`  Average: ${godAvg.toFixed(1)}`);
  console.log(`  Min: ${Math.min(...godScores)}, Max: ${Math.max(...godScores)}`);
  
  const elite = godScores.filter(s => s >= 85).length;
  const strong = godScores.filter(s => s >= 70 && s < 85).length;
  const good = godScores.filter(s => s >= 55 && s < 70).length;
  const emerging = godScores.filter(s => s >= 45 && s < 55).length;
  const early = godScores.filter(s => s < 45).length;
  
  console.log('\n  Tier Distribution:');
  console.log(`    Elite (85+):     ${elite} (${(elite/godScores.length*100).toFixed(1)}%)`);
  console.log(`    Strong (70-84):  ${strong} (${(strong/godScores.length*100).toFixed(1)}%)`);
  console.log(`    Good (55-69):    ${good} (${(good/godScores.length*100).toFixed(1)}%)`);
  console.log(`    Emerging (45-54):${emerging} (${(emerging/godScores.length*100).toFixed(1)}%)`);
  console.log(`    Early (<45):     ${early} (${(early/godScores.length*100).toFixed(1)}%)`);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    COMPONENT SCORES (FIXED SCALING)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const components = [
    { name: 'team_score', col: 'team_score', expectedMax: 100 },
    { name: 'traction_score', col: 'traction_score', expectedMax: 100 },
    { name: 'market_score', col: 'market_score', expectedMax: 100 },
    { name: 'product_score', col: 'product_score', expectedMax: 100 },
    { name: 'vision_score', col: 'vision_score', expectedMax: 100 },
  ];

  console.log('Component        │ Avg   │ Min │ Max │ Status');
  console.log('─────────────────┼───────┼─────┼─────┼────────');
  
  for (const comp of components) {
    const vals = data.map(d => (d as any)[comp.col]).filter(v => v !== null && v !== undefined);
    if (vals.length > 0) {
      const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const status = max <= 100 ? '✅ OK' : '❌ EXCEEDS 100';
      console.log(`${comp.name.padEnd(16)} │ ${avg.toFixed(1).padStart(5)} │ ${String(min).padStart(3)} │ ${String(max).padStart(3)} │ ${status}`);
    } else {
      console.log(`${comp.name.padEnd(16)} │ NO DATA`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    SAMPLE STARTUPS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Show some examples
  const sorted = [...data].sort((a,b) => b.total_god_score - a.total_god_score);
  console.log('Top 5 by GOD score:');
  for (const s of sorted.slice(0, 5)) {
    console.log(`  ${s.name}: GOD=${s.total_god_score} | team=${s.team_score} | traction=${s.traction_score} | market=${s.market_score} | product=${s.product_score} | vision=${s.vision_score}`);
  }

  console.log('\nBottom 5 by GOD score:');
  for (const s of sorted.slice(-5)) {
    console.log(`  ${s.name}: GOD=${s.total_god_score} | team=${s.team_score} | traction=${s.traction_score} | market=${s.market_score} | product=${s.product_score} | vision=${s.vision_score}`);
  }
}
check();
