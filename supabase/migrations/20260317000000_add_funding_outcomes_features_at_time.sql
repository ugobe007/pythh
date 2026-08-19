-- Add features_at_time to funding_outcomes for event provenance and deduplication
-- Required by enrich-from-rss-news.js for funding/exit tracking
CREATE TABLE IF NOT EXISTS public.funding_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE SET NULL,
  startup_name TEXT,
  outcome_type TEXT,
  funding_amount BIGINT,
  funding_round TEXT,
  investor_names JSONB DEFAULT '[]'::jsonb,
  outcome_date TIMESTAMPTZ,
  god_score_at_time NUMERIC,
  days_since_scored INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE funding_outcomes
  ADD COLUMN IF NOT EXISTS features_at_time JSONB;

COMMENT ON COLUMN funding_outcomes.features_at_time IS 'Event provenance: { event_id, source_url, source_title, amount_raw, stage, acquirer }';
