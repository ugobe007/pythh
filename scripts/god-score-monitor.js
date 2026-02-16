/**
 * GOD Score Monitor - Runs every 2 hours to check score distribution
 * Logs results to ai_logs table (not chat window)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkGODScores() {
  const timestamp = new Date().toISOString();
  
  try {
    // Get all approved startup scores
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('total_god_score, name')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: true });

    if (error) throw error;

    const scores = startups.map(s => s.total_god_score);
    const total = scores.length;
    
    // Calculate distribution
    const distribution = {
      total,
      min: Math.min(...scores),
      p10: scores[Math.floor(total * 0.1)],
      p25: scores[Math.floor(total * 0.25)],
      median: scores[Math.floor(total * 0.5)],
      p75: scores[Math.floor(total * 0.75)],
      p90: scores[Math.floor(total * 0.9)],
      max: Math.max(...scores),
      avg: (scores.reduce((a,b) => a+b, 0) / total).toFixed(1)
    };

    // Count by tier
    const tiers = {
      elite: scores.filter(s => s >= 80).length,
      excellent: scores.filter(s => s >= 70 && s < 80).length,
      good: scores.filter(s => s >= 60 && s < 70).length,
      average: scores.filter(s => s >= 50 && s < 60).length,
      below: scores.filter(s => s >= 40 && s < 50).length,
      floor: scores.filter(s => s < 40).length
    };

    // Top 10 and bottom 10
    const top10 = startups.slice(-10).reverse().map(s => `${s.name}:${s.total_god_score}`);
    const bottom10 = startups.slice(0, 10).map(s => `${s.name}:${s.total_god_score}`);

    const report = {
      timestamp,
      distribution,
      tiers,
      top10,
      bottom10
    };

    // Log to ai_logs table
    await supabase.from('ai_logs').insert({
      agent_name: 'god-score-monitor',
      action: 'distribution_check',
      details: report,
      metadata: {
        check_type: 'automated_2hr',
        healthy: distribution.avg >= 45 && distribution.avg <= 65
      }
    });

    // Quick console output for manual runs
    console.log(`\n📊 GOD Score Distribution (${timestamp})`);
    console.log('━'.repeat(60));
    console.log(`Total Startups: ${total}`);
    console.log(`Range: ${distribution.min} - ${distribution.max} (cap at 85)`);
    console.log(`Avg: ${distribution.avg} | Median: ${distribution.median}`);
    console.log(`\nPercentiles:`);
    console.log(`  P10: ${distribution.p10} | P25: ${distribution.p25}`);
    console.log(`  P75: ${distribution.p75} | P90: ${distribution.p90}`);
    console.log(`\nTiers:`);
    console.log(`  🏆 Elite (80+):     ${tiers.elite} (${(tiers.elite/total*100).toFixed(1)}%)`);
    console.log(`  ⭐ Excellent (70+): ${tiers.excellent} (${(tiers.excellent/total*100).toFixed(1)}%)`);
    console.log(`  ✅ Good (60+):      ${tiers.good} (${(tiers.good/total*100).toFixed(1)}%)`);
    console.log(`  📊 Average (50+):   ${tiers.average} (${(tiers.average/total*100).toFixed(1)}%)`);
    console.log(`  📉 Below Avg (40+): ${tiers.below} (${(tiers.below/total*100).toFixed(1)}%)`);
    if (tiers.floor > 0) {
      console.log(`  ⚠️  Below Floor:    ${tiers.floor} (should be 0 - trigger enforced)`);
    }
    console.log(`\nTop 3: ${top10.slice(0,3).join(', ')}`);
    console.log(`Bottom 3: ${bottom10.slice(0,3).join(', ')}`);
    console.log('━'.repeat(60));

    return report;

  } catch (error) {
    console.error('❌ Monitor error:', error);
    
    // Log error to ai_logs
    await supabase.from('ai_logs').insert({
      agent_name: 'god-score-monitor',
      action: 'distribution_check_error',
      details: { error: error.message, timestamp },
      metadata: { severity: 'high' }
    });

    throw error;
  }
}

// Run immediately if called directly
if (require.main === module) {
  checkGODScores()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { checkGODScores };
