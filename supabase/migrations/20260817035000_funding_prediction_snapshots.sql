-- Prospective prediction snapshots for funding-outcome validation.
-- These records freeze model outputs; they are never read by live ranking.

CREATE TABLE IF NOT EXISTS public.funding_prediction_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key TEXT NOT NULL,
  startup_id UUID NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  source_match_id UUID REFERENCES public.startup_investor_matches(id) ON DELETE SET NULL,
  god_score_at_prediction NUMERIC(6,2) NOT NULL,
  match_score_at_prediction NUMERIC(6,2),
  rank_position INTEGER NOT NULL CHECK (rank_position BETWEEN 1 AND 5),
  model_version TEXT NOT NULL,
  predicted_at TIMESTAMPTZ NOT NULL,
  prediction_kind TEXT NOT NULL DEFAULT 'prospective_shadow'
    CHECK (prediction_kind IN ('prospective_shadow', 'served_impression')),
  context JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_key, startup_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_funding_prediction_snapshots_score_time
  ON public.funding_prediction_snapshots(god_score_at_prediction DESC, predicted_at);
CREATE INDEX IF NOT EXISTS idx_funding_prediction_snapshots_startup_time
  ON public.funding_prediction_snapshots(startup_id, predicted_at);

ALTER TABLE public.funding_prediction_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_prediction_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.funding_prediction_snapshots TO service_role;

COMMENT ON TABLE public.funding_prediction_snapshots IS
  'Immutable-intent prospective top-five match sets used to evaluate later funding events. Shadow-only; never feeds production ranking directly.';

NOTIFY pgrst, 'reload schema';
