// Comprehensive analysis of GOD scores, Signal scores, and Enhanced scores
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function analyzeScores() {
  console.log('📊 HOT HONEY SCORING SYSTEM ANALYSIS');
  console.log('='.repeat(80));
  console.log('Date: ' + new Date().toISOString().split('T')[0]);
  console.log('='.repeat(80) + '\n');

  // Get all approved startups with scores
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select(`
      id, name, status,
      team_score, traction_score, market_score, product_score, vision_score,
      total_god_score, signals_bonus, psychological_multiplier, enhanced_god_score,
      is_oversubscribed, has_followon, is_competitive, is_bridge_round
    `)
    .eq('status', 'approved')
    .order('enhanced_god_score', { ascending: false });

  if (error) {
    console.error('❌ Error fetching data:', error);
    return;
  }

  console.log(`Total Startups Analyzed: ${startups.length}\n`);

  // 1. GOD SCORE ANALYSIS
  console.log('='.repeat(80));
  console.log('1️⃣  BASE GOD SCORE DISTRIBUTION');
  console.log('='.repeat(80));
  
  const godScores = startups.map(s => s.total_god_score).filter(s => s !== null);
  const godAvg = godScores.reduce((a, b) => a + b, 0) / godScores.length;
  const godMedian = [...godScores].sort((a, b) => a - b)[Math.floor(godScores.length / 2)];
  const godMin = Math.min(...godScores);
  const godMax = Math.max(...godScores);
  
  console.log(`  Average:  ${godAvg.toFixed(2)}`);
  console.log(`  Median:   ${godMedian}`);
  console.log(`  Range:    ${godMin} - ${godMax}`);
  console.log(`  Std Dev:  ${Math.sqrt(godScores.reduce((a, s) => a + Math.pow(s - godAvg, 2), 0) / godScores.length).toFixed(2)}`);
  
  // Distribution buckets
  const godBuckets = {
    '0-40': godScores.filter(s => s < 40).length,
    '40-50': godScores.filter(s => s >= 40 && s < 50).length,
    '50-60': godScores.filter(s => s >= 50 && s < 60).length,
    '60-70': godScores.filter(s => s >= 60 && s < 70).length,
    '70-80': godScores.filter(s => s >= 70 && s < 80).length,
    '80-85': godScores.filter(s => s >= 80 && s <= 85).length,
    '85+': godScores.filter(s => s > 85).length
  };
  
  console.log('\n  Distribution:');
  Object.entries(godBuckets).forEach(([range, count]) => {
    const pct = ((count / godScores.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / godScores.length * 50));
    console.log(`    ${range.padEnd(8)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

  // 2. SIGNALS BONUS ANALYSIS
  console.log('\n' + '='.repeat(80));
  console.log('2️⃣  SIGNALS BONUS DISTRIBUTION (Phase 1)');
  console.log('='.repeat(80));
  
  const signalsScores = startups.map(s => s.signals_bonus || 0);
  const withSignals = signalsScores.filter(s => s > 0);
  const signalsAvg = signalsScores.reduce((a, b) => a + b, 0) / signalsScores.length;
  
  console.log(`  Startups with signals: ${withSignals.length} (${(withSignals.length/startups.length*100).toFixed(1)}%)`);
  console.log(`  Average bonus (all):   ${signalsAvg.toFixed(2)} pts`);
  console.log(`  Average bonus (>0):    ${withSignals.length > 0 ? (withSignals.reduce((a,b)=>a+b,0)/withSignals.length).toFixed(2) : 0} pts`);
  console.log(`  Max bonus:             ${Math.max(...signalsScores).toFixed(2)} pts`);
  
  const signalTypes = {
    'With Phase 1 signals': withSignals.length
  };
  
  console.log('\n  Signal Detection:');
  Object.entries(signalTypes).forEach(([type, count]) => {
    console.log(`    ${type.padEnd(25)} ${count.toString().padStart(4)} (${(count/startups.length*100).toFixed(1)}%)`);
  });

  // 3. PSYCHOLOGICAL SIGNALS ANALYSIS
  console.log('\n' + '='.repeat(80));
  console.log('3️⃣  PSYCHOLOGICAL SIGNALS DISTRIBUTION (Phase 2)');
  console.log('='.repeat(80));
  
  const psychScores = startups.map(s => s.psychological_multiplier || 0);
  const withPsych = psychScores.filter(s => s !== 0);
  const psychAvg = psychScores.reduce((a, b) => a + b, 0) / psychScores.length;
  
  console.log(`  Startups with psych signals: ${withPsych.length} (${(withPsych.length/startups.length*100).toFixed(1)}%)`);
  console.log(`  Average bonus (all):         ${psychAvg.toFixed(3)} (${(psychAvg * 10).toFixed(2)} pts)`);
  console.log(`  Average bonus (>0):          ${withPsych.length > 0 ? (withPsych.reduce((a,b)=>a+b,0)/withPsych.length).toFixed(3) : 0} (${withPsych.length > 0 ? ((withPsych.reduce((a,b)=>a+b,0)/withPsych.length)*10).toFixed(2) : 0} pts)`);
  console.log(`  Max bonus:                   ${Math.max(...psychScores).toFixed(3)} (${(Math.max(...psychScores)*10).toFixed(2)} pts)`);
  console.log(`  Min bonus:                   ${Math.min(...psychScores).toFixed(3)} (${(Math.min(...psychScores)*10).toFixed(2)} pts)`);
  
  const psychTypes = {
    'Oversubscribed': startups.filter(s => s.is_oversubscribed).length,
    'Follow-on funding': startups.filter(s => s.has_followon).length,
    'Competitive': startups.filter(s => s.is_competitive).length,
    'Bridge round': startups.filter(s => s.is_bridge_round).length
  };
  
  console.log('\n  Psychological Signal Types:');
  Object.entries(psychTypes).forEach(([type, count]) => {
    console.log(`    ${type.padEnd(25)} ${count.toString().padStart(4)} (${(count/startups.length*100).toFixed(1)}%)`);
  });

  // 4. ENHANCED SCORE ANALYSIS
  console.log('\n' + '='.repeat(80));
  console.log('4️⃣  ENHANCED GOD SCORE DISTRIBUTION (Final)');
  console.log('='.repeat(80));
  
  const enhancedScores = startups.map(s => s.enhanced_god_score).filter(s => s !== null);
  const enhancedAvg = enhancedScores.reduce((a, b) => a + b, 0) / enhancedScores.length;
  const enhancedMedian = [...enhancedScores].sort((a, b) => a - b)[Math.floor(enhancedScores.length / 2)];
  const enhancedMin = Math.min(...enhancedScores);
  const enhancedMax = Math.max(...enhancedScores);
  
  console.log(`  Average:  ${enhancedAvg.toFixed(2)} (vs ${godAvg.toFixed(2)} base, +${(enhancedAvg - godAvg).toFixed(2)})`);
  console.log(`  Median:   ${enhancedMedian} (vs ${godMedian} base, +${enhancedMedian - godMedian})`);
  console.log(`  Range:    ${enhancedMin} - ${enhancedMax}`);
  console.log(`  Std Dev:  ${Math.sqrt(enhancedScores.reduce((a, s) => a + Math.pow(s - enhancedAvg, 2), 0) / enhancedScores.length).toFixed(2)}`);
  
  const enhancedBuckets = {
    '0-40': enhancedScores.filter(s => s < 40).length,
    '40-50': enhancedScores.filter(s => s >= 40 && s < 50).length,
    '50-60': enhancedScores.filter(s => s >= 50 && s < 60).length,
    '60-70': enhancedScores.filter(s => s >= 60 && s < 70).length,
    '70-80': enhancedScores.filter(s => s >= 70 && s < 80).length,
    '80-85': enhancedScores.filter(s => s >= 80 && s <= 85).length,
    '85+': enhancedScores.filter(s => s > 85).length
  };
  
  console.log('\n  Distribution:');
  Object.entries(enhancedBuckets).forEach(([range, count]) => {
    const pct = ((count / enhancedScores.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / enhancedScores.length * 50));
    console.log(`    ${range.padEnd(8)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
  });

  // 5. TOP PERFORMERS
  console.log('\n' + '='.repeat(80));
  console.log('5️⃣  TOP 10 STARTUPS BY ENHANCED SCORE');
  console.log('='.repeat(80));
  
  startups.slice(0, 10).forEach((s, i) => {
    const boost = s.enhanced_god_score - s.total_god_score;
    const signals = s.signals_bonus || 0;
    const psych = (s.psychological_multiplier || 0) * 10;
    console.log(`\n  ${i+1}. ${s.name}`);
    console.log(`     Base GOD: ${s.total_god_score} | Signals: +${signals.toFixed(1)} | Psych: +${psych.toFixed(1)} → Enhanced: ${s.enhanced_god_score} (+${boost})`);
    console.log(`     Components: T${s.team_score} TR${s.traction_score} M${s.market_score} P${s.product_score} V${s.vision_score}`);
  });

  // 6. BIGGEST GAINERS
  console.log('\n' + '='.repeat(80));
  console.log('6️⃣  TOP 10 BIGGEST GAINERS (Base → Enhanced)');
  console.log('='.repeat(80));
  
  const gainers = [...startups]
    .map(s => ({
      ...s,
      gain: s.enhanced_god_score - s.total_god_score
    }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 10);
  
  gainers.forEach((s, i) => {
    const signals = s.signals_bonus || 0;
    const psych = (s.psychological_multiplier || 0) * 10;
    console.log(`\n  ${i+1}. ${s.name}`);
    console.log(`     ${s.total_god_score} → ${s.enhanced_god_score} (+${s.gain} pts = ${((s.gain/s.total_god_score)*100).toFixed(1)}% boost)`);
    console.log(`     Signals: +${signals.toFixed(1)} | Psych: +${psych.toFixed(1)}`);
  });

  // 7. ANOMALIES & ISSUES
  console.log('\n' + '='.repeat(80));
  console.log('7️⃣  ANOMALY DETECTION');
  console.log('='.repeat(80));
  
  const issues = {
    'Scores > 85 cap': startups.filter(s => s.enhanced_god_score > 85).length,
    'Negative psychological bonus': startups.filter(s => (s.psychological_multiplier || 0) < 0).length,
    'Base = Enhanced (no signals)': startups.filter(s => s.enhanced_god_score === s.total_god_score).length,
    'Enhanced < Base (penalty)': startups.filter(s => s.enhanced_god_score < s.total_god_score).length,
    'Missing enhanced score': startups.filter(s => s.enhanced_god_score === null).length
  };
  
  console.log('');
  Object.entries(issues).forEach(([issue, count]) => {
    const icon = count === 0 ? '✅' : count > startups.length * 0.1 ? '⚠️ ' : '⚡';
    console.log(`  ${icon} ${issue.padEnd(35)} ${count.toString().padStart(4)} (${(count/startups.length*100).toFixed(1)}%)`);
  });

  // 8. COMPONENT SCORE HEALTH
  console.log('\n' + '='.repeat(80));
  console.log('8️⃣  COMPONENT SCORE HEALTH CHECK');
  console.log('='.repeat(80));
  
  const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
  console.log('');
  components.forEach(comp => {
    const scores = startups.map(s => s[comp]).filter(s => s !== null);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    console.log(`  ${comp.replace('_score', '').padEnd(10)} Avg: ${avg.toFixed(2).padStart(5)} | Range: ${min.toString().padStart(2)}-${max.toString().padStart(2)}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log('');
  
  if (withPsych.length < startups.length * 0.05) {
    console.log('  ⚠️  LOW SIGNAL COVERAGE: Only ' + withPsych.length + ' startups have psychological signals');
    console.log('      → Action: Run backfill script to extract more signals');
  }
  
  if (enhancedAvg - godAvg < 0.5) {
    console.log('  ⚠️  LOW IMPACT: Enhanced scores only +' + (enhancedAvg - godAvg).toFixed(2) + ' pts on average');
    console.log('      → Action: Consider scaling up signal weights (currently conservative)');
  }
  
  if (enhancedMax > 85) {
    console.log('  ⚠️  CAP EXCEEDED: ' + startups.filter(s => s.enhanced_god_score > 85).length + ' startups exceed 85 cap');
    console.log('      → Action: Enforce cap in trigger or reduce signal weights');
  }
  
  if (issues['Enhanced < Base (penalty)'] > startups.length * 0.05) {
    console.log('  ⚠️  NEGATIVE IMPACT: ' + issues['Enhanced < Base (penalty)'] + ' startups penalized (bridge rounds?)');
    console.log('      → Action: Review risk signal calibration');
  }
  
  if (withPsych.length > 0 && withSignals.length > 0 && enhancedAvg - godAvg >= 0.5) {
    console.log('  ✅ SYSTEM HEALTHY: Signals detected, scores enhanced appropriately');
    console.log('     → Continue monitoring for 30 days before scaling weights');
  }
  
  console.log('\n' + '='.repeat(80));
}

analyzeScores().catch(console.error);
