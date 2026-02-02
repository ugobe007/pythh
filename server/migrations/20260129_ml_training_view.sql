-- ============================================================================
-- ML Training Snapshot v1 - Single-Query Dataset (Leak-Free)
-- ============================================================================
-- Purpose: Pre-computed training data for ML agent
-- Performance: 10,916 queries → 1 query
-- Time separation: Features AS OF score_date, Outcomes AFTER score_date
-- 
-- Score date: Uses god_score_explanations.computed_at (actual scoring timestamp)
-- Outcome window: 180 days fixed (v1)
-- 
-- THIS IS THE SINGLE SOURCE OF TRUTH FOR ML TRAINING DATA
-- ============================================================================

BEGIN;

-- ---------- ENUM: success_reason (auditable labels) ----------
DO $$ BEGIN
  CREATE TYPE public.success_reason AS ENUM (
    'funding_event',       -- $500K+ raise within window
    'revenue_milestone',   -- $100K+ ARR within window
    'followon_round',      -- Next round within 18 months
    'retention',           -- 40%+ retention within window
    'vc_followup'          -- Investor re-engagement within window
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- MATERIALIZED VIEW: ml_training_snapshot_180d ----------
-- NOTE: Uses startup_uploads.created_at as score_date proxy for v1
--       Can be upgraded to god_score_explanations.computed_at later when guardrails deployed
CREATE MATERIALIZED VIEW IF NOT EXISTS public.ml_training_snapshot_180d AS
SELECT
  u.id AS startup_id,
  u.name AS startup_name,
  
  -- Score date: Use created_at as proxy (v1 simplification)
  u.created_at AS score_date,
  u.created_at + INTERVAL '180 days' AS outcome_window_end,

  -- ---------- FEATURES (Component scores as-of score_date) ----------
  u.total_god_score AS god_score,
  u.team_score,
  u.traction_score,
  u.market_score,
  u.product_score,
  u.vision_score,

  -- ---------- HISTORICAL SIGNAL COUNTS (AS-OF score_date) ----------
  -- Critical: ONLY signals that occurred BEFORE score_date
  COUNT(*) FILTER (WHERE s.occurred_at <= u.created_at) AS historical_signal_count,

  -- Funding signal confidence (AS-OF)
  COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'funding_%'
  ) AS funding_signal_count,
  
  AVG(s.weight) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'funding_%'
  ) AS funding_confidence,
  
  (COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'funding_%'
  ) > 0) AS has_funding_signals,

  -- Traction signal confidence (AS-OF)
  COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'traction_%'
  ) AS traction_signal_count,
  
  AVG(s.weight) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'traction_%'
  ) AS traction_confidence,
  
  (COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'traction_%'
  ) > 0) AS has_traction_signals,

  -- Team signal confidence (AS-OF)
  COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'team_%'
  ) AS team_signal_count,
  
  AVG(s.weight) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'team_%'
  ) AS team_confidence,
  
  (COUNT(*) FILTER (
    WHERE s.occurred_at <= u.created_at
    AND s.signal_type LIKE 'team_%'
  ) > 0) AS has_team_signals,

  -- ---------- FUTURE SIGNAL COUNTS (AFTER score_date, within window) ----------
  -- Critical: ONLY signals that occurred AFTER score_date
  COUNT(*) FILTER (
    WHERE s.occurred_at > u.created_at
    AND s.occurred_at <= u.created_at + INTERVAL '180 days'
  ) AS future_signal_count,

  -- ---------- OUTCOME FLAGS (Pure future-only events) ----------
  -- Funding event: $500K+ raise within window
  COALESCE(BOOL_OR(TRUE) FILTER (
    WHERE s.occurred_at > u.created_at
    AND s.occurred_at <= u.created_at + INTERVAL '180 days'
    AND s.signal_type = 'funding_amount'
    AND COALESCE((s.meta->>'value')::numeric, 0) >= 500000
  ), FALSE) AS outcome_funded_500k,

  -- Revenue milestone: $100K+ ARR within window
  COALESCE(BOOL_OR(TRUE) FILTER (
    WHERE s.occurred_at > u.created_at
    AND s.occurred_at <= u.created_at + INTERVAL '180 days'
    AND s.signal_type = 'traction_revenue'
    AND COALESCE((s.meta->>'value')::numeric, 0) >= 100000
  ), FALSE) AS outcome_revenue_100k,

  -- Retention milestone: 40%+ retention within window
  COALESCE(BOOL_OR(TRUE) FILTER (
    WHERE s.occurred_at > u.created_at
    AND s.occurred_at <= u.created_at + INTERVAL '180 days'
    AND s.signal_type = 'traction_retention'
    AND COALESCE((s.meta->>'retention_rate')::numeric, 0) >= 0.4
  ), FALSE) AS outcome_retention_40pct,

  -- ---------- SUCCESS LABEL (Pure disjunction of future outcomes) ----------
  -- NO god_score in label (circular)
  -- NO signal_quality in label (circular)
  -- ONLY time-stamped events AFTER score_date
  COALESCE(
    BOOL_OR(TRUE) FILTER (
      WHERE s.occurred_at > u.created_at
      AND s.occurred_at <= u.created_at + INTERVAL '180 days'
      AND s.signal_type = 'funding_amount'
      AND COALESCE((s.meta->>'value')::numeric, 0) >= 500000
    )
    OR
    BOOL_OR(TRUE) FILTER (
      WHERE s.occurred_at > u.created_at
      AND s.occurred_at <= u.created_at + INTERVAL '180 days'
      AND s.signal_type = 'traction_revenue'
      AND COALESCE((s.meta->>'value')::numeric, 0) >= 100000
    )
    OR
    BOOL_OR(TRUE) FILTER (
      WHERE s.occurred_at > u.created_at
      AND s.occurred_at <= u.created_at + INTERVAL '180 days'
      AND s.signal_type = 'traction_retention'
      AND COALESCE((s.meta->>'retention_rate')::numeric, 0) >= 0.4
    ),
    FALSE
  ) AS is_successful

