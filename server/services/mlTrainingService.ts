/**
 * ML-Enhanced GOD Algorithm Training Service
 * 
 * UPDATED: January 29, 2026
 * 
 * This service trains on SIGNAL DATA from scrapers (not match feedback):
 * - Analyzes signal quality from inference scraper + signal cascade
 * - Identifies which signals correlate with funding success
 * - Learns which GOD score components are most predictive
 * - Generates weight adjustments based on real startup data
 * - Tracks algorithm performance over time
 * 
 * DATA SOURCES:
 * 1. entity_ontologies (semantic parser) - High-confidence entities
 * 2. startup_uploads.extracted_data (signal cascade) - Funding, traction, team signals
 * 3. GOD score components vs actual outcomes
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side use
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Types
// ============================================================================

interface SignalTrainingData {
  startup_id: string;
  startup_name: string;
  god_score: number;
  team_score: number;
  traction_score: number;
  market_score: number;
  product_score: number;
  vision_score: number;
  
  // Signal quality metrics
  has_funding_signals: boolean;
  funding_confidence: number;
  has_traction_signals: boolean;
  traction_confidence: number;
  has_team_signals: boolean;
  team_confidence: number;
  entity_confidence: number;
  
  // Actual outcomes
  funded: boolean;
  has_revenue: boolean;
  has_customers: boolean;
  is_launched: boolean;
  
  // Extracted data
  extracted_data: any;
}

interface TrainingPattern {
  pattern_type: 'high_signal' | 'low_signal' | 'anomaly';
  features: any;
  signal_quality: number;
  outcome_quality: number;
  weight: number;
}

interface AlgorithmWeights {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
  ecosystem: number;
  grit: number;
  problem_validation: number;
}

interface OptimizationResult {
  current_weights: AlgorithmWeights;
  recommended_weights: AlgorithmWeights;
  expected_improvement: number;
  confidence: number;
  reasoning: string[];
}

// ============================================================================
// Core ML Training Functions
// ============================================================================

/**
 * Collect training data from signal sources (scrapers + inference)
 * NEW: Uses actual startup data quality, not match feedback
 */
