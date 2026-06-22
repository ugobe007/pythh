-- Growth experiments: A/B variants for founder/investor signup + agent run log

CREATE TABLE IF NOT EXISTS public.growth_experiments (
  experiment_id text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('founder', 'investor')),
  name text NOT NULL,
  variant_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'paused', 'winner', 'archived')),
  traffic_pct numeric NOT NULL DEFAULT 0 CHECK (traffic_pct >= 0 AND traffic_pct <= 100),
  schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  hypothesis text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (experiment_id, variant_key)
);

CREATE TABLE IF NOT EXISTS public.growth_experiment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  variant_key text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('founder', 'investor')),
  anon_id text,
  session_id text,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_events_experiment
  ON public.growth_experiment_events (experiment_id, variant_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_events_name_time
  ON public.growth_experiment_events (event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS public.growth_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  status text NOT NULL,
  prompt_excerpt text,
  result jsonb,
  cost_usd numeric,
  num_turns integer,
  report_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.growth_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_experiment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS growth_experiments_public_read ON public.growth_experiments;
CREATE POLICY growth_experiments_public_read ON public.growth_experiments
  FOR SELECT TO anon, authenticated USING (status IN ('running', 'winner'));

DROP POLICY IF EXISTS growth_events_insert ON public.growth_experiment_events;
CREATE POLICY growth_events_insert ON public.growth_experiment_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS growth_events_service ON public.growth_experiment_events;
CREATE POLICY growth_events_service ON public.growth_experiment_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS growth_experiments_service ON public.growth_experiments;
CREATE POLICY growth_experiments_service ON public.growth_experiments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS growth_agent_runs_service ON public.growth_agent_runs;
CREATE POLICY growth_agent_runs_service ON public.growth_agent_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.growth_experiments TO anon, authenticated;
GRANT INSERT ON public.growth_experiment_events TO anon, authenticated;
GRANT ALL ON public.growth_experiments TO service_role;
GRANT ALL ON public.growth_experiment_events TO service_role;
GRANT ALL ON public.growth_agent_runs TO service_role;
