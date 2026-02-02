-- ============================================================================
-- ML Gate Check RPC - Deterministic Sample Size + Stability Gates
-- ============================================================================
-- Purpose: Validate training data BEFORE ML agent generates recommendations
-- Prevents: Recommendations based on insufficient data or unstable patterns
-- 
-- Gates enforced:
-- 1. success_count >= 200
-- 2. fail_count >= 200
-- 3. positive_rate BETWEEN 0.02 AND 0.50
-- 4. Cross-time stability (component deltas agree in sign across ≥75% of buckets)
-- 
-- Returns: JSON payload with pass/fail + diagnostic info
-- ============================================================================

BEGIN;

-- Drop existing function to allow signature changes
DROP FUNCTION IF EXISTS public.ml_gate_check(text);

-- ---------- RPC: ml_gate_check ----------
CREATE OR REPLACE FUNCTION public.ml_gate_check(
  p_window text DEFAULT '180d'  -- Future: support multiple windows (renamed to avoid reserved keyword)
)
RETURNS jsonb AS $$
DECLARE
  v_total_count bigint;
  v_success_count bigint;
  v_fail_count bigint;
  v_positive_rate numeric;
  
  min_success constant int := 200;
  min_fail constant int := 200;
  min_pos_rate constant numeric := 0.02;
  max_pos_rate constant numeric := 0.50;
  min_buckets constant int := 2;  -- Relaxed from 4 for early-stage platform (tighten when 2+ years of data)
  
  v_buckets jsonb;
  v_bucket_count int;
  v_stability_passed boolean;
  
  result jsonb;
BEGIN
  -- ---------- GATE 1-3: Sample size checks ----------
  SELECT 
    COUNT(*),
    SUM(CASE WHEN is_successful THEN 1 ELSE 0 END),
    SUM(CASE WHEN NOT is_successful THEN 1 ELSE 0 END)
  INTO v_total_count, v_success_count, v_fail_count
  FROM public.ml_training_snapshot_180d;
  
  v_positive_rate := CASE 
    WHEN v_total_count > 0 THEN v_success_count::numeric / v_total_count::numeric 
    ELSE 0 
  END;
  
  -- ---------- GATE 4: Cross-time stability ----------
  -- Split into 6-month buckets, check component score deltas
  WITH time_buckets AS (
    SELECT
      TO_CHAR(score_date, 'YYYY"H"') || 
      CASE WHEN EXTRACT(MONTH FROM score_date) <= 6 THEN '1' ELSE '2' END AS bucket,
      
      -- Success vs fail component averages
      AVG(team_score) FILTER (WHERE is_successful) AS success_team,
      AVG(team_score) FILTER (WHERE NOT is_successful) AS fail_team,
      AVG(traction_score) FILTER (WHERE is_successful) AS success_traction,
      AVG(traction_score) FILTER (WHERE NOT is_successful) AS fail_traction,
      AVG(market_score) FILTER (WHERE is_successful) AS success_market,
      AVG(market_score) FILTER (WHERE NOT is_successful) AS fail_market,
      
      COUNT(*) AS sample_count,
      SUM(CASE WHEN is_successful THEN 1 ELSE 0 END) AS success_cnt
    FROM public.ml_training_snapshot_180d
    GROUP BY bucket
    HAVING COUNT(*) >= 20  -- Minimum samples per bucket
  ),
  bucket_deltas AS (
    SELECT
      bucket,
      sample_count,
      success_cnt,
      -- Component deltas (success - fail)
      success_team - fail_team AS team_delta,
      success_traction - fail_traction AS traction_delta,
      success_market - fail_market AS market_delta
    FROM time_buckets
  ),
  sign_consistency AS (
    -- Check if deltas have consistent sign across buckets
    SELECT
      -- Team: if ≥75% of buckets have same sign, stable
      (SUM(CASE WHEN team_delta > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75
       OR SUM(CASE WHEN team_delta < 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75) AS team_stable,
      
      -- Traction: if ≥75% of buckets have same sign, stable
      (SUM(CASE WHEN traction_delta > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75
       OR SUM(CASE WHEN traction_delta < 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75) AS traction_stable,
      
      -- Market: if ≥75% of buckets have same sign, stable
      (SUM(CASE WHEN market_delta > 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75
       OR SUM(CASE WHEN market_delta < 0 THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)::numeric >= 0.75) AS market_stable,
      
      COUNT(*) AS num_buckets
    FROM bucket_deltas
  )
  SELECT 
    jsonb_agg(jsonb_build_object(
      'bucket', bucket,
      'sample_count', sample_count,
      'success_count', success_cnt,
      'team_delta', ROUND(team_delta, 2),
      'traction_delta', ROUND(traction_delta, 2),
      'market_delta', ROUND(market_delta, 2)
    ) ORDER BY bucket),
    (SELECT team_stable AND traction_stable AND market_stable FROM sign_consistency),
    (SELECT num_buckets FROM sign_consistency)
  INTO v_buckets, v_stability_passed, v_bucket_count
  FROM bucket_deltas;
  
  -- Require minimum buckets (relaxed to 2 for early-stage)
  IF v_bucket_count IS NULL OR v_bucket_count < min_buckets THEN
    v_stability_passed := FALSE;
  END IF;
  
  -- ---------- BUILD RESULT ----------
  result := jsonb_build_object(
    'passed', (
      v_success_count >= min_success
      AND v_fail_count >= min_fail
      AND v_positive_rate >= min_pos_rate
      AND v_positive_rate <= max_pos_rate
      AND COALESCE(v_stability_passed, FALSE)
    ),
    
    'gates', jsonb_build_object(
      'sample_size', jsonb_build_object(
        'passed', v_success_count >= min_success AND v_fail_count >= min_fail,
        'success_count', v_success_count,
        'fail_count', v_fail_count,
        'required_success', min_success,
        'required_fail', min_fail
      ),
      
      'positive_rate', jsonb_build_object(
        'passed', v_positive_rate >= min_pos_rate AND v_positive_rate <= max_pos_rate,
        'value', ROUND(v_positive_rate, 4),
        'min', min_pos_rate,
        'max', max_pos_rate
      ),
      
      'cross_time_stability', jsonb_build_object(
        'passed', COALESCE(v_stability_passed, FALSE),
        'bucket_count', COALESCE(v_bucket_count, 0),
        'required_buckets', min_buckets,
        'buckets', COALESCE(v_buckets, '[]'::jsonb)
      )
    ),
    
    'summary', jsonb_build_object(
      'total_samples', v_total_count,
      'success_samples', v_success_count,
      'fail_samples', v_fail_count,
      'positive_rate', ROUND(v_positive_rate, 4)
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ---------- COMMENTS ----------
COMMENT ON FUNCTION public.ml_gate_check(text) IS
  'Deterministic gate check for ML training data.
   Parameters: p_window (default: 180d)
   Gates:
   1. success_count >= 200
   2. fail_count >= 200
   3. positive_rate BETWEEN 0.02 AND 0.50
   4. Cross-time stability (component deltas consistent across ≥75% of 6-month buckets, min 2 buckets)
   
   Returns: JSON with pass/fail + diagnostic info.
   Call this BEFORE ml agent generates recommendations.
   
   NOTE: min_buckets relaxed to 2 for early-stage platform. Tighten to 4 when 2+ years of data accumulated.';

COMMIT;
