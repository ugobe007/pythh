/**
 * PYTH AI SCORE RECALCULATOR
 * ============================
 * Recalculates GOD scores for startups using the SINGLE SOURCE OF TRUTH:
 * ../server/services/startupScoringService.ts
 * 
 * ALSO includes Bootstrap Scoring for sparse-data startups:
 * ../server/services/bootstrapScoringService.ts
 * 
 * ⚠️  DO NOT ADD SCORING LOGIC HERE - use the scoring services instead!
 * 
 * Runs hourly via PM2 cron.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../server/services/startupScoringService';
import { calculateBootstrapScore } from '../server/services/bootstrapScoringService';

// T2: Momentum scoring layer (CommonJS)
const { calculateMomentumScore, loadScoreHistoryBatch } = require('../server/services/momentumScoringService');

// T4: AP + Promising scoring layer (Feb 14, 2026) - ADMIN APPROVED
import { calculateAPOrPromisingBonus } from '../server/services/apScoringService';

// T5: Elite tiered scoring boost — rewards excellence across multiple dimensions
import { calculateEliteBoost } from '../server/services/eliteScoringService';

// T6: Spiky Bachelor + Hot Startup recognition
import { calculateSpikyAndHotBonus } from '../server/services/spikyBachelorService';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ScoreBreakdown {
  market_score: number;
  team_score: number;
  traction_score: number;
  product_score: number;
  vision_score: number;
  total_god_score: number;
  // Phase 1 Psychological Signals (Feb 12, 2026)
  // Note: Column named psychological_multiplier but stores additive bonus
  psychological_multiplier?: number; // -0.3 to +1.0 (on 0-10 scale)
  enhanced_god_score?: number;
  psychological_signals?: {
    fomo: number;
    conviction: number;
    urgency: number;
    risk: number;
  };
}

type FaithAgg = {
  topScore: number;       // 0-100
  avgScore: number;       // 0-100
  count: number;
  confidenceAvg: number;  // 0-1
};

async function loadFaithAggregates(): Promise<Map<string, FaithAgg>> {
  const map = new Map<string, FaithAgg>();
  try {
    const { data, error } = await supabase
      .from('faith_alignment_matches')
      .select('startup_id, faith_alignment_score, confidence');
    if (error) {
      console.warn('Faith aggregates query failed:', error.message);
      return map;
    }
    if (!data || data.length === 0) return map;

    // Aggregate per startup
    for (const row of data) {
      const sid = row.startup_id as string;
      const score = Number(row.faith_alignment_score) || 0;
      const conf = typeof row.confidence === 'number' ? row.confidence : (Number(row.confidence) || 0);
      const prev = map.get(sid);
      if (!prev) {
        map.set(sid, { topScore: score, avgScore: score, count: 1, confidenceAvg: conf || 0 });
      } else {
        const count = prev.count + 1;
        const avg = (prev.avgScore * prev.count + score) / count;
        const confAvg = (prev.confidenceAvg * prev.count + (conf || 0)) / count;
        map.set(sid, { topScore: Math.max(prev.topScore, score), avgScore: avg, count, confidenceAvg: confAvg });
      }
    }
  } catch (e) {
    console.warn('Failed to build faith aggregates:', e);
  }
  return map;
}

/**
 * Convert startup DB row to profile format for scoring service
 * 
 * The scoring service now handles BOTH:
 * 1. Numeric values (revenue: 100000) - uses exact amounts for tiered scoring
 * 2. Boolean inference signals (has_revenue: true) - uses as fallback when no numbers
 */
