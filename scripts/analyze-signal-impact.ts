import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function analyze() {
  // Get approved startups with signal scores
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, signals_bonus')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null);

  if (!startups) {
    console.error('No startups found');
    return;
  }

  // Calculate base score (total - signals)
  const withSignals = startups.map(s => ({
    name: s.name,
    total: s.total_god_score || 0,
    signals: s.signals_bonus || 0,
    base: (s.total_god_score || 0) - (s.signals_bonus || 0)
  }));

  // Group by signal bonus ranges
  const noSignals = withSignals.filter(s => s.signals === 0);
  const lowSignals = withSignals.filter(s => s.signals > 0 && s.signals < 2);
  const midSignals = withSignals.filter(s => s.signals >= 2 && s.signals < 5);
  const highSignals = withSignals.filter(s => s.signals >= 5 && s.signals < 8);
  const veryHighSignals = withSignals.filter(s => s.signals >= 8);

  console.log('\n📊 Signal Bonus Impact Analysis:');
  console.log('─'.repeat(80));
  console.log(`Total approved startups: ${withSignals.length}`);
  console.log(`\nSignal Bonus Distribution:`);
  console.log(`  No signals (0):     ${noSignals.length} (${(noSignals.length / withSignals.length * 100).toFixed(1)}%)`);
  console.log(`  Low (0-2):          ${lowSignals.length} (${(lowSignals.length / withSignals.length * 100).toFixed(1)}%)`);
  console.log(`  Mid (2-5):          ${midSignals.length} (${(midSignals.length / withSignals.length * 100).toFixed(1)}%)`);
  console.log(`  High (5-8):         ${highSignals.length} (${(highSignals.length / withSignals.length * 100).toFixed(1)}%)`);
  console.log(`  Very High (8+):     ${veryHighSignals.length} (${(veryHighSignals.length / withSignals.length * 100).toFixed(1)}%)`);

  // Calculate average scores by signal tier
  const avgNoSignals = noSignals.reduce((sum, s) => sum + s.total, 0) / (noSignals.length || 1);
  const avgLowSignals = lowSignals.reduce((sum, s) => sum + s.total, 0) / (lowSignals.length || 1);
  const avgMidSignals = midSignals.reduce((sum, s) => sum + s.total, 0) / (midSignals.length || 1);
  const avgHighSignals = highSignals.reduce((sum, s) => sum + s.total, 0) / (highSignals.length || 1);
  const avgVeryHighSignals = veryHighSignals.reduce((sum, s) => sum + s.total, 0) / (veryHighSignals.length || 1);

  console.log(`\nAverage Total Score by Signal Tier:`);
  console.log(`  No signals:     ${avgNoSignals.toFixed(2)}`);
  console.log(`  Low (0-2):      ${avgLowSignals.toFixed(2)}`);
  console.log(`  Mid (2-5):      ${avgMidSignals.toFixed(2)}`);
  console.log(`  High (5-8):     ${avgHighSignals.toFixed(2)}`);
  console.log(`  Very High (8+): ${avgVeryHighSignals.toFixed(2)}`);

  // Check how many scores are pushed from 50-59 to 60+ by signals
  const in50_59_without_signals = withSignals.filter(s => s.base >= 50 && s.base < 60);
  const pushed_to_60_plus = in50_59_without_signals.filter(s => s.total >= 60);
  
  console.log(`\n📈 Signal Impact on 50-59 Range:`);
  console.log(`  Startups with base score 50-59: ${in50_59_without_signals.length}`);
  console.log(`  Pushed to 60+ by signals: ${pushed_to_60_plus.length} (${(pushed_to_60_plus.length / (in50_59_without_signals.length || 1) * 100).toFixed(1)}%)`);

  // Show top signal bonuses
  const topSignals = [...withSignals]
    .filter(s => s.signals > 0)
    .sort((a, b) => b.signals - a.signals)
    .slice(0, 10);

  console.log(`\n🔝 Top 10 Signal Bonuses:`);
  topSignals.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name.substring(0, 40).padEnd(40)} | Base: ${s.base.toFixed(1)} | Signals: +${s.signals.toFixed(1)} | Total: ${s.total.toFixed(1)}`);
  });
}

analyze().catch(console.error);
