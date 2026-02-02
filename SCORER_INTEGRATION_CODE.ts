/**
 * ============================================================================
 * SIGNALS → GOD INTEGRATION CODE
 * Paste this into scripts/recalculate-scores.ts
 * ============================================================================
 */

/**
 * SIGNALS CONTRACT (SSOT) v1
 * -------------------------
 * The Signals system is its own SSOT for market psychology.
 * GOD does NOT define signal semantics. GOD only consumes the contract output.
 *
 * Contract input (from signal engine):
 *   - 5 dimension scores, each normalized to [0..1]
 *   - optional: confidence_0to1, recency_days, evidence list
 *
 * Contract output (to GOD):
 *   - signals_bonus points in [0..10], computed only by fixed weights + clamp
 *   - dimension_points breakdown (auditable)
 *
 * GOD never reinterprets signals. It only applies a bounded additive bonus.
 */

/**
 * SIGNALS → GOD (CANONICAL, NON-NEGOTIABLE)
 * ========================================
 *
 * Signals capture MARKET PSYCHOLOGY (not fundamentals):
 *  - Founder language + narrative shifts
 *  - Investor receptivity / revelations / sentiment
 *  - News momentum + attention velocity
 *  - Capital convergence (clustered interest)
 *  - Execution velocity (shipping cadence)
 *
 * Signals MUST influence GOD, but cannot hijack it.
 *
 * HARD CAP:
 * ---------
 * Signals contribute an additive bonus in [0..10] TOTAL points.
 * 10 = elite signal strength; 0 = no signal lift.
 *
 * Final GOD:
 *   base_god_total (0..100, fundamentals only)
 *   signals_bonus  (0..10, psychology only)
 *   total_god      = clamp(base_god_total + signals_bonus, 0, 100)
 *
 * Signals are NOT a fundamental component category.
 * They are stored separately and fully auditable in explanation payload.
 *
 * Guardrails:
 * -----------
 * - signals_bonus must be explicitly present in explanations
 * - signals_bonus must never exceed 10 (DB constraint + runtime invariant + CI)
 * - No copilot/model change may increase scores by 40–50 points via signals again.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Step 1: Load weights from database (version-controlled)
 */
async function loadGODWeights() {
  const { data: runtime } = await supabase.rpc('get_god_runtime').single();
  
  if (!runtime) {
    throw new Error('GOD runtime config not found - run migrations first');
  }

  // Check freeze flag
  if (runtime.freeze) {
    console.warn('⚠️  GOD scorer is FROZEN - skipping recalculation');
    process.exit(0);
  }

  const effectiveVersion = runtime.effective_weights_version;

  // Load weights blob
  const { data: version } = await supabase
    .from('god_weight_versions')
    .select('weights')
    .eq('weights_version', effectiveVersion)
    .single();

  if (!version) {
    throw new Error(`Weights version ${effectiveVersion} not found`);
  }

  return {
    effectiveVersion,
    weights: version.weights
  };
}

/**
 * Step 2: Compute BASE GOD score (fundamentals only, no signals)
 */
function computeBaseGOD(startup: any, weights: any) {
  const { normalizationDivisor, componentWeights, baseBoostMinimum } = weights;

  // Normalize features [0, 1]
  const normalizedTeam = Math.min(1, startup.team_score / normalizationDivisor);
  const normalizedTraction = Math.min(1, startup.traction_score / normalizationDivisor);
  const normalizedMarket = Math.min(1, startup.market_score / normalizationDivisor);
  const normalizedProduct = Math.min(1, startup.product_score / normalizationDivisor);
  const normalizedVision = Math.min(1, startup.vision_score / normalizationDivisor);

  // Weighted sum
  const weightedSum = 
    normalizedTeam * componentWeights.team +
    normalizedTraction * componentWeights.traction +
    normalizedMarket * componentWeights.market +
    normalizedProduct * componentWeights.product +
    normalizedVision * componentWeights.vision;

  // Scale to [0, 100]
  const baseScore = weightedSum * 100;

  // Apply base boost minimum (if configured)
  return Math.max(baseBoostMinimum || 0, baseScore);
}

/**
 * Step 3: Compute SIGNALS BONUS (market psychology, capped at 10)
 */