function toScoringProfile(startup: any): any {
  // Extract data from extracted_data JSONB column if available
  const extracted = startup.extracted_data || {};
  
  // ============================================================================
  // PARSED METRICS INTEGRATION (v1 - wired Feb 2026)
  // ============================================================================
  // The startup-metric-parser.js backfill populates these columns:
  //   arr_usd, revenue_usd, last_round_amount_usd, total_funding_usd,
  //   parsed_customers, parsed_users, parsed_headcount,
  //   burn_monthly_usd, runway_months, valuation_usd,
  //   funding_confidence, traction_confidence
  //
  // These are HIGHER QUALITY than extracted_data because:
  //   1. Plausibility-capped ($15B max round, $500B max valuation)
  //   2. Confidence-gated ($2B+ needs conf≥0.7)
  //   3. Publisher-domain filtered (120+ blacklist)
  //   4. Two-pass best-mention selection
  //
  // Wire them in as PRIMARY source, with old fields as fallback.
  // Gate on confidence: only use parsed funding if funding_confidence ≥ 0.5
  // ============================================================================
  
  const fundingConfidence = startup.funding_confidence || 0;
  const tractionConfidence = startup.traction_confidence || 0;
  
  // Parsed ARR/revenue (gate on traction confidence ≥ 0.4)
  const parsedRevenue = (tractionConfidence >= 0.4)
    ? (startup.arr_usd || startup.revenue_usd || 0)
    : 0;
  
  // Parsed customer/user counts (no confidence gate needed — headcount is high confidence)
  const parsedCustomers = startup.parsed_customers || 0;
  const parsedUsers = startup.parsed_users || 0;
  
  // Parsed funding amount (gate on funding confidence ≥ 0.5)
  const parsedFunding = (fundingConfidence >= 0.5)
    ? (startup.last_round_amount_usd || startup.total_funding_usd || 0)
    : 0;
  
  // Parsed burn/runway (gate on funding confidence ≥ 0.4)
  const parsedBurn = (fundingConfidence >= 0.4) ? (startup.burn_monthly_usd || 0) : 0;
  const parsedRunway = (fundingConfidence >= 0.4) ? (startup.runway_months || 0) : 0;
  
  // Infer boolean signals from parsed metrics
  const parsedHasRevenue = parsedRevenue > 0;
  const parsedHasCustomers = parsedCustomers > 0;
  
  // Pass through any additional fields FIRST, then override with explicit mappings
  const base = { ...startup, ...extracted };
  
  return {
    ...base,
    
    // Explicit field mappings (override spreads above)
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: startup.team_companies ? startup.team_companies.map((c: string) => ({
      name: 'Team Member',
      previousCompanies: [c]
    })) : (extracted.team || []),
    founders_count: startup.team_size || extracted.team_size || 1,
    technical_cofounders: (startup.has_technical_cofounder ? 1 : 0) || (extracted.has_technical_cofounder ? 1 : 0),
    
    // Numeric traction values — PARSED METRICS are primary, old fields are fallback
    mrr: startup.mrr || extracted.mrr,
    revenue: parsedRevenue || startup.arr || startup.revenue || extracted.revenue || extracted.arr,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate || extracted.growth_rate_monthly,
    customers: parsedCustomers || startup.customer_count || extracted.customers || extracted.customer_count,
    active_users: parsedUsers || extracted.active_users || extracted.users,
    gmv: extracted.gmv,
    retention_rate: extracted.retention_rate,
    churn_rate: extracted.churn_rate,
    prepaying_customers: extracted.prepaying_customers,
    signed_contracts: extracted.signed_contracts,
    
    // Boolean inference signals — enriched with parsed metric detection
    has_revenue: parsedHasRevenue || extracted.has_revenue,
    has_customers: parsedHasCustomers || extracted.has_customers,
    execution_signals: extracted.execution_signals || [],
    team_signals: extracted.team_signals || [],
    funding_amount: parsedFunding || extracted.funding_amount,
    funding_stage: extracted.funding_stage,
    
    // Funding & financial planning — wire in parsed metrics
    previous_funding: parsedFunding || startup.previous_funding || extracted.previous_funding,
    burn_rate: parsedBurn || startup.burn_rate || extracted.burn_rate,
    runway_months: parsedRunway || startup.runway_months || extracted.runway_months,
    
    // Product signals
    launched: startup.is_launched || extracted.is_launched || extracted.launched,
    demo_available: startup.has_demo || extracted.has_demo || extracted.demo_available,
    unique_ip: extracted.unique_ip,
    defensibility: extracted.defensibility,
    mvp_stage: extracted.mvp_stage,
    
    // Other fields
    founded_date: startup.founded_date || startup.created_at || extracted.founded_date,
    value_proposition: startup.value_proposition || startup.tagline || extracted.value_proposition,
    backed_by: startup.backed_by || extracted.backed_by || extracted.investors,
  };
}