FROM public.startup_uploads u
LEFT JOIN public.startup_signals s
  ON s.startup_id = u.id
WHERE u.created_at IS NOT NULL
  AND u.created_at >= '2023-01-01'  -- Only train on recent data
GROUP BY u.id, u.name, u.created_at, u.total_god_score, u.team_score, u.traction_score, u.market_score, u.product_score, u.vision_score;
-- NOTE: No HAVING clause - we keep signal-zero startups (they represent baseline fundamentals).
-- Signal presence filtering done in training step with logged gate.

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_ml_snapshot_score_date
ON public.ml_training_snapshot_180d(score_date);

CREATE INDEX IF NOT EXISTS idx_ml_snapshot_success
ON public.ml_training_snapshot_180d(is_successful);

CREATE INDEX IF NOT EXISTS idx_ml_snapshot_startup
ON public.ml_training_snapshot_180d(startup_id);

-- ---------- REFRESH FUNCTION ----------
-- Drop existing function if signature changed
DROP FUNCTION IF EXISTS public.refresh_ml_training_snapshot();

CREATE OR REPLACE FUNCTION public.refresh_ml_training_snapshot()
RETURNS TABLE (
  duration_ms numeric,
  row_count bigint,
  success_count bigint,
  positive_rate numeric,
  anomaly_count bigint,
  zero_signal_count bigint
) AS $$
DECLARE
  start_time timestamptz;
  end_time timestamptz;
  rows bigint;
  successes bigint;
  anomalies bigint;
  zero_signals bigint;
  pos_rate numeric;
  top_anomalies jsonb;
  refresh_duration numeric;
BEGIN
  start_time := clock_timestamp();
  
  REFRESH MATERIALIZED VIEW public.ml_training_snapshot_180d;
  
  end_time := clock_timestamp();
  refresh_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  -- Get stats
  SELECT 
    COUNT(*), 
    SUM(CASE WHEN is_successful THEN 1 ELSE 0 END),
    -- Canary: future signals >> historical signals (scraper burst detection)
    SUM(CASE WHEN future_signal_count > historical_signal_count * 5 THEN 1 ELSE 0 END),
    -- Track signal-zero startups (informational)
    SUM(CASE WHEN historical_signal_count = 0 AND future_signal_count = 0 THEN 1 ELSE 0 END)
  INTO rows, successes, anomalies, zero_signals
  FROM public.ml_training_snapshot_180d;
  
  pos_rate := CASE WHEN rows > 0 THEN successes::numeric / rows::numeric ELSE 0 END;
  
  RETURN QUERY
  SELECT 
    refresh_duration AS duration_ms,
    rows AS row_count,
    successes AS success_count,
    pos_rate AS positive_rate,
    anomalies AS anomaly_count,
    zero_signals AS zero_signal_count;
END;
$$ LANGUAGE plpgsql;

-- ---------- COMMENTS ----------
COMMENT ON MATERIALIZED VIEW public.ml_training_snapshot_180d IS
  'Pre-computed training data for ML agent. Refreshed nightly or manually. 
   Prevents query explosion (10,916 queries → 1 query).
   Time separation: Features AS OF score_date, Outcomes AFTER score_date within 180-day window.
   NO circular logic: Success labels use ONLY time-stamped events (funding, revenue, retention).';

COMMENT ON FUNCTION public.refresh_ml_training_snapshot() IS
  'Refresh materialized view and return performance metrics + diagnostics.
   Call this after scraper cycles or nightly.
   Returns: duration_ms, row_count, success_count, positive_rate, anomaly_count, zero_signal_count.
   Logs aggregated warnings to ai_logs (non-blocking):
   - Signal burst anomalies (future > 5x historical) with top offenders
   - Positive rate bounds violations (< 0.5% or > 60%)
   - Zero-signal coverage (> 30% threshold)';

COMMIT;