function computeSignalsBonus(startup: any, weights: any) {
  const signalMaxPoints = weights.signalMaxPoints || {
    founder_language_shift: 2.0,
    investor_receptivity: 2.5,
    news_momentum: 1.5,
    capital_convergence: 2.0,
    execution_velocity: 2.0
  };

  // Calculate each signal dimension (0-1 normalized)
  const founderLanguage = calculateFounderLanguageShift(startup);
  const investorReceptivity = calculateInvestorReceptivity(startup);
  const newsMomentum = calculateNewsMomentum(startup);
  const capitalConvergence = calculateCapitalConvergence(startup);
  const executionVelocity = calculateExecutionVelocity(startup);

  // Apply recency and confidence gating
  const recencyMultiplier = calculateRecencyMultiplier(startup);
  const confidenceMultiplier = calculateConfidenceMultiplier(startup);

  // Compute signals_bonus (each dimension contributes up to its max points)
  let signalsBonus =
    signalMaxPoints.founder_language_shift * founderLanguage +
    signalMaxPoints.investor_receptivity * investorReceptivity +
    signalMaxPoints.news_momentum * newsMomentum +
    signalMaxPoints.capital_convergence * capitalConvergence +
    signalMaxPoints.execution_velocity * executionVelocity;

  // Apply gating multipliers
  signalsBonus = signalsBonus * recencyMultiplier * confidenceMultiplier;

  // Round to 1 decimal
  signalsBonus = Math.round(signalsBonus * 10) / 10;

  // HARD CLAMP (defensive programming)
  signalsBonus = Math.max(0, Math.min(10, signalsBonus));

  // RUNTIME INVARIANT (copilot-proof)
  if (signalsBonus < 0 || signalsBonus > 10) {
    throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
  }

  return signalsBonus;
}

/**
 * Step 4: Get top signal contributions (for explanation payload)
 */
function getTopSignalContributions(startup: any, weights: any, dimensions: any) {
  const signalMaxPoints = weights.signalMaxPoints;
  const contributions = [];

  // Add each dimension with its contribution
  contributions.push({
    dimension: 'founder_language_shift',
    key: 'founder_language_shift',
    confidence: dimensions.founderLanguage.confidence || 0.5,
    recency_days: dimensions.founderLanguage.recency_days || 30,
    contrib_points: Math.round(signalMaxPoints.founder_language_shift * dimensions.founderLanguage.value * 10) / 10
  });

  contributions.push({
    dimension: 'investor_receptivity',
    key: 'investor_receptivity',
    confidence: dimensions.investorReceptivity.confidence || 0.5,
    recency_days: dimensions.investorReceptivity.recency_days || 30,
    contrib_points: Math.round(signalMaxPoints.investor_receptivity * dimensions.investorReceptivity.value * 10) / 10
  });

  contributions.push({
    dimension: 'news_momentum',
    key: 'news_momentum',
    confidence: dimensions.newsMomentum.confidence || 0.5,
    recency_days: dimensions.newsMomentum.recency_days || 30,
    contrib_points: Math.round(signalMaxPoints.news_momentum * dimensions.newsMomentum.value * 10) / 10
  });

  contributions.push({
    dimension: 'capital_convergence',
    key: 'capital_convergence',
    confidence: dimensions.capitalConvergence.confidence || 0.5,
    recency_days: dimensions.capitalConvergence.recency_days || 30,
    contrib_points: Math.round(signalMaxPoints.capital_convergence * dimensions.capitalConvergence.value * 10) / 10
  });

  contributions.push({
    dimension: 'execution_velocity',
    key: 'execution_velocity',
    confidence: dimensions.executionVelocity.confidence || 0.5,
    recency_days: dimensions.executionVelocity.recency_days || 30,
    contrib_points: Math.round(signalMaxPoints.execution_velocity * dimensions.executionVelocity.value * 10) / 10
  });

  // Sort by contribution desc
  return contributions
    .sort((a, b) => b.contrib_points - a.contrib_points)
    .slice(0, 10);
}

/**
 * Step 5: Main scoring loop
 */