/**
 * Use the SINGLE SOURCE OF TRUTH scoring service
 * ⚠️  ALL SCORING LOGIC LIVES IN startupScoringService.ts - NOT HERE!
 */
function calculateGODScore(startup: any): ScoreBreakdown {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  
  // Convert from 10-point scale to 100-point scale
  const total = Math.round(result.total * 10);
  
  // Map breakdown to 0-100 scale
  // Breakdown structure: team_execution (0-3), product_vision (0-2), traction (0-3), market (0-2), product (0-2)
  // Also includes: founder_courage (0-1.5), market_insight (0-1.5), team_age (0-1)
  // 
  // FIXED Feb 14, 2026: Use THEORETICAL maximums from scoring service to prevent >100
  // Previous "practical max" divisors were too small, causing scores of 109, 130, etc.
  // Correct maxes: team_execution(3)+team_age(1)=4, market(2)+insight(1.5)=3.5,
  //   traction=3, product=2, vision=2
  // All clamped to 100 as safety net.
  
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  
  return {
    team_score: Math.min(Math.round((teamCombined / 4.0) * 100), 100),       // Max: team_execution(3) + team_age(1) = 4.0
    traction_score: Math.min(Math.round(((result.breakdown.traction || 0) / 3.0) * 100), 100), // Max: traction = 3.0
    market_score: Math.min(Math.round((marketCombined / 3.5) * 100), 100),   // Max: market(2) + market_insight(1.5) = 3.5
    product_score: Math.min(Math.round(((result.breakdown.product || 0) / 2.0) * 100), 100),   // Max: product = 2.0
    vision_score: Math.min(Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100), 100), // Max: product_vision = 2.0
    total_god_score: total,
    // Phase 1 Psychological Signals (Feb 12, 2026) - ADMIN APPROVED (ADDITIVE)
    // FIX (Feb 14): Was reading result.psychological_bonus (undefined) instead of result.psychological_multiplier
    psychological_multiplier: result.psychological_multiplier || 0,
    enhanced_god_score: result.enhanced_total ? Math.round(result.enhanced_total * 10) : total,
    psychological_signals: result.psychological_signals || { fomo: 0, conviction: 0, urgency: 0, risk: 0 }
  };
}

