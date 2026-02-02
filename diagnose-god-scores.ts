/**
 * GOD SCORE DIAGNOSTIC TOOL
 * Analyzes why GOD scores are higher than expected (70.4 avg vs <55 target)
 * Checks scoring logic, component weights, and data distribution
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore, GOD_SCORE_CONFIG } from './server/services/startupScoringService';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function diagnoseGODScores() {
  console.log('🔬 GOD SCORE DIAGNOSTIC');
  console.log('=======================\n');

  // 1. Check configuration
  console.log('📋 Current Configuration:');
  console.log(`   normalizationDivisor: ${GOD_SCORE_CONFIG.normalizationDivisor}`);
  console.log(`   baseBoostMinimum: ${GOD_SCORE_CONFIG.baseBoostMinimum}`);
  console.log(`   vibeBonusCap: ${GOD_SCORE_CONFIG.vibeBonusCap}`);
  console.log(`   Alert thresholds: ${GOD_SCORE_CONFIG.averageScoreAlertLow}-${GOD_SCORE_CONFIG.averageScoreAlertHigh}\n`);

  // 2. Sample actual startups and recalculate
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved')
    .limit(50);

  if (error || !startups) {
    console.error('❌ Error fetching startups:', error);
    return;
  }

  console.log(`📊 Analyzing ${startups.length} sample startups...\n`);

  // Calculate scores and compare
  const results: Array<{
    name: string;
    storedScore: number;
    recalculatedScore: number;
    diff: number;
    breakdown: any;
    rawTotal: number;
  }> = [];

  for (const startup of startups) {
    const profile = toScoringProfile(startup);
    const result = calculateHotScore(profile);
    const recalculated = Math.round(result.total * 10); // Convert 0-10 to 0-100
    const stored = startup.total_god_score || 0;
    
    // Calculate raw total (before normalization)
    const rawTotal = Object.values(result.breakdown).reduce((sum, val) => sum + val, 0);

    results.push({
      name: startup.name,
      storedScore: stored,
      recalculatedScore: recalculated,
      diff: Math.abs(recalculated - stored),
      breakdown: result.breakdown,
      rawTotal
    });
  }

  // 3. Analyze distribution
  const avgStored = results.reduce((sum, r) => sum + r.storedScore, 0) / results.length;
  const avgRecalculated = results.reduce((sum, r) => sum + r.recalculatedScore, 0) / results.length;
  const avgRawTotal = results.reduce((sum, r) => sum + r.rawTotal, 0) / results.length;

  console.log('📈 Score Distribution:');
  console.log(`   Average stored score: ${avgStored.toFixed(1)}/100`);
  console.log(`   Average recalculated: ${avgRecalculated.toFixed(1)}/100`);
  console.log(`   Average raw total (pre-normalization): ${avgRawTotal.toFixed(2)}`);
  console.log(`   Average on 0-10 scale: ${(avgRecalculated / 10).toFixed(2)}/10\n`);

  // 4. Component breakdown analysis
  console.log('🧩 Component Contribution (Average):');
  const avgComponents: Record<string, number> = {};
  for (const key in results[0].breakdown) {
    avgComponents[key] = results.reduce((sum, r) => sum + (r.breakdown[key] || 0), 0) / results.length;
  }

  const sortedComponents = Object.entries(avgComponents)
    .sort(([, a], [, b]) => b - a);

  for (const [component, value] of sortedComponents) {
    const percentage = (value / avgRawTotal) * 100;
    console.log(`   ${component.padEnd(20)}: ${value.toFixed(2)} (${percentage.toFixed(1)}%)`);
  }

  // 5. Check if normalization is appropriate
  console.log('\n🔧 Normalization Analysis:');
  console.log(`   Raw total: ${avgRawTotal.toFixed(2)}`);
  console.log(`   Divisor: ${GOD_SCORE_CONFIG.normalizationDivisor}`);
  console.log(`   Result: ${avgRawTotal.toFixed(2)} / ${GOD_SCORE_CONFIG.normalizationDivisor} * 10 = ${((avgRawTotal / GOD_SCORE_CONFIG.normalizationDivisor) * 10).toFixed(2)}`);
  
  // What divisor would give us a 55 average?
  const targetScore = 55;
  const requiredDivisor = (avgRawTotal / (targetScore / 10));
  console.log(`\n   To achieve ${targetScore} avg:`);
  console.log(`   Required divisor: ${requiredDivisor.toFixed(1)}`);
  console.log(`   Change needed: ${GOD_SCORE_CONFIG.normalizationDivisor} → ${Math.round(requiredDivisor)}`);

  // 6. Identify outliers
  console.log('\n🎯 Top 5 Highest Scores:');
  const topScores = [...results]
    .sort((a, b) => b.storedScore - a.storedScore)
    .slice(0, 5);

  for (const s of topScores) {
    console.log(`   ${s.name.slice(0, 30).padEnd(30)}: ${s.storedScore} (raw: ${s.rawTotal.toFixed(2)})`);
  }

  console.log('\n🎯 Bottom 5 Lowest Scores:');
  const bottomScores = [...results]
    .sort((a, b) => a.storedScore - b.storedScore)
    .slice(0, 5);

  for (const s of bottomScores) {
    console.log(`   ${s.name.slice(0, 30).padEnd(30)}: ${s.storedScore} (raw: ${s.rawTotal.toFixed(2)})`);
  }

  // 7. Recommendations
  console.log('\n💡 RECOMMENDATIONS:\n');

  if (avgStored > 75) {
    console.log('   🔴 CRITICAL: Scores too high (>75 avg)');
    console.log(`   ✅ Increase normalizationDivisor: ${GOD_SCORE_CONFIG.normalizationDivisor} → ${Math.round(requiredDivisor)}`);
    console.log(`   ⚠️  This will lower all scores proportionally\n`);
  } else if (avgStored > 65) {
    console.log('   🟡 WARNING: Scores moderately high (65-75 avg)');
    console.log(`   ✅ Consider increasing normalizationDivisor: ${GOD_SCORE_CONFIG.normalizationDivisor} → ${Math.round(requiredDivisor)}`);
    console.log(`   OR review component weights if some are dominating\n`);
  } else if (avgStored >= 55 && avgStored <= 65) {
    console.log('   🟢 HEALTHY: Scores in target range (55-65 avg)');
    console.log('   ✅ No action needed\n');
  } else {
    console.log('   🔴 CRITICAL: Scores too low (<55 avg)');
    console.log(`   ✅ Decrease normalizationDivisor: ${GOD_SCORE_CONFIG.normalizationDivisor} → ${Math.round(requiredDivisor)}`);
    console.log(`   ⚠️  This will raise all scores proportionally\n`);
  }

  // Check if any components are dominating
  const maxComponent = Math.max(...Object.values(avgComponents));
  const maxComponentName = Object.entries(avgComponents)
    .find(([, v]) => v === maxComponent)?.[0];
  const maxPercentage = (maxComponent / avgRawTotal) * 100;

  if (maxPercentage > 35) {
    console.log(`   ⚠️  Component "${maxComponentName}" is dominating (${maxPercentage.toFixed(1)}%)`);
    console.log('   Consider rebalancing component weights\n');
  }

  console.log('✅ Diagnostic complete\n');
}

// Helper to convert DB row to scoring profile
function toScoringProfile(startup: any): any {
  const extracted = startup.extracted_data || {};
  return {
    name: startup.name,
    website: startup.website,
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    team: extracted.team || [],
    mrr: startup.mrr || extracted.mrr,
    revenue: startup.arr || startup.revenue || extracted.revenue,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate,
    customers: startup.customer_count || extracted.customers,
    industries: startup.sectors || extracted.sectors || [],
    founded_date: startup.founded_date || startup.created_at,
    ...startup,
    ...extracted
  };
}

diagnoseGODScores().catch(console.error);
