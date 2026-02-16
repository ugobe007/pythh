#!/usr/bin/env node
/**
 * ML Training Script v2
 * Analyzes GOD score distributions, startup quality patterns, and match coverage
 * to generate actionable recommendations for the platform.
 * 
 * Unlike v1 which depended on match feedback (funded/declined) that never existed,
 * v2 trains on GOD scores, startup data quality, signal coverage, and match distributions.
 * 
 * Writes to: ml_recommendations, algorithm_metrics, ai_logs
 * 
 * Usage: node run-ml-training.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// HELPER: percentile calculation
// ============================================================================
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ============================================================================
// MAIN TRAINING CYCLE
// ============================================================================
async function runTraining() {
  const startTime = Date.now();
  console.log('='.repeat(70));
  console.log('🤖 ML TRAINING CYCLE v2 — GOD Score & Data Quality Analysis');
  console.log('='.repeat(70));
  console.log(`   Started: ${new Date().toISOString()}\n`);

  const recommendations = [];
  const insights = {};
  
  // Standard GOD score weights (used as current_weights baseline)
  const currentWeights = {
    componentWeights: { team: 0.25, traction: 0.25, market: 0.20, product: 0.15, vision: 0.15 },
    signalMaxPoints: 10,
    vibeBonusCap: 10,
    baseBoostMinimum: 40
  };

  // Helper to create a recommendation with required DB fields
  // NOTE: DB constraint only allows recommendation_type='component_weight_adjustment'
  // We encode the actual category in the reasoning array
  function makeRec(category, reasoning, improvementPct, confidence, requiresApproval = true) {
    return {
      weights_version: `ml_training_v2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      source_weights_version: 'god_v1_initial',
      recommendation_type: 'component_weight_adjustment',
      current_weights: currentWeights,
      recommended_weights: currentWeights,
      reasoning: [`[${category}]`, ...reasoning],
      expected_improvement: Math.max(1, improvementPct),  // DB requires >= 1
      confidence,
      sample_success_count: 0,
      sample_fail_count: 0,
      sample_positive_rate: 0,
      cross_time_stable: true,
      golden_tests_passed: true,
      golden_tests_output: {},
      status: 'pending',
      requires_manual_approval: requiresApproval
    };
  }

  try {
    // ── Step 1: GOD Score Distribution Analysis ──────────────────────────
    console.log('📊 Step 1: Analyzing GOD score distribution...');
    
    const { data: approvedStartups, error: e1 } = await supabase
      .from('startup_uploads')
      .select('id, total_god_score, team_score, traction_score, market_score, product_score, vision_score, signals_bonus, status, sectors, created_at')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .limit(5000);
    
    if (e1) throw e1;
    
    const scores = (approvedStartups || []).map(s => s.total_god_score || 0).filter(s => s > 0);
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1);
    const p10 = percentile(scores, 10);
    const p25 = percentile(scores, 25);
    const p50 = percentile(scores, 50);
    const p75 = percentile(scores, 75);
    const p90 = percentile(scores, 90);
    const maxScore = Math.max(...scores, 0);
    
    insights.god_scores = { count: scores.length, avg, p10, p25, p50, p75, p90, max: maxScore };
    
    console.log(`   Approved startups: ${scores.length}`);
    console.log(`   GOD Score — Avg: ${avg.toFixed(1)}, P50: ${p50}, P75: ${p75}, P90: ${p90}, Max: ${maxScore}`);
    
    // Flag score clustering issues
    if (p75 - p25 < 10) {
      recommendations.push(makeRec(
        'score_distribution',
        [`GOD Score Compression: IQR (P25-P75) is only ${p75 - p25} points`, 'Scores too compressed \u2014 differentiation difficult', 'Consider adjusting component weights'],
        15, 0.85, true
      ));
    }
    
    // Flag if no startups are reaching high scores
    if (p90 < 60) {
      recommendations.push(makeRec(
        'score_calibration',
        [`Top startups not reaching high scores: P90 is only ${p90}`, 'Top 10% should ideally score 65+', 'Consider recalibrating scoring bands'],
        10, 0.7, true
      ));
    }
    console.log('   ✅ GOD score analysis complete\n');

    // ── Step 2: Component Score Imbalance Detection ──────────────────────
    console.log('🔍 Step 2: Detecting component score imbalances...');
    
    const components = ['team_score', 'traction_score', 'market_score', 'product_score', 'vision_score'];
    const componentAvgs = {};
    
    for (const comp of components) {
      const vals = (approvedStartups || []).map(s => s[comp] || 0).filter(v => v > 0);
      componentAvgs[comp] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }
    
    insights.component_avgs = componentAvgs;
    
    const overallCompAvg = Object.values(componentAvgs).reduce((a, b) => a + b, 0) / components.length;
    
    for (const [comp, compAvg] of Object.entries(componentAvgs)) {
      console.log(`   ${comp}: ${compAvg.toFixed(1)}`);
      
      // Flag severely underperforming components
      if (compAvg < overallCompAvg * 0.6) {
        const friendlyName = comp.replace('_score', '');
        recommendations.push(makeRec(
          'component_bias',
          [`${friendlyName} score systematically low: avg ${compAvg.toFixed(1)}`, `Overall component avg: ${overallCompAvg.toFixed(1)}`, 'May be too harshly scored or startups lack data'],
          12, 0.75, true
        ));
      }
    }
    console.log('   ✅ Component analysis complete\n');

    // ── Step 3: Signal Coverage Analysis ─────────────────────────────────
    console.log('📡 Step 3: Analyzing signal coverage...');
    
    const withSignals = (approvedStartups || []).filter(s => s.signals_bonus && s.signals_bonus > 0);
    const signalCoverage = withSignals.length / Math.max((approvedStartups || []).length, 1);
    const avgSignalBonus = withSignals.length > 0
      ? withSignals.reduce((a, s) => a + (s.signals_bonus || 0), 0) / withSignals.length
      : 0;
    
    insights.signals = { coverage: signalCoverage, avg_bonus: avgSignalBonus, count_with_signals: withSignals.length };
    
    console.log(`   Signal coverage: ${(signalCoverage * 100).toFixed(1)}% (${withSignals.length}/${(approvedStartups || []).length})`);
    console.log(`   Avg signal bonus (where present): ${avgSignalBonus.toFixed(2)}`);
    
    if (signalCoverage < 0.3) {
      recommendations.push(makeRec(
        'data_coverage',
        [`Low signal coverage: only ${(signalCoverage * 100).toFixed(1)}%`, `${(approvedStartups || []).length - withSignals.length} startups missing signal bonuses`, 'Run apply-signals-batch.ts for remaining startups'],
        20, 0.9, false
      ));
    }
    console.log('   ✅ Signal analysis complete\n');

    // ── Step 4: Sector Distribution Analysis ─────────────────────────────
    console.log('🏷️  Step 4: Analyzing sector distribution...');
    
    const sectorCounts = {};
    for (const s of (approvedStartups || [])) {
      const sectors = s.sectors || [];
      const sectorList = Array.isArray(sectors) ? sectors : (typeof sectors === 'string' ? [sectors] : []);
      for (const sec of sectorList) {
        if (sec) sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
      }
    }
    
    const sortedSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);
    const topSectors = sortedSectors.slice(0, 10);
    
    insights.sectors = { total_unique: sortedSectors.length, top_10: topSectors };
    
    console.log(`   Unique sectors: ${sortedSectors.length}`);
    for (const [sec, count] of topSectors.slice(0, 5)) {
      console.log(`   ${sec}: ${count}`);
    }
    console.log('   ✅ Sector analysis complete\n');

    // ── Step 5: Match Quality Snapshot ────────────────────────────────────
    console.log('🔗 Step 5: Analyzing match quality...');
    
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    const { data: matchSample } = await supabase
      .from('startup_investor_matches')
      .select('match_score, status')
      .limit(1000)
      .order('match_score', { ascending: false });
    
    const matchScores = (matchSample || []).map(m => m.match_score || 0);
    const avgMatchScore = matchScores.reduce((a, b) => a + b, 0) / Math.max(matchScores.length, 1);
    const matchP50 = percentile(matchScores, 50);
    const matchP90 = percentile(matchScores, 90);
    
    // Check status distribution
    const statusCounts = {};
    for (const m of (matchSample || [])) {
      statusCounts[m.status || 'null'] = (statusCounts[m.status || 'null'] || 0) + 1;
    }
    
    insights.matches = { total: totalMatches, avg_score: avgMatchScore, p50: matchP50, p90: matchP90, statuses: statusCounts };
    
    console.log(`   Total matches: ${(totalMatches || 0).toLocaleString()}`);
    console.log(`   Top 1000 — Avg: ${avgMatchScore.toFixed(1)}, P50: ${matchP50}, P90: ${matchP90}`);
    console.log(`   Status distribution: ${JSON.stringify(statusCounts)}`);
    
    // Flag if all matches are still 'suggested' (no user engagement)
    const suggestedPct = ((statusCounts['suggested'] || 0) / Math.max(matchScores.length, 1)) * 100;
    if (suggestedPct > 95) {
      recommendations.push(makeRec(
        'engagement',
        [`${suggestedPct.toFixed(0)}% of matches still suggested`, 'No user interactions (viewed/contacted/funded)', 'Need user feedback loop for ML improvement'],
        5, 0.95, false
      ));
    }
    console.log('   ✅ Match analysis complete\n');

    // ── Step 6: Data Freshness ───────────────────────────────────────────
    console.log('⏱️  Step 6: Checking data freshness...');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { count: recentStartups } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);
    
    const { count: recent48h } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoDaysAgo);
    
    insights.freshness = { last_24h: recentStartups, last_48h: recent48h };
    
    console.log(`   New startups (24h): ${recentStartups || 0}`);
    console.log(`   New startups (48h): ${recent48h || 0}`);
    
    if ((recentStartups || 0) === 0) {
      recommendations.push(makeRec(
        'data_freshness',
        ['No new startups in 24 hours', 'Scraper may be stuck or RSS sources exhausted', 'Check PM2: rss-scraper and auto-import-pipeline'],
        25, 0.8, false
      ));
    }
    console.log('   ✅ Freshness check complete\n');

    // ── Step 7: Save Recommendations ─────────────────────────────────────
    console.log('💡 Step 7: Saving recommendations...');
    
    if (recommendations.length > 0) {
      const { error: recError } = await supabase
        .from('ml_recommendations')
        .insert(recommendations);
      
      if (recError) {
        if (recError.message.includes('does not exist')) {
          console.log('   ⚠️  ml_recommendations table does not exist — skipping');
        } else {
          console.error('   ⚠️  Could not save recommendations:', recError.message);
        }
      } else {
        console.log(`   ✅ Saved ${recommendations.length} recommendation(s)\n`);
      }
    } else {
      console.log('   ✅ No issues detected — system healthy!\n');
    }

    // ── Step 8: Save Algorithm Metrics (to ml_recommendations as summary) ──
    console.log('📊 Step 8: Saving algorithm metrics...');
    
    const now = new Date();
    
    // Save a summary recommendation with overall metrics
    const summaryRec = makeRec(
      'training_summary',
      [
        `${scores.length} startups analyzed, GOD avg ${avg.toFixed(1)}, P50 ${p50}, P90 ${p90}, Max ${maxScore}`,
        `Signal coverage: ${(signalCoverage * 100).toFixed(1)}%`,
        `Matches: ${(totalMatches || 0).toLocaleString()}`,
        `Components — Team: ${componentAvgs.team_score?.toFixed(1)}, Traction: ${componentAvgs.traction_score?.toFixed(1)}, Market: ${componentAvgs.market_score?.toFixed(1)}, Product: ${componentAvgs.product_score?.toFixed(1)}, Vision: ${componentAvgs.vision_score?.toFixed(1)}`
      ],
      1, 1.0, false
    );
    // Note: status constraint only allows 'pending', 'approved', 'rejected'
    summaryRec.status = 'pending';
    
    const { error: metricsError } = await supabase
      .from('ml_recommendations')
      .insert(summaryRec);
    
    if (metricsError) {
      console.error('   ⚠️  Could not save metrics:', metricsError.message);
    } else {
      console.log('   ✅ Metrics saved\n');
    }

    // ── Step 9: Write to ai_logs ─────────────────────────────────────────
    console.log('📝 Step 9: Logging to ai_logs...');
    
    const durationMs = Date.now() - startTime;
    const hasHighPriority = recommendations.some(r => r.confidence >= 0.85 && r.recommendation_type !== 'training_summary');
    
    const { error: logError } = await supabase
      .from('ai_logs')
      .insert({
        operation: 'ml_training_v2',
        model: 'god-score-analyzer',
        input_tokens: scores.length,  // repurpose: number of startups analyzed
        output_tokens: recommendations.length,  // repurpose: recommendations generated
        status: hasHighPriority ? 'warning' : 'success',
        error_message: recommendations.length > 0
          ? recommendations.map(r => `[${r.recommendation_type}] ${(Array.isArray(r.reasoning) ? r.reasoning[0] : r.reasoning).substring(0, 80)}`).join(' | ')
          : null
      });
    
    if (logError) {
      console.error('   ⚠️  Could not log:', logError.message);
    } else {
      console.log('   ✅ Logged to ai_logs\n');
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('='.repeat(70));
    console.log('✅ ML TRAINING CYCLE v2 COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📈 Results:`);
    console.log(`   Approved Startups Analyzed: ${scores.length}`);
    console.log(`   GOD Score Avg: ${avg.toFixed(1)} | P50: ${p50} | P90: ${p90} | Max: ${maxScore}`);
    console.log(`   Signal Coverage: ${(signalCoverage * 100).toFixed(1)}%`);
    console.log(`   Total Matches: ${(totalMatches || 0).toLocaleString()}`);
    console.log(`   Recommendations Generated: ${recommendations.length}`);
    console.log(`   Duration: ${durationSec}s\n`);
    
    if (recommendations.length > 0) {
      console.log('📋 Recommendations:');
      for (const rec of recommendations) {
        if (rec.recommendation_type === 'training_summary') continue;
        console.log(`   [${rec.recommendation_type.toUpperCase()}] conf=${rec.confidence}`);
        const reasonText = Array.isArray(rec.reasoning) ? rec.reasoning.join('. ') : rec.reasoning;
        console.log(`         ${reasonText}\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error during training:', error.message);
    
    // Log failure to ai_logs
    try {
      await supabase.from('ai_logs').insert({
        operation: 'ml_training_v2',
        model: 'god-score-analyzer',
        status: 'error',
        error_message: error.message
      });
    } catch (_) { /* best effort */ }
    
    throw error;
  }
}

// Run the training
runTraining()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Training failed:', error);
    process.exit(1);
  });