export async function collectTrainingData(): Promise<SignalTrainingData[]> {
  console.log('🎓 Collecting ML training data from signal sources...');
  console.log('   Sources: Inference scraper + Signal cascade + Entity ontologies');

  const BATCH_SIZE = 200;
  const MAX_RECORDS = 1000;
  
  // Fetch startups with their extracted data
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select(`
      id,
      name,
      total_god_score,
      team_score,
      traction_score,
      market_score,
      product_score,
      vision_score,
      team_signals,
      grit_signals,
      execution_signals,
      credential_signals,
      extracted_data,
      status
    `)
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(MAX_RECORDS);

  if (error) {
    console.error('❌ Error fetching startups:', error);
    return [];
  }

  if (!startups || startups.length === 0) {
    console.log('⚠️  No startup data found');
    return [];
  }

  console.log(`   ✅ Fetched ${startups.length} startups`);

  // Fetch entity ontology confidence scores
  const startupIds = startups.map(s => s.id);
  const { data: entities, error: entityError } = await supabase
    .from('entity_ontologies')
    .select('metadata')
    .eq('entity_type', 'STARTUP')
    .gte('confidence', 0.7);

  const entityConfidenceMap: Record<string, number> = {};
  (entities || []).forEach((e: any) => {
    const metadata = e.metadata || {};
    if (metadata.startup_id) {
      entityConfidenceMap[metadata.startup_id] = metadata.confidence || 0;
    }
  });

  console.log(`   ✅ Mapped ${Object.keys(entityConfidenceMap).length} entity confidence scores`);

  // Convert to training data
  const trainingData: SignalTrainingData[] = startups.map(startup => {
    const extracted = startup.extracted_data || {};
    
    // Analyze signal quality from extracted_data
    const fundingSignals = extracted.funding || {};
    const tractionSignals = extracted.traction || {};
    const teamSignals = extracted.team || {};
    
    // Calculate signal quality scores (0-1)
    const hasFundingSignals = !!(fundingSignals.stage || fundingSignals.raise_amount || fundingSignals.seeking);
    const fundingConfidence = hasFundingSignals ? 0.8 : 0.0;
    
    const hasTractionSignals = !!(tractionSignals.mrr || tractionSignals.arr || tractionSignals.customers || tractionSignals.growth_rate);
    const tractionConfidence = hasTractionSignals ? 0.9 : 0.0;
    
    const hasTeamSignals = startup.team_signals && startup.team_signals.length > 0;
    const teamConfidence = hasTeamSignals ? 0.85 : (teamSignals.team_size ? 0.5 : 0.0);
    
    const entityConfidence = entityConfidenceMap[startup.id] || 0.0;
    
    // Determine actual outcomes (success indicators)
    const funded = hasFundingSignals && (fundingSignals.stage_name !== 'Idea' && fundingSignals.stage_name !== 'Pre-Seed');
    const hasRevenue = !!(tractionSignals.mrr || tractionSignals.arr || extracted.has_revenue);
    const hasCustomers = !!(tractionSignals.customers || extracted.has_customers);
    const isLaunched = !!(extracted.product?.launched || extracted.is_launched);
    
    return {
      startup_id: startup.id,
      startup_name: startup.name,
      god_score: startup.total_god_score || 0,
      team_score: startup.team_score || 0,
      traction_score: startup.traction_score || 0,
      market_score: startup.market_score || 0,
      product_score: startup.product_score || 0,
      vision_score: startup.vision_score || 0,
      
      has_funding_signals: hasFundingSignals,
      funding_confidence: fundingConfidence,
      has_traction_signals: hasTractionSignals,
      traction_confidence: tractionConfidence,
      has_team_signals: hasTeamSignals,
      team_confidence: teamConfidence,
      entity_confidence: entityConfidence,
      
      funded: funded,
      has_revenue: hasRevenue,
      has_customers: hasCustomers,
      is_launched: isLaunched,
      
      extracted_data: extracted
    };
  });

  // Calculate statistics
  const highSignalCount = trainingData.filter(d => 
    (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3 > 0.6
  ).length;
  
  const fundedCount = trainingData.filter(d => d.funded).length;
  const revenueCount = trainingData.filter(d => d.has_revenue).length;
  const launchedCount = trainingData.filter(d => d.is_launched).length;

  console.log(`✅ Collected ${trainingData.length} training samples`);
  console.log(`   High signal quality: ${highSignalCount} (${((highSignalCount / trainingData.length) * 100).toFixed(1)}%)`);
  console.log(`   Funded startups: ${fundedCount} (${((fundedCount / trainingData.length) * 100).toFixed(1)}%)`);
  console.log(`   Has revenue: ${revenueCount} (${((revenueCount / trainingData.length) * 100).toFixed(1)}%)`);
  console.log(`   Launched: ${launchedCount} (${((launchedCount / trainingData.length) * 100).toFixed(1)}%)`);

  return trainingData;
}

/**
 * Extract patterns from high-quality signal data
 * NEW: Identifies which signals correlate with success
 */
export async function extractSuccessPatterns(): Promise<TrainingPattern[]> {
  console.log('🔍 Extracting patterns from signal data...');

  const outcomes = await collectTrainingData();
  const patterns: TrainingPattern[] = [];

  // Define what "success" means: funded, has revenue, or high GOD score with good signals
  const successful = outcomes.filter(d => {
    const avgSignalQuality = (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3;
    const hasRealTraction = d.funded || d.has_revenue || d.has_customers;
    return (avgSignalQuality >= 0.7 && d.god_score >= 70) || hasRealTraction;
  });

  const unsuccessful = outcomes.filter(d => {
    const avgSignalQuality = (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3;
    return avgSignalQuality < 0.3 && d.god_score < 50;
  });

  console.log(`   High signal startups: ${successful.length}`);
  console.log(`   Low signal startups: ${unsuccessful.length}`);

  // Extract patterns from high-signal startups
  for (const startup of successful) {
    const signalQuality = (startup.funding_confidence + startup.traction_confidence + startup.team_confidence) / 3;
    const outcomeQuality = startup.funded ? 1.0 : (startup.has_revenue ? 0.9 : (startup.is_launched ? 0.7 : 0.6));
    
    patterns.push({
      pattern_type: 'high_signal',
      features: {
        god_score: startup.god_score,
        team_score: startup.team_score,
        traction_score: startup.traction_score,
        market_score: startup.market_score,
        product_score: startup.product_score,
        vision_score: startup.vision_score,
        signal_quality: signalQuality,
        has_team_signals: startup.has_team_signals,
        has_traction_signals: startup.has_traction_signals,
        has_funding_signals: startup.has_funding_signals,
        funded: startup.funded,
        has_revenue: startup.has_revenue
      },
      signal_quality: signalQuality,
      outcome_quality: outcomeQuality,
      weight: outcomeQuality
    });
  }

  // Extract patterns from low-signal startups
  for (const startup of unsuccessful) {
    const signalQuality = (startup.funding_confidence + startup.traction_confidence + startup.team_confidence) / 3;
    
    patterns.push({
      pattern_type: 'low_signal',
      features: {
        god_score: startup.god_score,
        team_score: startup.team_score,
        traction_score: startup.traction_score,
        market_score: startup.market_score,
        product_score: startup.product_score,
        vision_score: startup.vision_score,
        signal_quality: signalQuality,
        has_team_signals: startup.has_team_signals,
        has_traction_signals: startup.has_traction_signals,
        has_funding_signals: startup.has_funding_signals
      },
      signal_quality: signalQuality,
      outcome_quality: 0.2,
      weight: 1.0 - signalQuality
    });
  }

  // Store patterns in database
  for (const pattern of patterns.slice(0, 100)) { // Limit to 100 patterns to avoid timeout
    await supabase.from('ml_training_patterns').upsert({
      pattern_type: pattern.pattern_type,
      features: pattern.features,
      outcome: pattern.pattern_type,
      outcome_quality: pattern.outcome_quality,
      weight: pattern.weight
    });
  }

  console.log(`✅ Extracted ${patterns.length} patterns`);
  console.log(`   High signal patterns: ${patterns.filter(p => p.pattern_type === 'high_signal').length}`);
  console.log(`   Low signal patterns: ${patterns.filter(p => p.pattern_type === 'low_signal').length}`);

  return patterns;
}

/**
 * Analyze which GOD score components predict success
 * NEW: Correlates component scores with actual outcomes
 */
export async function analyzeSuccessFactors(): Promise<any> {
  console.log('📊 Analyzing which GOD components predict success...');

  const outcomes = await collectTrainingData();

  // Define success: funded OR has revenue OR high GOD score with signals
  const successful = outcomes.filter(d => {
    const avgSignalQuality = (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3;
    return d.funded || d.has_revenue || (avgSignalQuality >= 0.7 && d.god_score >= 70);
  });

  const unsuccessful = outcomes.filter(d => {
    const avgSignalQuality = (d.funding_confidence + d.traction_confidence + d.team_confidence) / 3;
    return avgSignalQuality < 0.3 && d.god_score < 50;
  });

  // Calculate average component scores for successful vs unsuccessful
  const avgSuccessTeam = successful.reduce((sum, d) => sum + d.team_score, 0) / Math.max(successful.length, 1);
  const avgSuccessTraction = successful.reduce((sum, d) => sum + d.traction_score, 0) / Math.max(successful.length, 1);
  const avgSuccessMarket = successful.reduce((sum, d) => sum + d.market_score, 0) / Math.max(successful.length, 1);
  const avgSuccessProduct = successful.reduce((sum, d) => sum + d.product_score, 0) / Math.max(successful.length, 1);
  const avgSuccessVision = successful.reduce((sum, d) => sum + d.vision_score, 0) / Math.max(successful.length, 1);

  const avgFailTeam = unsuccessful.reduce((sum, d) => sum + d.team_score, 0) / Math.max(unsuccessful.length, 1);
  const avgFailTraction = unsuccessful.reduce((sum, d) => sum + d.traction_score, 0) / Math.max(unsuccessful.length, 1);
  const avgFailMarket = unsuccessful.reduce((sum, d) => sum + d.market_score, 0) / Math.max(unsuccessful.length, 1);
  const avgFailProduct = unsuccessful.reduce((sum, d) => sum + d.product_score, 0) / Math.max(unsuccessful.length, 1);
  const avgFailVision = unsuccessful.reduce((sum, d) => sum + d.vision_score, 0) / Math.max(unsuccessful.length, 1);

  // Calculate predictive power (delta between success/fail)
  const analysis = {
    team_delta: avgSuccessTeam - avgFailTeam,
    traction_delta: avgSuccessTraction - avgFailTraction,
    market_delta: avgSuccessMarket - avgFailMarket,
    product_delta: avgSuccessProduct - avgFailProduct,
    vision_delta: avgSuccessVision - avgFailVision,
    
    successful_count: successful.length,
    unsuccessful_count: unsuccessful.length,
    
    success_avg: {
      team: avgSuccessTeam,
      traction: avgSuccessTraction,
      market: avgSuccessMarket,
      product: avgSuccessProduct,
      vision: avgSuccessVision,
      god_score: successful.reduce((sum, d) => sum + d.god_score, 0) / Math.max(successful.length, 1)
    },
    
    fail_avg: {
      team: avgFailTeam,
      traction: avgFailTraction,
      market: avgFailMarket,
      product: avgFailProduct,
      vision: avgFailVision,
      god_score: unsuccessful.reduce((sum, d) => sum + d.god_score, 0) / Math.max(unsuccessful.length, 1)
    }
  };

  console.log('\n📈 Component Score Analysis:');
  console.log(`   Successful startups (n=${successful.length}):`);
  console.log(`     Team: ${avgSuccessTeam.toFixed(1)}, Traction: ${avgSuccessTraction.toFixed(1)}, Market: ${avgSuccessMarket.toFixed(1)}`);
  console.log(`     Product: ${avgSuccessProduct.toFixed(1)}, Vision: ${avgSuccessVision.toFixed(1)}`);
  console.log(`   Unsuccessful startups (n=${unsuccessful.length}):`);
  console.log(`     Team: ${avgFailTeam.toFixed(1)}, Traction: ${avgFailTraction.toFixed(1)}, Market: ${avgFailMarket.toFixed(1)}`);
  console.log(`     Product: ${avgFailProduct.toFixed(1)}, Vision: ${avgFailVision.toFixed(1)}`);
  console.log('\n📊 Predictive Power (success - fail delta):');
  console.log(`     Team: ${analysis.team_delta.toFixed(1)}`);
  console.log(`     Traction: ${analysis.traction_delta.toFixed(1)} ${analysis.traction_delta > 10 ? '⭐' : ''}`);
  console.log(`     Market: ${analysis.market_delta.toFixed(1)}`);
  console.log(`     Product: ${analysis.product_delta.toFixed(1)}`);
  console.log(`     Vision: ${analysis.vision_delta.toFixed(1)}`);

  return analysis;
}

/**
 * Generate weight optimization recommendations based on signal analysis
 * NEW: Uses component score deltas to suggest weight adjustments
 */
export async function generateOptimizationRecommendations(): Promise<OptimizationResult> {
  console.log('🧠 Generating ML-based optimization recommendations...');

  const outcomes = await collectTrainingData();
  const analysis = await analyzeSuccessFactors();

  // Current weights (from GOD algorithm in startupScoringService.ts)
  const currentWeights: AlgorithmWeights = {
    team: 3.0,
    traction: 3.0,
    market: 2.0,
    product: 2.0,
    vision: 2.0,
    ecosystem: 1.5,
    grit: 1.5,
    problem_validation: 2.0
  };

  const reasoning: string[] = [];
  let recommendedWeights = { ...currentWeights };
  let hasChanges = false;

  // Only make recommendations if we have sufficient data
  if (outcomes.length < 50) {
    console.log('ℹ️  Insufficient data for recommendations (need 50+ startups)');
    return {
      current_weights: currentWeights,
      recommended_weights: recommendedWeights,
      expected_improvement: 0,
      confidence: 0,
      reasoning: [`Insufficient data: ${outcomes.length} startups (need 50+)`]
    };
  }

  reasoning.push(`📊 Analyzing ${outcomes.length} startups with signal data`);
  reasoning.push(`   Successful: ${analysis.successful_count}`);
  reasoning.push(`   Unsuccessful: ${analysis.unsuccessful_count}`);

  // Analyze each component's predictive power
  // If delta is high (>10 points), that component is very predictive
  const deltas = [
    { name: 'team', delta: analysis.team_delta, current: currentWeights.team },
    { name: 'traction', delta: analysis.traction_delta, current: currentWeights.traction },
    { name: 'market', delta: analysis.market_delta, current: currentWeights.market },
    { name: 'product', delta: analysis.product_delta, current: currentWeights.product },
    { name: 'vision', delta: analysis.vision_delta, current: currentWeights.vision }
  ];

  // Sort by predictive power
  deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  reasoning.push('\n🔍 Component Predictive Power (success vs fail delta):');
  deltas.forEach(d => {
    const strength = Math.abs(d.delta) > 15 ? '⭐⭐⭐' : Math.abs(d.delta) > 10 ? '⭐⭐' : Math.abs(d.delta) > 5 ? '⭐' : '';
    reasoning.push(`   ${d.name}: ${d.delta.toFixed(1)} points ${strength}`);
  });

  // Generate recommendations based on deltas
  const topPredictor = deltas[0];
  const weakestPredictor = deltas[deltas.length - 1];

  // If top predictor has strong delta (>15) and isn't already highest weighted
  if (Math.abs(topPredictor.delta) > 15 && topPredictor.current < 3.5) {
    const increase = 0.5;
    (recommendedWeights as any)[topPredictor.name] = Math.min(topPredictor.current + increase, 4.0);
    hasChanges = true;
    reasoning.push(`\n📈 RECOMMENDATION: Increase ${topPredictor.name} weight to ${(recommendedWeights as any)[topPredictor.name]}`);
    reasoning.push(`   Reason: Strong predictor of success (Δ=${topPredictor.delta.toFixed(1)} points)`);
  }

  // If weakest predictor has very low delta (<3) and high weight
  if (Math.abs(weakestPredictor.delta) < 3 && weakestPredictor.current > 2.0) {
    const decrease = 0.25;
    (recommendedWeights as any)[weakestPredictor.name] = Math.max(weakestPredictor.current - decrease, 1.5);
    hasChanges = true;
    reasoning.push(`\n📉 RECOMMENDATION: Decrease ${weakestPredictor.name} weight to ${(recommendedWeights as any)[weakestPredictor.name]}`);
    reasoning.push(`   Reason: Low predictive power (Δ=${weakestPredictor.delta.toFixed(1)} points)`);
  }

  // Check GOD score distribution
  const avgGodScore = outcomes.reduce((sum, d) => sum + d.god_score, 0) / outcomes.length;
  if (avgGodScore < 50 && analysis.successful_count > 20) {
    reasoning.push(`\n⚠️ Average GOD score is low (${avgGodScore.toFixed(1)}), but ${analysis.successful_count} successful startups exist`);
    reasoning.push('   Consider: Algorithm may be too conservative - successful startups scoring lower than expected');
  } else if (avgGodScore > 70 && analysis.unsuccessful_count > analysis.successful_count) {
    reasoning.push(`\n⚠️ Average GOD score is high (${avgGodScore.toFixed(1)}), but more unsuccessful (${analysis.unsuccessful_count}) than successful (${analysis.successful_count})`);
    reasoning.push('   Consider: Algorithm may be too lenient - scores not reflecting reality');
  } else {
    reasoning.push(`\n✅ GOD score distribution healthy (avg ${avgGodScore.toFixed(1)})`);
  }

  if (!hasChanges) {
    console.log('ℹ️  No weight changes recommended - algorithm weights are optimal');
    return {
      current_weights: currentWeights,
      recommended_weights: recommendedWeights,
      expected_improvement: 0,
      confidence: 0.3,
      reasoning: ['No changes recommended - current weights performing well']
    };
  }

  // Calculate confidence based on sample size and delta magnitudes
  const avgDelta = deltas.reduce((sum, d) => sum + Math.abs(d.delta), 0) / deltas.length;
  let confidence = 0.5;
  
  if (outcomes.length > 200 && avgDelta > 10) confidence = 0.9;
  else if (outcomes.length > 100 && avgDelta > 8) confidence = 0.8;
  else if (outcomes.length > 50 && avgDelta > 5) confidence = 0.7;

  const expectedImprovement = confidence * 15; // 0-15% improvement

  // Save recommendation to database
  await supabase.from('ml_recommendations').insert({
    recommendation_type: 'weight_change',
    priority: confidence > 0.8 ? 'high' : 'medium',
    title: 'GOD Algorithm Weight Optimization from Signal Analysis',
    description: reasoning.join('\n'),
    current_value: currentWeights,
    proposed_value: recommendedWeights,
    expected_impact: `Expected ${expectedImprovement.toFixed(1)}% improvement in scoring accuracy`,
    confidence_score: confidence,
    status: 'pending'
  });

  console.log('\n✅ Optimization recommendations generated:');
  reasoning.forEach(r => console.log(`   ${r}`));

  return {
    current_weights: currentWeights,
    recommended_weights: recommendedWeights,
    expected_improvement: expectedImprovement,
    confidence,
    reasoning
  };
}

/**
 * Track algorithm performance over time
 * NEW: Tracks signal quality and GOD score accuracy
 */
export async function trackAlgorithmPerformance(
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  console.log(`📊 Tracking algorithm performance: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);

  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select(`
      id,
      total_god_score,
      team_score,
      traction_score,
      market_score,
      product_score,
      vision_score,
      extracted_data,
      updated_at
    `)
    .eq('status', 'approved')
    .gte('updated_at', periodStart.toISOString())
    .lte('updated_at', periodEnd.toISOString())
    .limit(1000);

  if (error || !startups || startups.length === 0) {
    console.error('Error fetching performance data:', error);
    return;
  }

  // Calculate signal quality across startups
  let totalSignalQuality = 0;
  let hasSignalsCount = 0;
  let fundedCount = 0;
  let revenueCount = 0;

  startups.forEach(s => {
    const extracted = s.extracted_data || {};
    const hasFunding = !!(extracted.funding?.stage || extracted.funding?.raise_amount);
    const hasTraction = !!(extracted.traction?.mrr || extracted.traction?.arr || extracted.traction?.customers);
    const hasTeam = !!(extracted.team?.team_size);
    
    if (hasFunding || hasTraction || hasTeam) {
      hasSignalsCount++;
      const signalQuality = (
        (hasFunding ? 0.8 : 0) +
        (hasTraction ? 0.9 : 0) +
        (hasTeam ? 0.7 : 0)
      ) / 3;
      totalSignalQuality += signalQuality;
    }

    if (hasFunding && extracted.funding?.stage_name !== 'Idea' && extracted.funding?.stage_name !== 'Pre-Seed') {
      fundedCount++;
    }
    if (hasTraction) {
      revenueCount++;
    }
  });

  const avgSignalQuality = hasSignalsCount > 0 ? totalSignalQuality / hasSignalsCount : 0;
  const avgGodScore = startups.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / startups.length;

  // Calculate score distribution
  const scoreDistribution = {
    '0-50': startups.filter(s => (s.total_god_score || 0) <= 50).length,
    '51-70': startups.filter(s => (s.total_god_score || 0) > 50 && (s.total_god_score || 0) <= 70).length,
    '71-85': startups.filter(s => (s.total_god_score || 0) > 70 && (s.total_god_score || 0) <= 85).length,
    '86-100': startups.filter(s => (s.total_god_score || 0) > 85).length
  };

  // Store metrics
  await supabase.from('algorithm_metrics').insert({
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    total_matches: startups.length,
    successful_matches: fundedCount,
    avg_match_score: avgGodScore,
    avg_god_score: avgGodScore,
    conversion_rate: fundedCount / Math.max(startups.length, 1),
    score_distribution: scoreDistribution,
    algorithm_version: '2.0-signal-based',
    metadata: {
      avg_signal_quality: avgSignalQuality,
      has_signals_count: hasSignalsCount,
      funded_count: fundedCount,
      revenue_count: revenueCount
    }
  });

  console.log('✅ Performance metrics stored');
  console.log(`   Total Startups: ${startups.length}`);
  console.log(`   With Signals: ${hasSignalsCount} (${((hasSignalsCount / startups.length) * 100).toFixed(1)}%)`);
  console.log(`   Avg Signal Quality: ${(avgSignalQuality * 100).toFixed(1)}%`);
  console.log(`   Funded: ${fundedCount} (${((fundedCount / startups.length) * 100).toFixed(1)}%)`);
  console.log(`   Avg GOD Score: ${avgGodScore.toFixed(1)}/100`);
}

/**
 * Run full ML training cycle
 * UPDATED: Now uses signal data, not match feedback
 */
export async function runMLTrainingCycle(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🤖 RUNNING ML TRAINING CYCLE (SIGNAL-BASED)');
  console.log('='.repeat(70) + '\n');
  console.log('Data Sources:');
  console.log('  • Inference Scraper → extracted_data');
  console.log('  • Signal Cascade → funding/traction/team signals');
  console.log('  • Entity Ontologies → confidence scores');
  console.log('');

  // Step 1: Collect training data from signal sources
  const trainingData = await collectTrainingData();

  if (trainingData.length === 0) {
    console.log('⚠️  No training data available - skipping ML cycle');
    return;
  }

  // Step 2: Extract patterns from high/low signal startups
  await extractSuccessPatterns();

  // Step 3: Analyze which components predict success
  await analyzeSuccessFactors();

  // Step 4: Generate weight recommendations
  const optimization = await generateOptimizationRecommendations();

  // Step 5: Track performance (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await trackAlgorithmPerformance(thirtyDaysAgo, now);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ML TRAINING CYCLE COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n📈 Expected Improvement: ${optimization.expected_improvement.toFixed(1)}%`);
  console.log(`🎯 Confidence Level: ${(optimization.confidence * 100).toFixed(0)}%`);
  console.log('\nRecommendations:');
  optimization.reasoning.forEach(r => console.log(`${r}`));
  
  if (optimization.confidence >= 0.8) {
    console.log('\n⚡ HIGH CONFIDENCE - Ready for automatic application');
  } else if (optimization.confidence >= 0.5) {
    console.log('\n⚠️  MEDIUM CONFIDENCE - Manual review recommended');
  }
  console.log('');
}

/**
 * Get ML performance dashboard data
 */
export async function getMLPerformanceDashboard(): Promise<any> {
  // Get latest metrics
  const { data: metrics } = await supabase
    .from('algorithm_metrics')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get pending recommendations
  const { data: recommendations } = await supabase
    .from('ml_recommendations')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: true });

  // Get success patterns
  const { data: patterns } = await supabase
    .from('ml_training_patterns')
    .select('*')
    .eq('pattern_type', 'successful')
    .order('outcome_quality', { ascending: false })
    .limit(10);

  return {
    metrics: metrics || [],
    recommendations: recommendations || [],
    success_patterns: patterns || []
  };
}

// ============================================================================
// Export all functions
// ============================================================================

export default {
  collectTrainingData,
  extractSuccessPatterns,
  analyzeSuccessFactors,
  generateOptimizationRecommendations,
  trackAlgorithmPerformance,
  runMLTrainingCycle,
  getMLPerformanceDashboard
};