async function recalculateScores(): Promise<void> {
  console.log('🔢 Starting GOD Score recalculation (using SINGLE SOURCE OF TRUTH)...');
  console.log('🚀 Including Bootstrap Scoring for sparse-data startups...\n');
  
  // Load faith-alignment aggregates once (optional; safe if table empty)
  const faithAgg = await loadFaithAggregates();

  // Get startups that need recalculation
  // Process all approved/pending startups with pagination (Supabase default limit is 1000)
  let startups: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: batch, error: fetchError } = await supabase
      .from('startup_uploads')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('updated_at', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (fetchError) {
      console.error('Error fetching startups:', fetchError);
      process.exit(1);
    }
    if (!batch || batch.length === 0) break;
    startups = startups.concat(batch);
    if (batch.length < pageSize) break;
    page++;
  }

  if (!startups || startups.length === 0) {
    console.log('No startups to process');
    return;
  }

  console.log(`📊 Processing ${startups.length} startups...`);

  // T2: Pre-load score history for momentum trajectory dimension
  const startupIds = startups.map((s: any) => s.id);
  let scoreHistoryMap: Map<string, any[]> = new Map();
  try {
    scoreHistoryMap = await loadScoreHistoryBatch(supabase, startupIds);
    console.log(`📈 Loaded score history for ${scoreHistoryMap.size} startups`);
  } catch (e) {
    console.warn('⚠️  Score history load failed — momentum trajectory disabled');
  }

  // T2: Check if momentum_score column exists (added lazily)
  let momentumColumnExists = false;
  try {
    const { error: colTest } = await supabase
      .from('startup_uploads')
      .select('momentum_score')
      .limit(1);
    momentumColumnExists = !colTest || !colTest.message?.includes('momentum_score');
  } catch {
    momentumColumnExists = false;
  }
  if (!momentumColumnExists) {
    console.warn('⚠️  momentum_score column not found — momentum stored in total_god_score only');
  }

  let updated = 0;
  let unchanged = 0;
  let bootstrapApplied = 0;
  let momentumApplied = 0;
  let apApplied = 0;
  let promisingApplied = 0;
  let eliteApplied = 0;
  let spikyApplied = 0;
  let hotApplied = 0;

  for (const startup of startups) {
    const oldScore = startup.total_god_score || 0;
    
    // Inject faithSignals so scoring service can include feature-flagged boost in market timing
    const faith = faithAgg.get(startup.id) || undefined;
    const scores = calculateGODScore({ ...startup, faithSignals: faith });
    
    // Calculate bootstrap score for sparse-data startups
    let bootstrapBonus = 0;
    try {
      const bootstrapResult = await calculateBootstrapScore(supabase, {
        id: startup.id,
        name: startup.name,
        description: startup.description,
        pitch: startup.pitch,
        website: startup.website,
        founded_date: startup.founded_date,
        is_launched: startup.is_launched,
        mrr: startup.mrr,
        customer_count: startup.customer_count,
        team_size: startup.team_size,
        has_technical_cofounder: startup.has_technical_cofounder,
        founder_voice_score: startup.founder_voice_score,
        social_score: startup.social_score,
        total_god_score: scores.total_god_score,
        sectors: startup.sectors,
      });
      
      if (bootstrapResult.applied && bootstrapResult.total > 0) {
        bootstrapBonus = bootstrapResult.total;
        bootstrapApplied++;
        console.log(`  🚀 Bootstrap applied to ${startup.name}: +${bootstrapBonus} (${bootstrapResult.dataTier})`);
      }
    } catch (e) {
      // Bootstrap scoring is optional, continue if it fails
    }
    
    // Get signals_bonus from startup (already populated from startup_signal_scores)
    const signalsBonus = Math.min(startup.signals_bonus || 0, 8); // Capped at 8 (ADMIN APPROVED)
    
    // T2: Momentum scoring — forward movement recognition (+0 to +8 pts)
    let momentumBonus = 0;
    let momentumBreakdown: any = null;
    try {
      const momentumResult = calculateMomentumScore(startup, {
        scoreHistory: scoreHistoryMap.get(startup.id) || [],
      });
      if (momentumResult.applied && momentumResult.total > 0) {
        momentumBonus = momentumResult.total;
        momentumBreakdown = momentumResult.breakdown;
        momentumApplied++;
      }
    } catch (e) {
      // Momentum scoring is optional, continue if it fails
    }
    
    // T4: AP + Promising bonus — detects premium startups stuck below their tier
    let apPromisingBonus = 0;
    let apType: 'ap' | 'promising' | 'none' = 'none';
    try {
      // Pass the intermediate score so AP/Promising can determine which tier the startup is in
      const intermediateScore = Math.round(scores.total_god_score + bootstrapBonus + signalsBonus + momentumBonus);
      const apResult = calculateAPOrPromisingBonus({ ...startup, total_god_score: intermediateScore });
      if (apResult.bonus > 0) {
        apPromisingBonus = apResult.bonus;
        apType = apResult.type;
        if (apResult.type === 'ap') apApplied++;
        else if (apResult.type === 'promising') promisingApplied++;
      }
    } catch (e) {
      // AP/Promising scoring is optional, continue if it fails
    }

    // T5: Elite tiered scoring boost — multiplicative quality reward for 60+ startups
    let eliteBoost = 0;
    let eliteTier = 'none';
    try {
      const preEliteScore = Math.round(scores.total_god_score + bootstrapBonus + signalsBonus + momentumBonus + apPromisingBonus);
      const eliteResult = calculateEliteBoost(startup, preEliteScore);
      if (eliteResult.applied && eliteResult.boost > 0) {
        eliteBoost = eliteResult.boost;
        eliteTier = eliteResult.tier;
        eliteApplied++;
        if (eliteResult.boost >= 5) {
          console.log(`  🏆 Elite boost: ${startup.name} (${eliteTier}): +${eliteBoost} pts (excellence: ${eliteResult.excellenceScore.toFixed(1)}, multiplier: ${eliteResult.multiplier.toFixed(3)}x)`);
        }
      }
    } catch (e) {
      // Elite scoring is optional, continue if it fails
    }

    // T6: Spiky Bachelor + Hot Startup recognition — rewards organic quality spikes and momentum
    let spikyHotBonus = 0;
    try {
      const preSpikyScore = Math.round(scores.total_god_score + bootstrapBonus + signalsBonus + momentumBonus + apPromisingBonus + eliteBoost);
      const spikyResult = calculateSpikyAndHotBonus(
        { ...startup, team_score: scores.team_score, traction_score: scores.traction_score, market_score: scores.market_score, product_score: scores.product_score, vision_score: scores.vision_score },
        preSpikyScore
      );
      if (spikyResult.applied && spikyResult.totalBonus > 0) {
        spikyHotBonus = spikyResult.totalBonus;
        if (spikyResult.spikyBonus > 0) spikyApplied++;
        if (spikyResult.hotBonus > 0) hotApplied++;
        if (spikyResult.totalBonus >= 3) {
          console.log(`  🔥 Spiky/Hot: ${startup.name}: +${spikyResult.totalBonus} (spikes: ${spikyResult.spikes.join(', ')} | heat: ${spikyResult.heatSignals.join(', ')})`);
        }
      }
    } catch (e) {
      // Spiky/Hot scoring is optional, continue if it fails
    }

    // Final score = GOD score + capped additive bonuses (floor at 40, cap at 85)
    // ═══════════════════════════════════════════════════════════════════════
    // RECALIBRATION v2 (Feb 16, 2026): ADMIN APPROVED geometric weighting
    // Bonus hierarchy: Psych(10) > Bootstrap/Signals(8) > Momentum(8) > AP(3) > Spiky(2) > Hot(1)
    // Total bonus hard-capped at +8 (one tier max on 85-point scale)
    // GOD score cap: 85 (original design intent)
    // ═══════════════════════════════════════════════════════════════════════
    const totalBonuses = bootstrapBonus + signalsBonus + momentumBonus + apPromisingBonus + eliteBoost + spikyHotBonus;
    const cappedBonuses = Math.min(totalBonuses, 8); // Hard cap: +8 max (ADMIN APPROVED)
    const rawFinal = Math.round(scores.total_god_score + cappedBonuses);
    const finalScore = Math.min(Math.max(rawFinal, 40), 85); // Floor=40, Cap=85 (original design)
    
    // Phase 1 Psychological Signals (Feb 12, 2026) - Apply additive bonus to create enhanced score
    // enhanced_god_score = finalScore + psychological_multiplier (capped at 100)
    // Note: psychological_multiplier column stores additive bonus values (0-1.0 scale)
    // FIX (Feb 14): Field name now matches between calculateGODScore return and consumer
    const psychBonus = scores.psychological_multiplier || 0;
    const psychBonusGOD = Math.min(Math.max(psychBonus * 10, -5), 10); // Psych cap: -5 to +10 GOD pts (ADMIN APPROVED)
    const enhancedScore = Math.max(Math.min(Math.round(finalScore + psychBonusGOD), 85), 40); // Floor=40, Cap=85

    // Only update if score changed OR momentum_score needs backfill
    const oldMomentum = startup.momentum_score || 0;
    const momentumChanged = momentumColumnExists && Math.abs(momentumBonus - oldMomentum) > 0.01;
    if (finalScore !== oldScore || momentumChanged) {
      // Build update payload — momentum_score column may not exist yet
      const updatePayload: any = {
          total_god_score: finalScore,
          market_score: scores.market_score,
          team_score: scores.team_score,
          traction_score: scores.traction_score,
          product_score: scores.product_score,
          vision_score: scores.vision_score,
          // Phase 1 Psychological Signals (Feb 12, 2026) - ADDITIVE
          // Note: Column named psychological_multiplier but stores additive bonus
          psychological_multiplier: psychBonus,
          enhanced_god_score: enhancedScore,
          updated_at: new Date().toISOString()
      };
      // T2: Only include momentum_score if column exists (added lazily)
      if (momentumColumnExists) {
        updatePayload.momentum_score = momentumBonus;
      }

      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update(updatePayload)
        .eq('id', startup.id);

      if (updateError) {
        console.error(`Error updating ${startup.name}:`, updateError);
      } else {
        // Log score change
        try {
          await supabase.from('score_history').insert({
            startup_id: startup.id,
            old_score: oldScore,
            new_score: finalScore,
            reason: apPromisingBonus > 0 ? `recalc_with_${apType}` : momentumBonus > 0 ? 'recalc_with_momentum' : bootstrapBonus > 0 ? 'recalc_with_bootstrap' : 'hourly_recalc'
          });
        } catch {} // Ignore if table doesn't exist

        const boostParts: string[] = [];
        if (bootstrapBonus > 0) boostParts.push(`${bootstrapBonus} bootstrap`);
        if (signalsBonus > 0) boostParts.push(`${signalsBonus.toFixed(1)} signals`);
        if (momentumBonus > 0) boostParts.push(`${momentumBonus.toFixed(1)} momentum`);
        if (apPromisingBonus > 0) boostParts.push(`${apPromisingBonus.toFixed(1)} ${apType}`);
        if (eliteBoost > 0) boostParts.push(`${eliteBoost} elite(${eliteTier})`);
        if (spikyHotBonus > 0) boostParts.push(`${spikyHotBonus} spiky/hot`);
        if (psychBonus !== 0) boostParts.push(`${psychBonus.toFixed(2)} psych`);
        const cappedNote = totalBonuses > 10 ? ` [capped ${totalBonuses.toFixed(1)}→10]` : '';
        const boostNote = boostParts.length > 0 ? ` (+${boostParts.join(', ')}${cappedNote})` : '';
        const enhancedNote = enhancedScore !== finalScore ? ` → enhanced: ${enhancedScore}` : '';
        console.log(`  ✅ ${startup.name}: ${oldScore} → ${finalScore}${boostNote}${enhancedNote}`);
        updated++;
        
        // Track for gap refresh
        updatedStartupIds.push(startup.id);
      }
    } else {
      unchanged++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIGNAL GAP AUTO-RESOLUTION
  // After score changes, refresh gaps to auto-resolve improvements
  // ═══════════════════════════════════════════════════════════════════════════
  if (updatedStartupIds.length > 0) {
    console.log(`\n🔄 Refreshing signal gaps for ${updatedStartupIds.length} updated startups...`);
    try {
      // Dynamically import the gap service (CommonJS)
      const signalGapService = require('../server/lib/signalGapService');
      let gapsRefreshed = 0;
      let gapsResolved = 0;
      
      for (const startupId of updatedStartupIds.slice(0, 50)) { // Limit to 50 per run
        try {
          const result = await signalGapService.refreshGaps(startupId);
          gapsRefreshed += result.upserted;
          gapsResolved += result.resolved;
        } catch (e) {
          // Ignore individual failures
        }
      }
      
      if (gapsResolved > 0) {
        console.log(`  ✨ Auto-resolved ${gapsResolved} signal gaps (score improvements)`);
      }
      console.log(`  📊 Refreshed ${gapsRefreshed} gaps total`);
    } catch (e) {
      console.warn('  ⚠️ Signal gap refresh skipped (service not available)');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CANONICAL DELTA SYSTEM - Compute feature snapshots from GOD score changes
  // GOD absorbs verified deltas, not unverified claims
  // ═══════════════════════════════════════════════════════════════════════════
  if (updatedStartupIds.length > 0) {
    console.log(`\n📈 Computing canonical delta snapshots...`);
    try {
      const canonicalDelta = require('../server/lib/canonicalDeltaService');
      const config = await canonicalDelta.getDeltaConfig();
      let snapshotsCreated = 0;
      let godAdjustmentsApplied = 0;
      
      for (const startupId of updatedStartupIds.slice(0, 25)) { // Limit to 25 per run
        try {
          // Create feature snapshots from GOD component scores
          const startup = startups.find(s => s.id === startupId);
          if (!startup) continue;
          
          const scores = calculateGODScore(startup);
          
          // Map GOD components to canonical features with verification from data quality
          const featureWeights = config.feature_weights || {};
          const features = [
            { 
              id: 'traction', 
              norm: scores.traction_score / 100,
              weight: featureWeights.traction || 2.5,
              // Verification based on whether we have numeric data or just inference
              verification: (startup.mrr || startup.customer_count || startup.arr) ? 0.65 : 0.25,
              verificationTier: (startup.mrr || startup.customer_count) ? 'soft_verified' : 'unverified'
            },
            {
              id: 'team_strength',
              norm: scores.team_score / 100,
              weight: featureWeights.team_strength || 1.2,
              verification: startup.team_companies?.length > 0 ? 0.55 : 0.25,
              verificationTier: 'soft_verified'
            },
            {
              id: 'product_quality',
              norm: scores.product_score / 100,
              weight: featureWeights.product_quality || 1.2,
              verification: startup.is_launched ? 0.45 : 0.2,
              verificationTier: startup.is_launched ? 'soft_verified' : 'unverified'
            },
            {
              id: 'market_size',
              norm: scores.market_score / 100,
              weight: featureWeights.market_size || 1.0,
              verification: 0.35, // Market signals are typically inferred
              verificationTier: 'soft_verified'
            },
            {
              id: 'founder_velocity',
              norm: scores.vision_score / 100,
              weight: featureWeights.founder_velocity || 2.0,
              verification: startup.founder_voice_score ? 0.5 : 0.3,
              verificationTier: 'soft_verified'
            }
          ];
          
          // Insert feature snapshots
          const now = new Date().toISOString();
          for (const feature of features) {
            await supabase
              .from('feature_snapshots')
              .upsert({
                startup_id: startupId,
                feature_id: feature.id,
                raw: { source: 'god_recalc', god_component: feature.id },
                norm: feature.norm,
                weight: feature.weight,
                confidence: 0.7, // GOD scores have moderate confidence
                verification: feature.verification,
                freshness: 1.0, // Just calculated
                verification_tier: feature.verificationTier,
                measured_at: now
              }, {
                onConflict: 'startup_id,feature_id,measured_at'
              });
          }
          
          // Compute and store score snapshot
          const result = await canonicalDelta.computeAndStoreSnapshot(startupId, 'god_recalc');
          snapshotsCreated++;
          
          // Apply GOD adjustment if there are verified deltas
          const adjustment = await canonicalDelta.computeGodAdjustment(startupId);
          if (Math.abs(adjustment.adjustment) > 0.5) {
            godAdjustmentsApplied++;
            console.log(`    🎯 ${startup.name}: GOD adjustment ${adjustment.adjustment > 0 ? '+' : ''}${adjustment.adjustment.toFixed(1)}`);
          }
          
        } catch (e) {
          // Ignore individual failures, continue processing
        }
      }
      
      console.log(`  📊 Created ${snapshotsCreated} score snapshots`);
      if (godAdjustmentsApplied > 0) {
        console.log(`  🎯 Applied ${godAdjustmentsApplied} GOD adjustments from verified deltas`);
      }
    } catch (e) {
      console.warn('  ⚠️ Canonical delta computation skipped:', (e as Error).message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATION PIPELINE REFRESH
  // Process actions + evidence artifacts → update verification states → emit deltas
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n🔐 Refreshing verification pipeline...`);
  try {
    let actionsProcessed = 0;
    let verificationsUpdated = 0;
    let deltasEmitted = 0;
    
    // Get all unverified actions with evidence
    const { data: pendingActions, error: actionsError } = await supabase
      .from('action_events_v2')
      .select(`
        id,
        startup_id,
        type,
        title,
        status,
        fields
      `)
      .in('status', ['pending', 'provisional_applied'])
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (actionsError) {
      console.warn('  ⚠️ Failed to fetch actions:', actionsError.message);
    } else if (pendingActions?.length) {
      console.log(`  📋 Processing ${pendingActions.length} pending actions...`);
      
      for (const action of pendingActions) {
        actionsProcessed++;
        
        // Get evidence for this action
        const { data: evidence } = await supabase
          .from('evidence_artifacts_v2')
          .select('id, type, tier, confidence')
          .eq('action_id', action.id);
        
        // Get connected sources for this startup
        const { data: sources } = await supabase
          .from('connected_sources_v2')
          .select('provider, status')
          .eq('startup_id', action.startup_id)
          .eq('status', 'connected');
        
        // Calculate verification score
        const VERIFICATION_SCORES = {
          OAUTH_CONNECTOR: 0.35,
          WEBHOOK_EVENT: 0.35,
          DOC_PROOF: 0.20,
          PUBLIC_LINK: 0.10
        };
        
        let verificationScore = 0;
        
        // Add score from evidence
        for (const ev of evidence || []) {
          switch (ev.type) {
            case 'oauth_connector':
              verificationScore += VERIFICATION_SCORES.OAUTH_CONNECTOR;
              break;
            case 'webhook_event':
              verificationScore += VERIFICATION_SCORES.WEBHOOK_EVENT;
              break;
            case 'document_upload':
              verificationScore += VERIFICATION_SCORES.DOC_PROOF;
              break;
            case 'public_link':
              verificationScore += VERIFICATION_SCORES.PUBLIC_LINK;
              break;
          }
        }
        
        // Add score from connected sources relevant to action type
        const revenueTypes = ['revenue_change', 'contract_signed', 'new_customer', 'mrr_increase'];
        if (revenueTypes.includes(action.type)) {
          const hasStripe = sources?.some(s => s.provider === 'stripe');
          if (hasStripe) {
            verificationScore += VERIFICATION_SCORES.OAUTH_CONNECTOR;
          }
        }
        
        verificationScore = Math.min(1.0, verificationScore);
        
        // Determine tier
        const getTier = (score: number) => {
          if (score >= 0.85) return 'trusted';
          if (score >= 0.65) return 'verified';
          if (score >= 0.35) return 'soft_verified';
          return 'unverified';
        };
        
        const newTier = getTier(verificationScore);
        
        // Get or create verification state
        const { data: existingVs } = await supabase
          .from('verification_states_v2')
          .select('*')
          .eq('action_id', action.id)
          .single();
        
        const oldTier = existingVs?.tier || 'unverified';
        const oldScore = existingVs?.verification_score || 0;
        
        // Update if changed
        if (verificationScore !== oldScore || newTier !== oldTier) {
          const { error: vsError } = await supabase
            .from('verification_states_v2')
            .upsert({
              action_id: action.id,
              startup_id: action.startup_id,
              verification_score: verificationScore,
              tier: newTier,
              satisfied: verificationScore >= 0.65,
              matched_evidence_ids: (evidence || []).map(e => e.id),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'action_id'
            });
          
          if (!vsError) {
            verificationsUpdated++;
            
            // Emit delta if crossed verified threshold
            if ((newTier === 'verified' || newTier === 'trusted') && oldTier !== 'verified' && oldTier !== 'trusted') {
              const deltaSignal = verificationScore;
              const deltaGod = verificationScore * 0.25;
              
              const { error: deltaError } = await supabase
                .from('score_deltas_v2')
                .insert({
                  startup_id: action.startup_id,
                  action_id: action.id,
                  delta_signal: deltaSignal,
                  delta_god: deltaGod,
                  reason: 'verification_upgraded',
                  meta: {
                    previousTier: oldTier,
                    newTier,
                    source: 'recalculate_script'
                  }
                });
              
              if (!deltaError) {
                deltasEmitted++;
                console.log(`    ✅ ${action.title}: ${oldTier} → ${newTier} (delta emitted)`);
              }
              
              // Update action status
              await supabase
                .from('action_events_v2')
                .update({ status: 'verified' })
                .eq('id', action.id);
            }
          }
        }
      }
      
      console.log(`  📊 Processed ${actionsProcessed} actions`);
      console.log(`  🔄 Updated ${verificationsUpdated} verification states`);
      if (deltasEmitted > 0) {
        console.log(`  🎯 Emitted ${deltasEmitted} verified deltas`);
      }
    }
  } catch (e) {
    console.warn('  ⚠️ Verification pipeline refresh skipped:', (e as Error).message);
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Bootstrap applied: ${bootstrapApplied}`);
  console.log(`  Momentum applied: ${momentumApplied}`);
  console.log(`  AP applied: ${apApplied}`);
  console.log(`  Promising applied: ${promisingApplied}`);
  console.log(`  Elite boost applied: ${eliteApplied}`);
  console.log(`  Spiky Bachelor recognized: ${spikyApplied}`);
  console.log(`  Hot startup bonus: ${hotApplied}`);
  console.log(`  Total: ${startups.length}`);
  console.log('✅ Score recalculation complete');
}

// Track updated startups for gap refresh
const updatedStartupIds: string[] = [];

// Run
recalculateScores().catch(console.error);
