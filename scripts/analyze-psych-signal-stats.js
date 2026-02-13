// Quick analysis of psychological signal strength distribution
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeSignalStats() {
  console.log('📊 Analyzing psychological signal strength distribution...\n');

  // Get all startups with psychological signals
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, psychological_multiplier, total_god_score, enhanced_god_score')
    .eq('status', 'approved')
    .not('psychological_multiplier', 'is', null)
    .order('psychological_multiplier', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!startups || startups.length === 0) {
    console.log('⚠️  No startups found with psychological signals');
    return;
  }

  // Calculate statistics
  const bonuses = startups.map(s => s.psychological_multiplier).filter(b => b !== null);
  const sum = bonuses.reduce((acc, val) => acc + val, 0);
  const mean = sum / bonuses.length;
  
  // Sort to find median
  const sorted = [...bonuses].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const min = Math.min(...bonuses);
  const max = Math.max(...bonuses);
  
  // Standard deviation
  const variance = bonuses.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / bonuses.length;
  const stdDev = Math.sqrt(variance);

  // Distribution buckets
  const negative = bonuses.filter(b => b < 0).length;
  const neutral = bonuses.filter(b => b === 0).length;
  const low = bonuses.filter(b => b > 0 && b <= 0.3).length;
  const medium = bonuses.filter(b => b > 0.3 && b <= 0.6).length;
  const high = bonuses.filter(b => b > 0.6).length;

  console.log('='.repeat(60));
  console.log('PSYCHOLOGICAL SIGNAL STRENGTH STATISTICS');
  console.log('='.repeat(60));
  console.log(`Total startups with signals: ${startups.length}`);
  console.log(`\n📈 Central Tendency:`);
  console.log(`   Mean (average):  ${mean.toFixed(3)} (${(mean * 10).toFixed(1)} points on 0-100 scale)`);
  console.log(`   Median:          ${median.toFixed(3)} (${(median * 10).toFixed(1)} points on 0-100 scale)`);
  console.log(`\n📊 Spread:`);
  console.log(`   Min:             ${min.toFixed(3)} (${(min * 10).toFixed(1)} points)`);
  console.log(`   Max:             ${max.toFixed(3)} (${(max * 10).toFixed(1)} points)`);
  console.log(`   Std Deviation:   ${stdDev.toFixed(3)}`);
  console.log(`   Range:           ${(max - min).toFixed(3)}`);
  console.log(`\n🎯 Distribution:`);
  console.log(`   Negative (<0):      ${negative} startups (${(negative/bonuses.length*100).toFixed(1)}%)`);
  console.log(`   Neutral (0):        ${neutral} startups (${(neutral/bonuses.length*100).toFixed(1)}%)`);
  console.log(`   Low (0-0.3):        ${low} startups (${(low/bonuses.length*100).toFixed(1)}%)`);
  console.log(`   Medium (0.3-0.6):   ${medium} startups (${(medium/bonuses.length*100).toFixed(1)}%)`);
  console.log(`   High (>0.6):        ${high} startups (${(high/bonuses.length*100).toFixed(1)}%)`);

  console.log(`\n🔝 Top 5 Startups by Signal Strength:`);
  startups.slice(0, 5).forEach((s, i) => {
    const bonus = s.psychological_multiplier || 0;
    const impact = s.enhanced_god_score - s.total_god_score;
    console.log(`   ${i+1}. ${s.name}`);
    console.log(`      Signal bonus: ${bonus.toFixed(3)} → +${(bonus * 10).toFixed(1)} points`);
    console.log(`      Score impact: ${s.total_god_score} → ${s.enhanced_god_score} (+${impact})`);
  });

  console.log(`\n🔻 Bottom 5 Startups by Signal Strength:`);
  startups.slice(-5).reverse().forEach((s, i) => {
    const bonus = s.psychological_multiplier || 0;
    const impact = s.enhanced_god_score - s.total_god_score;
    console.log(`   ${i+1}. ${s.name}`);
    console.log(`      Signal bonus: ${bonus.toFixed(3)} → ${(bonus * 10).toFixed(1)} points`);
    console.log(`      Score impact: ${s.total_god_score} → ${s.enhanced_god_score} (${impact >= 0 ? '+' : ''}${impact})`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('💡 INTERPRETATION:');
  console.log('   - Bonus is on 0-10 scale (multiply by 10 for point impact)');
  console.log('   - Negative bonuses = Risk signals detected (bridge rounds)');
  console.log('   - Positive bonuses = FOMO + Conviction + Urgency signals');
  console.log('   - Decay reduces older signals exponentially over time');
  console.log('='.repeat(60) + '\n');
}

analyzeSignalStats().catch(console.error);
