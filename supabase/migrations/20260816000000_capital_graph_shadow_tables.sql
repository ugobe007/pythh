-- Shadow capture tables for capital graph experiment tracking.
-- Used by server/lib/capitalGraphShadow.js when CAPITAL_GRAPH_SHADOW_ENABLED=true.

CREATE TABLE IF NOT EXISTS public.match_outcomes (
  id bigserial PRIMARY KEY,
  investor_id integer NOT NULL,
  outcome_type varchar(32) NOT NULL CHECK (outcome_type IN (
    'explanation_opened', 'saved', 'outreach_sent', 'email_bounced',
    'replied', 'meeting_booked', 'passed', 'diligence', 'term_sheet', 'funded'
  )),
  verified boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_outcomes_investor_verified
  ON public.match_outcomes(investor_id, verified, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.match_feature_snapshots (
  id bigserial PRIMARY KEY,
  startup_id integer NOT NULL,
  investor_id integer NOT NULL,
  model_version varchar(64) NOT NULL,
  feature_schema_version varchar(64) NOT NULL,
  semantic_score numeric(5, 2),
  graph_score numeric(5, 2),
  final_score numeric(5, 2),
  feature_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_feature_snapshots_startup
  ON public.match_feature_snapshots(startup_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_feature_snapshots_investor
  ON public.match_feature_snapshots(investor_id, computed_at DESC);

CREATE TABLE IF NOT EXISTS public.ranking_impressions (
  id bigserial PRIMARY KEY,
  startup_id integer NOT NULL,
  investor_id integer NOT NULL,
  session_id uuid NOT NULL,
  model_version varchar(64) NOT NULL,
  rank_position integer NOT NULL,
  selection_probability numeric(5, 4) NOT NULL DEFAULT 1,
  score numeric(5, 4),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  shown_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ranking_impressions_session
  ON public.ranking_impressions(session_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_ranking_impressions_startup
  ON public.ranking_impressions(startup_id, shown_at DESC);

ALTER TABLE public.match_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_feature_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_impressions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.match_outcomes FROM anon, authenticated;
REVOKE ALL ON TABLE public.match_feature_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE public.ranking_impressions FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.match_outcomes_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.match_feature_snapshots_id_seq FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.ranking_impressions_id_seq FROM anon, authenticated;
