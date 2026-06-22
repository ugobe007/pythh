-- Research sub-agent: market findings + run log

CREATE TABLE IF NOT EXISTS public.research_findings (
  finding_id text PRIMARY KEY,
  signal_type text NOT NULL DEFAULT 'market',
  friction_category text,
  audience text NOT NULL DEFAULT 'both',
  title text NOT NULL,
  problem text,
  opportunity text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'validated', 'handed_off', 'archived')),
  handoff jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.research_agent_runs (
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

CREATE INDEX IF NOT EXISTS idx_research_findings_status
  ON public.research_findings (status, confidence);

ALTER TABLE public.research_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_findings_service ON public.research_findings;
CREATE POLICY research_findings_service ON public.research_findings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS research_agent_runs_service ON public.research_agent_runs;
CREATE POLICY research_agent_runs_service ON public.research_agent_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.research_findings TO service_role;
GRANT ALL ON public.research_agent_runs TO service_role;
