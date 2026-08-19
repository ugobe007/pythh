-- Resumable cursor for promoting the historical startup_events funding corpus.
-- Service-role only; this table is operational state, never a ranking feature.

CREATE TABLE IF NOT EXISTS public.funding_evidence_backfill_checkpoints (
  pipeline_key text PRIMARY KEY,
  source_max_created_at timestamptz,
  next_offset bigint NOT NULL DEFAULT 0 CHECK (next_offset >= 0),
  events_scanned bigint NOT NULL DEFAULT 0 CHECK (events_scanned >= 0),
  events_written bigint NOT NULL DEFAULT 0 CHECK (events_written >= 0),
  completed boolean NOT NULL DEFAULT false,
  last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_evidence_backfill_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_evidence_backfill_checkpoints FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.funding_evidence_backfill_checkpoints TO service_role;

INSERT INTO public.funding_evidence_backfill_checkpoints (pipeline_key)
VALUES ('startup_events_funding_history_v1')
ON CONFLICT (pipeline_key) DO NOTHING;

COMMENT ON TABLE public.funding_evidence_backfill_checkpoints IS
  'Operational cursor for bounded, resumable historical evidence promotion. Never read by live ranking.';

NOTIFY pgrst, 'reload schema';
