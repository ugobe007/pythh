require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Check momentum_score column values
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('name, total_god_score, momentum_score, team_score, traction_score, market_score, product_score, vision_score, status')
      .in('status', ['approved', 'pending'])
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  
  console.log('=== MOMENTUM SCORE ANALYSIS ===');
  console.log('Total startups:', all.length);
  
  const withMomentum = all.filter(s => s.momentum_score > 0);
  const approved = all.filter(s => s.status === 'approved');
  const approvedWithMomentum = approved.filter(s => s.momentum_score > 0);
  
  console.log('Startups with momentum > 0:', withMomentum.length, '(' + (withMomentum.length / all.length * 100).toFixed(1) + '%)');
  console.log('Approved with momentum > 0:', approvedWithMomentum.length, '(' + (approvedWithMomentum.length / approved.length * 100).toFixed(1) + '% of approved)');
  console.log('');
  
  if (withMomentum.length > 0) {
    const mScores = withMomentum.map(s => s.momentum_score);
    mScores.sort((a, b) => a - b);
    const n = mScores.length;
    const avg = mScores.reduce((a, b) => a + b, 0) / n;
    const p25 = mScores[Math.floor(n * 0.25)];
    const p50 = mScores[Math.floor(n * 0.5)];
    const p75 = mScores[Math.floor(n * 0.75)];
    const p90 = mScores[Math.floor(n * 0.9)];
    
    console.log('=== MOMENTUM BONUS DISTRIBUTION (where > 0) ===');
    console.log('Min:', mScores[0], '| Max:', mScores[n - 1]);
    console.log('Avg:', avg.toFixed(2));
    console.log('P25:', p25, '| P50:', p50, '| P75:', p75, '| P90:', p90);
    console.log('');
    
    // Bucket distribution
    const buckets = [
      { label: '0.1-0.5', fn: s => s > 0 && s <= 0.5 },
      { label: '0.6-1.0', fn: s => s > 0.5 && s <= 1.0 },
      { label: '1.1-1.5', fn: s => s > 1.0 && s <= 1.5 },
      { label: '1.6-2.0', fn: s => s > 1.5 && s <= 2.0 },
      { label: '2.1-3.0', fn: s => s > 2.0 && s <= 3.0 },
      { label: '3.1-5.0', fn: s => s > 3.0 && s <= 5.0 },
      { label: '5.1-8.0', fn: s => s > 5.0 && s <= 8.0 },
    ];
    console.log('=== MOMENTUM VALUE BUCKETS ===');
    for (const b of buckets) {
      const count = mScores.filter(b.fn).length;
      console.log(`  ${b.label}: ${count} startups (${(count / n * 100).toFixed(1)}%)`);
    }
    console.log('');
    
    // Impact analysis: How much does momentum contribute to total GOD score?
    console.log('=== MOMENTUM IMPACT ON GOD SCORE ===');
    const withMomApproved = approvedWithMomentum;
    if (withMomApproved.length > 0) {
      const avgGod = withMomApproved.reduce((a, s) => a + s.total_god_score, 0) / withMomApproved.length;
      const avgMom = withMomApproved.reduce((a, s) => a + s.momentum_score, 0) / withMomApproved.length;
      const avgGodWithoutMom = avgGod - avgMom;
      console.log('Avg GOD score (with momentum):', avgGod.toFixed(1));
      console.log('Avg momentum bonus:', avgMom.toFixed(2));
      console.log('Avg GOD score (without momentum):', avgGodWithoutMom.toFixed(1));
      console.log('Momentum contribution:', (avgMom / avgGod * 100).toFixed(1) + '% of total');
    }
    console.log('');
    
    // By GOD score tier
    console.log('=== MOMENTUM BY GOD SCORE TIER ===');
    const tiers = [
      { label: '40-49', min: 40, max: 49 },
      { label: '50-59', min: 50, max: 59 },
      { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 },
      { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    for (const t of tiers) {
      const inTier = approved.filter(s => s.total_god_score >= t.min && s.total_god_score <= t.max);
      const inTierWithMom = inTier.filter(s => s.momentum_score > 0);
      if (inTier.length > 0) {
        const avgMom = inTierWithMom.length > 0 
          ? (inTierWithMom.reduce((a, s) => a + s.momentum_score, 0) / inTierWithMom.length).toFixed(2) 
          : '0';
        console.log(`  ${t.label}: ${inTier.length} startups, ${inTierWithMom.length} with momentum (${(inTierWithMom.length/inTier.length*100).toFixed(0)}%), avg bonus: ${avgMom}`);
      }
    }
    console.log('');
    
    // Which momentum dimensions fire most? (from the momentumScoringService config)
    console.log('=== MOMENTUM DIMENSION HINTS (from bonus tiers) ===');
    console.log('  0.2 pts = data_partial (5-7 quality fields filled)');
    console.log('  0.3 pts = revenue_claimed OR customers_claimed');
    console.log('  0.5 pts = data_good OR team_some OR score_trajectory');
    console.log('  0.8 pts = product_launched');
    console.log('  1.0 pts = data_rich OR customers_only OR revenue_only');
    console.log('  1.3-1.6 pts = multiple dimensions stacking');
    console.log('  2.0+ pts = revenue+growth AND/OR customers+growth AND/OR launched+demo');
    console.log('');
    
    // Top 15 highest momentum startups
    console.log('=== TOP 15 HIGHEST MOMENTUM STARTUPS ===');
    const topMom = [...withMomentum].sort((a, b) => b.momentum_score - a.momentum_score).slice(0, 15);
    for (const s of topMom) {
      console.log(`  ${s.momentum_score} | GOD: ${s.total_god_score} | ${s.name} | T:${s.team_score} Tr:${s.traction_score} P:${s.product_score}`);
    }
  } else {
    console.log('No momentum scores populated yet. Column may need a recalculation to populate.');
    console.log('The recalculation with the new column is currently running...');
  }
})();
