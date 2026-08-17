-- Funding evidence and prediction ledger.
-- Additive, service-role only, and shadow-only: it does not affect live ranking.

CREATE TABLE IF NOT EXISTS public.funding_evidence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id UUID REFERENCES public.startup_events(id) ON DELETE SET NULL,
  source_event_key TEXT NOT NULL,
  startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE SET NULL,
  startup_name_raw TEXT NOT NULL,
  financing_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (financing_type IN ('equity', 'debt', 'grant', 'mixed', 'unknown')),
  round_type TEXT,
  amount_usd BIGINT,
  announced_at TIMESTAMPTZ NOT NULL,
  occurred_at TIMESTAMPTZ,
  occurred_at_precision TEXT NOT NULL DEFAULT 'announcement_proxy'
    CHECK (occurred_at_precision IN ('exact', 'day', 'month', 'announcement_proxy', 'unknown')),
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT NOT NULL,
  source_publisher TEXT,
  source_title TEXT,
  evidence_confidence NUMERIC(5,4) NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 1),
  verification_status TEXT NOT NULL DEFAULT 'observed'
    CHECK (verification_status IN ('observed', 'corroborated', 'verified', 'rejected')),
  extraction_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_event_key)
);

CREATE TABLE IF NOT EXISTS public.funding_evidence_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_event_id UUID NOT NULL REFERENCES public.funding_evidence_events(id) ON DELETE CASCADE,
  investor_name_raw TEXT NOT NULL,
  investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  participant_role TEXT NOT NULL DEFAULT 'participant'
    CHECK (participant_role IN ('lead', 'co_lead', 'participant', 'existing_investor', 'unknown')),
  resolution_status TEXT NOT NULL DEFAULT 'unresolved'
    CHECK (resolution_status IN ('resolved', 'ambiguous', 'unresolved', 'not_in_universe')),
  resolution_confidence NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (resolution_confidence BETWEEN 0 AND 1),
  evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funding_event_id, investor_name_raw)
);

CREATE TABLE IF NOT EXISTS public.funding_prediction_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_event_id UUID NOT NULL REFERENCES public.funding_evidence_events(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  startup_id UUID NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  impression_id UUID REFERENCES public.ranking_impressions(id) ON DELETE SET NULL,
  model_version TEXT NOT NULL,
  rank_position INTEGER NOT NULL CHECK (rank_position > 0),
  score NUMERIC(8,6),
  predicted_probability NUMERIC(7,6) CHECK (predicted_probability IS NULL OR predicted_probability BETWEEN 0 AND 1),
  predicted_horizon_days INTEGER CHECK (predicted_horizon_days IS NULL OR predicted_horizon_days > 0),
  shown_at TIMESTAMPTZ NOT NULL,
  event_at TIMESTAMPTZ NOT NULL,
  days_to_event INTEGER NOT NULL CHECK (days_to_event >= 0),
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (30, 90, 180, 365)),
  invested BOOLEAN NOT NULL,
  participant_id UUID REFERENCES public.funding_evidence_participants(id) ON DELETE SET NULL,
  attribution_kind TEXT NOT NULL
    CHECK (attribution_kind IN ('predicted_participant', 'recommended_non_participant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funding_event_id, impression_id, horizon_days)
);

CREATE TABLE IF NOT EXISTS public.funding_prediction_misses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funding_event_id UUID NOT NULL REFERENCES public.funding_evidence_events(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.funding_evidence_participants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  model_version TEXT NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (30, 90, 180, 365)),
  reason TEXT NOT NULL CHECK (reason IN ('not_recommended', 'outside_top_k', 'unresolved_investor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (funding_event_id, participant_id, session_id, horizon_days)
);

CREATE INDEX IF NOT EXISTS idx_funding_evidence_startup_time
  ON public.funding_evidence_events(startup_id, announced_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_participants_investor
  ON public.funding_evidence_participants(investor_id, funding_event_id);
CREATE INDEX IF NOT EXISTS idx_funding_evaluations_model_horizon
  ON public.funding_prediction_evaluations(model_version, horizon_days, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_evaluations_session
  ON public.funding_prediction_evaluations(session_id, horizon_days, rank_position);

CREATE OR REPLACE VIEW public.funding_prediction_metrics AS
SELECT
  model_version,
  horizon_days,
  count(DISTINCT session_id) AS recommendation_sets,
  count(*) AS recommendations,
  count(*) FILTER (WHERE invested) AS investor_hits,
  count(*) FILTER (WHERE NOT invested) AS investor_non_hits,
  round(avg((invested)::INT)::NUMERIC, 6) AS precision,
  round(avg((invested)::INT) FILTER (WHERE rank_position <= 5)::NUMERIC, 6) AS precision_at_5,
  round(avg(power(predicted_probability - (invested)::INT, 2))
    FILTER (WHERE predicted_probability IS NOT NULL)::NUMERIC, 6) AS brier_score,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY days_to_event) FILTER (WHERE invested) AS median_days_to_investment
FROM public.funding_prediction_evaluations
GROUP BY model_version, horizon_days;

ALTER TABLE public.funding_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_evidence_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_prediction_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_prediction_misses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_evidence_events FROM anon, authenticated;
REVOKE ALL ON public.funding_evidence_participants FROM anon, authenticated;
REVOKE ALL ON public.funding_prediction_evaluations FROM anon, authenticated;
REVOKE ALL ON public.funding_prediction_misses FROM anon, authenticated;
REVOKE ALL ON public.funding_prediction_metrics FROM anon, authenticated;

COMMENT ON TABLE public.funding_evidence_events IS 'Source-backed funding announcements with separate event, announcement, and discovery timestamps.';
COMMENT ON TABLE public.funding_prediction_evaluations IS 'Shadow evaluation of recommendations made before observed funding events; never read by live ranking.';
COMMENT ON TABLE public.funding_prediction_misses IS 'Actual funding participants absent from a historical recommendation set.';
