-- ============================================================================
-- ML Recommendations Table - Safe Output Contract
-- ============================================================================
-- Purpose: Store ML agent recommendations with approval workflow
-- CRITICAL: ML agent can ONLY modify componentWeights (NOT signals)
-- 
-- Enforcement:
-- - recommendation_type discriminates what's being changed
-- - current_weights + recommended_weights MUST preserve signals_contract
-- - Draft god_weight_versions created, NOT active versions
-- - Golden tests run BEFORE admin sees recommendation
-- - Manual approval required (no auto-apply)
-- ============================================================================

BEGIN;

-- Drop existing table if schema changed (idempotent migration)
DROP TABLE IF EXISTS public.ml_recommendations CASCADE;

-- ---------- TABLE: ml_recommendations ----------
CREATE TABLE public.ml_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to draft weight version (immutable)
  -- NOTE: Foreign key removed - validated in application layer (god_weight_versions may not exist yet)
  weights_version text NOT NULL,
  source_weights_version text NOT NULL,  -- Version ML agent started from
  
  -- What is being recommended (ONLY component_weight_adjustment allowed v1)
  recommendation_type text NOT NULL CHECK (
    recommendation_type IN ('component_weight_adjustment')
    -- NEVER: 'signal_weight_adjustment' (signals are separate SSOT)
  ),
  
  -- Weights BEFORE/AFTER (full blobs for audit)
  current_weights jsonb NOT NULL,
  recommended_weights jsonb NOT NULL,
  
  -- ML CANNOT touch signals (enforced via CHECK constraint)
  CONSTRAINT ml_cannot_touch_signals CHECK (
    -- Signals contract must be preserved
    (current_weights->'signalMaxPoints')::text = (recommended_weights->'signalMaxPoints')::text
    AND (current_weights->'signals_contract_version')::text = (recommended_weights->'signals_contract_version')::text
  ),
  
  -- ML analysis results
  confidence numeric NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning text[] NOT NULL,
  expected_improvement numeric NOT NULL CHECK (expected_improvement >= 0.02),  -- 2% floor
  
  -- Sample size validation (from gate check)
  sample_success_count int NOT NULL,
  sample_fail_count int NOT NULL,
  sample_positive_rate numeric NOT NULL,
  cross_time_stable boolean NOT NULL,
  
  -- Golden test results (run BEFORE admin sees it)
  golden_tests_passed boolean NOT NULL DEFAULT false,
  golden_tests_output jsonb DEFAULT '{}'::jsonb,
  
  -- Approval workflow
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'expired')
  ),
  requires_manual_approval boolean NOT NULL DEFAULT true,
  
  -- Audit trail
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_status 
ON public.ml_recommendations(status) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ml_recommendations_created 
ON public.ml_recommendations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_recommendations_version 
ON public.ml_recommendations(weights_version);

-- ---------- AUTO-EXPIRE OLD RECOMMENDATIONS ----------
-- Recommendations older than 7 days auto-expire
CREATE OR REPLACE FUNCTION public.expire_old_ml_recommendations()
RETURNS void AS $$
BEGIN
  UPDATE public.ml_recommendations
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ---------- COMMENTS ----------
COMMENT ON TABLE public.ml_recommendations IS
  'ML agent weight recommendations requiring admin approval.
   CRITICAL: ML can ONLY modify componentWeights (NOT signals).
   Tied to draft god_weight_versions (immutable, not active).
   Golden tests run before admin review.
   Manual approval creates new active_weights_version.';

COMMENT ON COLUMN public.ml_recommendations.recommendation_type IS
  'v1: Only "component_weight_adjustment" allowed.
   NEVER "signal_weight_adjustment" - signals are separate SSOT.';

COMMENT ON COLUMN public.ml_recommendations.expected_improvement IS
  'Minimum 2% expected improvement (avoids churn).
   Enforced via CHECK constraint.';

COMMENT ON COLUMN public.ml_recommendations.golden_tests_passed IS
  'Pre-checked before admin review. If false, recommendation is flagged.
   Admin can still approve but sees warning.';

COMMENT ON COLUMN public.ml_recommendations.requires_manual_approval IS
  'Always true for v1. Future: auto-apply if confidence >= 0.8 and tests pass.';

COMMENT ON CONSTRAINT ml_cannot_touch_signals ON public.ml_recommendations IS
  'CRITICAL INVARIANT: ML agent cannot modify signal weights.
   signalMaxPoints and signals_contract_version must be identical before/after.
   This is enforced at DB level to prevent accidental violations.';

COMMIT;
