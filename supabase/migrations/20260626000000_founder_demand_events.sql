-- Founder demand-side inventory — one row per preview / URL submission for match engine + digest corpus.
BEGIN;

CREATE TABLE IF NOT EXISTS public.founder_demand_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'preview_requested'
    CHECK (event_type IN ('preview_requested', 'url_submitted', 'signup_completed')),
  startup_id uuid REFERENCES public.startup_uploads(id) ON DELETE SET NULL,
  startup_url text,
  startup_name text,
  sectors jsonb,
  stage text,
  god_score integer,
  match_count integer,
  source text,
  probe_run_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_founder_demand_events_created
  ON public.founder_demand_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_founder_demand_events_startup
  ON public.founder_demand_events(startup_id);

CREATE INDEX IF NOT EXISTS idx_founder_demand_events_type_created
  ON public.founder_demand_events(event_type, created_at DESC);

COMMENT ON TABLE public.founder_demand_events IS
  'Founder-side demand inventory: preview requests and URL submissions for dealflow digest + match quality.';

ALTER TABLE public.founder_demand_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'founder_demand_events' AND policyname = 'founder_demand_events_service_all'
  ) THEN
    CREATE POLICY founder_demand_events_service_all ON public.founder_demand_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMIT;
