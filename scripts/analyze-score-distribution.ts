import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyze() {
  // Get lowest scores with component breakdown
  const { data: lowest, error: err1 } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: true })
    .limit(30);

  if (err1) {
    console.error('Error:', err1);
    return;
  }

  console.log('\n📊 Lowest 30 GOD Scores (Component Breakdown):');
  console.log('─'.repeat(100));
  console.log('Name'.padEnd(35) + ' | Total | Team | Traction | Market | Product | Vision | Signals');
  console.log('─'.repeat(100));
  
  lowest?.forEach(s => {
    const name = (s.name || 'N/A').substring(0, 33).padEnd(35);
    const total = (s.total_god_score || 0).toFixed(1).padStart(5);
    const team = (s.team_score || 0).toFixed(1).padStart(4);
    const traction = (s.traction_score || 0).toFixed(1).padStart(7);
    const market = (s.market_score || 0).toFixed(1).padStart(5);
    const product = (s.product_score || 0).toFixed(1).padStart(6);
    const vision = (s.vision_score || 0).toFixed(1).padStart(5);
    const signals = (s.signals_bonus || 0).toFixed(1).padStart(7);
    console.log(`${name} | ${total} | ${team} | ${traction} | ${market} | ${product} | ${vision} | ${signals}`);
  });

  // Count by ranges
  const { count: below50 } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .lt('total_god_score', 50);

  const { count: range50_59 } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('total_god_score', 50)
    .lt('total_god_score', 60);

  const { count: range60_69 } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('total_god_score', 60)
    .lt('total_god_score', 70);

  const { count: total } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  console.log('\n📈 Score Distribution:');
  console.log(`  < 50:  ${below50 || 0} (${((below50 || 0) / (total || 1) * 100).toFixed(1)}%)`);
  console.log(`  50-59: ${range50_59 || 0} (${((range50_59 || 0) / (total || 1) * 100).toFixed(1)}%)`);
  console.log(`  60-69: ${range60_69 || 0} (${((range60_69 || 0) / (total || 1) * 100).toFixed(1)}%)`);
  console.log(`  Total: ${total || 0}`);

  // Check average component scores for lowest 30
  const avgTeam = lowest?.reduce((sum, s) => sum + (s.team_score || 0), 0) / (lowest.length || 1);
  const avgTraction = lowest?.reduce((sum, s) => sum + (s.traction_score || 0), 0) / (lowest.length || 1);
  const avgMarket = lowest?.reduce((sum, s) => sum + (s.market_score || 0), 0) / (lowest.length || 1);
  const avgProduct = lowest?.reduce((sum, s) => sum + (s.product_score || 0), 0) / (lowest.length || 1);
  const avgVision = lowest?.reduce((sum, s) => sum + (s.vision_score || 0), 0) / (lowest.length || 1);
  const avgSignals = lowest?.reduce((sum, s) => sum + (s.signals_bonus || 0), 0) / (lowest.length || 1);
  const avgTotal = lowest?.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / (lowest.length || 1);

  console.log('\n📊 Average Component Scores (Lowest 30):');
  console.log(`  Team:     ${avgTeam.toFixed(1)}`);
  console.log(`  Traction: ${avgTraction.toFixed(1)}`);
  console.log(`  Market:   ${avgMarket.toFixed(1)}`);
  console.log(`  Product:  ${avgProduct.toFixed(1)}`);
  console.log(`  Vision:   ${avgVision.toFixed(1)}`);
  console.log(`  Signals:  ${avgSignals.toFixed(1)}`);
  console.log(`  Total:    ${avgTotal.toFixed(1)}`);
  console.log(`  Sum of components: ${(avgTeam + avgTraction + avgMarket + avgProduct + avgVision).toFixed(1)}`);
  console.log(`  Total - Signals: ${(avgTotal - avgSignals).toFixed(1)} (base GOD score)`);
}

analyze().catch(console.error);
