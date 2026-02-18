// ============================================================================
// Check GOD Score Distribution After Recalibration
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDistribution() {
  console.log('\n📊 GOD SCORE DISTRIBUTION ANALYSIS\n');
  console.log('='.repeat(70));

  // Overall stats
  const { data: stats } = await supabase.rpc('execute_sql', {
    query: `
      SELECT 
        COUNT(*) as total,
        ROUND(AVG(total_god_score)::numeric, 1) as avg,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_god_score)::numeric, 1) as median,
        MIN(total_god_score) as min,
        MAX(total_god_score) as max,
        ROUND(STDDEV(total_god_score)::numeric, 1) as stddev
      FROM startup_uploads
      WHERE status = 'approved'
    `
  });

  if (stats && stats[0]) {
    const s = stats[0];
    console.log('\n📈 OVERALL STATISTICS:');
    console.log(`   Total Startups: ${s.total}`);
    console.log(`   Average Score:  ${s.avg}`);
    console.log(`   Median Score:   ${s.median}`);
    console.log(`   Range:          ${s.min} - ${s.max}`);
    console.log(`   Std Deviation:  ${s.stddev}`);
  }

  // Distribution by ranges
  const { data: distribution } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved');

  if (distribution) {
    const ranges = {
      '80-100 (Elite)': 0,
      '70-79 (Excellent)': 0,
      '60-69 (Strong)': 0,
      '50-59 (Good)': 0,
      '40-49 (Fair)': 0,
      'Below 40 (Weak)': 0
    };

    distribution.forEach(s => {
      const score = s.total_god_score;
      if (score >= 80) ranges['80-100 (Elite)']++;
      else if (score >= 70) ranges['70-79 (Excellent)']++;
      else if (score >= 60) ranges['60-69 (Strong)']++;
      else if (score >= 50) ranges['50-59 (Good)']++;
      else if (score >= 40) ranges['40-49 (Fair)']++;
      else ranges['Below 40 (Weak)']++;
    });

    console.log('\n📊 DISTRIBUTION BY RANGE:');
    const total = distribution.length;
    Object.entries(ranges).forEach(([range, count]) => {
      const pct = ((count / total) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(pct / 2));
      console.log(`   ${range.padEnd(20)} ${count.toString().padStart(5)} (${pct.padStart(5)}%) ${bar}`);
    });
  }

  // Top 10
  const { data: top10 } = await supabase
    .from('startup_uploads')
    .select('name, website, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(10);

  if (top10 && top10.length > 0) {
    console.log('\n🏆 TOP 10 HIGHEST SCORES:');
    top10.forEach((s, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${s.name || s.website} - ${s.total_god_score}`);
      console.log(`       Team: ${s.team_score}, Traction: ${s.traction_score}, Market: ${s.market_score}, Product: ${s.product_score}, Vision: ${s.vision_score}`);
    });
  }

  // Bottom 10
  const { data: bottom10 } = await supabase
    .from('startup_uploads')
    .select('name, website, total_god_score')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: true })
    .limit(10);

  if (bottom10 && bottom10.length > 0) {
    console.log('\n⚠️  BOTTOM 10 SCORES:');
    bottom10.forEach((s, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${s.name || s.website} - ${s.total_god_score}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Analysis complete\n');
}

checkDistribution().catch(console.error);
