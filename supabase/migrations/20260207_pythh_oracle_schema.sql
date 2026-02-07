-- ============================================================================
-- PYTHH ORACLE: Wizard + Cohort + Signal Coaching System
-- Applied: 2026-02-07
-- ============================================================================

-- 1. Oracle Sessions: tracks a founder's wizard journey
CREATE TABLE IF NOT EXISTS public.oracle_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  current_step int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  total_steps int NOT NULL DEFAULT 6,
  summary jsonb DEFAULT '{}',
  UNIQUE (startup_id, status)
);

-- 2. Oracle Steps: each wizard step's data
CREATE TABLE IF NOT EXISTS public.oracle_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.oracle_sessions(id) ON DELETE CASCADE,
  step_number int NOT NULL CHECK (step_number BETWEEN 1 AND 6),
  step_key text NOT NULL CHECK (step_key IN (
    'deck_review', 'value_proposition', 'fundraising_strategy',
    'investor_alignment', 'support_materials', 'signal_boost'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  responses jsonb DEFAULT '{}',
  recommendations jsonb DEFAULT '[]',
  signal_before numeric(4,1),
  signal_after numeric(4,1),
  UNIQUE (session_id, step_number)
);

-- 3. Cohorts
CREATE TABLE IF NOT EXISTS public.oracle_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  stage text NOT NULL CHECK (stage IN ('pre-seed', 'seed', 'series-a', 'series-b', 'growth')),
  sector text,
  max_members int NOT NULL DEFAULT 8,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'active', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  cohort_week int NOT NULL DEFAULT 1,
  total_weeks int NOT NULL DEFAULT 6,
  metadata jsonb DEFAULT '{}'
);

-- 4. Cohort Members
CREATE TABLE IF NOT EXISTS public.oracle_cohort_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.oracle_cohorts(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'lead', 'mentor')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  signal_at_join numeric(4,1),
  signal_current numeric(4,1),
  progress_pct int DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  UNIQUE (cohort_id, startup_id)
);

-- 5. Signal Actions
CREATE TABLE IF NOT EXISTS public.oracle_signal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.oracle_sessions(id),
  action_type text NOT NULL CHECK (action_type IN (
    'deck_fix', 'narrative_rewrite', 'metrics_update',
    'investor_targeting', 'outreach_template', 'pitch_practice',
    'social_proof', 'traction_highlight', 'market_sizing',
    'team_story', 'competitive_positioning', 'ask_clarity'
  )),
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  signal_dimension text CHECK (signal_dimension IN (
    'founder_language_shift', 'investor_receptivity',
    'news_momentum', 'capital_convergence', 'execution_velocity'
  )),
  estimated_signal_lift numeric(3,1) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
  due_date date,
  completed_at timestamptz,
  evidence jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Oracle Insights
CREATE TABLE IF NOT EXISTS public.oracle_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  insight_type text NOT NULL CHECK (insight_type IN (
    'strength', 'gap', 'opportunity', 'risk', 'milestone', 'comparison'
  )),
  dimension text CHECK (dimension IN (
    'deck', 'value_prop', 'strategy', 'signals', 'market', 'team', 'traction'
  )),
  title text NOT NULL,
  body text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info', 'positive')),
  data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
