-- Product agent: opportunity backlog sync + run log

CREATE TABLE IF NOT EXISTS public.product_opportunities (
  opportunity_id text PRIMARY KEY,
  domain text NOT NULL,
  priority text NOT NULL DEFAULT 'P2',
  status text NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea', 'validating', 'building', 'shipped', 'killed')),
  title text NOT NULL,
  problem text,
  hypothesis text,
  metric text,
  baseline numeric,
  target text,
  next_step text,
  related_experiments jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_agent_runs (
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

CREATE INDEX IF NOT EXISTS idx_product_opportunities_status
  ON public.product_opportunities (status, priority);

ALTER TABLE public.product_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_opportunities_service ON public.product_opportunities;
CREATE POLICY product_opportunities_service ON public.product_opportunities
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS product_agent_runs_service ON public.product_agent_runs;
CREATE POLICY product_agent_runs_service ON public.product_agent_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.product_opportunities TO service_role;
GRANT ALL ON public.product_agent_runs TO service_role;
