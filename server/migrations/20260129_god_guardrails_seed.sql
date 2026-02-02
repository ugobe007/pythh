-- ============================================================================
-- GOD Guardrails - SEED DATA
-- Run this AFTER the main migration (20260129_god_guardrails.sql)
-- ============================================================================

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

insert into public.god_weight_versions (
  weights_version,
  weights,
  created_by,
  comment
) values (
  'god_v1_initial',
  '{
    "normalizationDivisor": 23,
    "baseBoostMinimum": 2.0,
    "vibeBonusCap": 1.0,
    "finalScoreMultiplier": 10,
    "signals_contract_version": "signals_v1",
    "componentWeights": {
      "team": 0.25,
      "traction": 0.25,
      "market": 0.20,
      "product": 0.15,
      "vision": 0.15
    },
    "signalMaxPoints": {
      "founder_language_shift": 2.0,
      "investor_receptivity": 2.5,
      "news_momentum": 1.5,
      "capital_convergence": 2.0,
      "execution_velocity": 2.0
    },
    "invariants": {
      "componentWeightSum": 1.0,
      "signalMaxPointsSum": 10.0,
      "normalizedFeatureBounds": [0, 1],
      "totalScoreBounds": [0, 100],
      "maxSignalContribution": 10,
      "signalBonusBounds": [0, 10]
    }
  }'::jsonb,
  'system',
  'Original GOD weights (Jan 2026) with signals strategy. Fundamentals based on VC criteria (YC, Sequoia, Founders Fund). Signals add market psychology awareness with HARD CAP at +10 points.'
);

-- Set as active version
insert into public.god_runtime_config (id, active_weights_version)
values (1, 'god_v1_initial')
on conflict (id) do update set active_weights_version = 'god_v1_initial';