async function recalculateScores() {
  console.log('🔧 Loading GOD weights from database...');
  const { effectiveVersion, weights } = await loadGODWeights();
  console.log(`✅ Using weights version: ${effectiveVersion}`);

  // Fetch startups
  const { data: startups } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('status', 'approved');

  console.log(`📊 Recalculating GOD scores for ${startups.length} startups...`);

  for (const startup of startups) {
    // STEP 1: Compute base GOD (fundamentals only)
    const baseGodScore = computeBaseGOD(startup, weights);

    // STEP 2: Compute signals bonus (0-10 capped)
    const signalsBonus = computeSignalsBonus(startup, weights);

    // STEP 3: Final GOD
    const godTotal = Math.max(0, Math.min(100, baseGodScore + signalsBonus));

    // STEP 4: Get signal dimensions for explanation
    const signalDimensions = {
      founderLanguage: {
        value: calculateFounderLanguageShift(startup),
        confidence: 0.5,
        recency_days: 30
      },
      investorReceptivity: {
        value: calculateInvestorReceptivity(startup),
        confidence: 0.5,
        recency_days: 30
      },
      newsMomentum: {
        value: calculateNewsMomentum(startup),
        confidence: 0.5,
        recency_days: 30
      },
      capitalConvergence: {
        value: calculateCapitalConvergence(startup),
        confidence: 0.5,
        recency_days: 30
      },
      executionVelocity: {
        value: calculateExecutionVelocity(startup),
        confidence: 0.5,
        recency_days: 30
      }
    };

    const topSignals = getTopSignalContributions(startup, weights, signalDimensions);

    // STEP 5: Update startup score
    await supabase
      .from('startup_uploads')
      .update({ total_god_score: godTotal })
      .eq('id', startup.id);

    // STEP 6: Upsert explanation payload
    await supabase
      .from('god_score_explanations')
      .upsert({
        startup_id: startup.id,
        weights_version: effectiveVersion,
        total_score: godTotal,
        base_total_score: baseGodScore,
        signals_bonus: signalsBonus,
        component_scores: {
          team: startup.team_score,
          traction: startup.traction_score,
          market: startup.market_score,
          product: startup.product_score,
          vision: startup.vision_score
        },
        top_signal_contributions: topSignals,
        debug: {
          signals_dimensions: signalDimensions,
          signals_weights_used: weights.signalMaxPoints,
          signals_contract_version: weights.signals_contract_version || 'signals_v1',
          normalizationDivisor: weights.normalizationDivisor,
          recencyMultiplier: calculateRecencyMultiplier(startup),
          confidenceMultiplier: calculateConfidenceMultiplier(startup)
        }
      });

    console.log(
      `✓ ${startup.name}: base=${baseGodScore.toFixed(1)}, signals=+${signalsBonus.toFixed(1)}, total=${godTotal.toFixed(1)}`
    );
  }

  console.log('✅ Recalculation complete!');
}

/**
 * ============================================================================
 * SIGNAL DIMENSION CALCULATORS (IMPLEMENT YOUR LOGIC HERE)
 * ============================================================================
 */

function calculateFounderLanguageShift(startup: any): number {
  // TODO: Analyze founder language patterns, positioning shifts
  // Return 0-1 score
  return 0.5; // placeholder
}

function calculateInvestorReceptivity(startup: any): number {
  // TODO: Analyze investor signals, opinions, revelations
  // Return 0-1 score
  return 0.5; // placeholder
}

function calculateNewsMomentum(startup: any): number {
  // TODO: Analyze news coverage, press velocity
  // Return 0-1 score
  return 0.5; // placeholder
}

function calculateCapitalConvergence(startup: any): number {
  // TODO: Analyze funding signals, investor clustering
  // Return 0-1 score
  return 0.5; // placeholder
}

function calculateExecutionVelocity(startup: any): number {
  // TODO: Analyze development pace, product iteration speed
  // Return 0-1 score
  return 0.5; // placeholder
}

function calculateRecencyMultiplier(startup: any): number {
  // TODO: Decay factor based on signal age
  // Recent signals (< 7 days) = 1.0
  // Stale signals (> 30 days) = 0.5
  // Very stale (> 90 days) = 0.1
  return 1.0; // placeholder
}

function calculateConfidenceMultiplier(startup: any): number {
  // TODO: Confidence based on evidence strength
  // High confidence (strong evidence) = 1.0
  // Medium confidence = 0.7
  // Low confidence = 0.3
  return 1.0; // placeholder
}

/**
 * ============================================================================
 * RUN SCORER
 * ============================================================================
 */
recalculateScores()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
