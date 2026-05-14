-- Pythh NEW_site Drizzle tables (Postgres / Supabase).
-- Prefix pythh_* avoids collisions with other public tables.
-- Apply via Supabase migrations or SQL editor; Drizzle expects these names/columns.

CREATE TABLE IF NOT EXISTS public.pythh_users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  login_method VARCHAR(64),
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pythh_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(64) NOT NULL,
  stripe_subscription_id VARCHAR(64) NOT NULL UNIQUE,
  plan VARCHAR(32) NOT NULL DEFAULT 'oracle',
  billing_cycle VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  current_period_end BIGINT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_subscriptions_user_id ON public.pythh_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS public.pythh_investors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  firm VARCHAR(128) NOT NULL,
  role VARCHAR(64),
  sector VARCHAR(64) NOT NULL,
  sector2 VARCHAR(64),
  signal INTEGER NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  god INTEGER NOT NULL,
  vcpp INTEGER NOT NULL,
  check_size VARCHAR(32),
  stage VARCHAR(64),
  geo VARCHAR(64),
  recent_activity VARCHAR(128),
  profile_url VARCHAR(256),
  is_public INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_investors_sector ON public.pythh_investors (sector);
CREATE INDEX IF NOT EXISTS idx_pythh_investors_is_public ON public.pythh_investors (is_public);

CREATE TABLE IF NOT EXISTS public.pythh_pipeline_feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  rating VARCHAR(8) NOT NULL,
  reason VARCHAR(64),
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_pipeline_feedback_user_run ON public.pythh_pipeline_feedback (user_id, run_id);

CREATE TABLE IF NOT EXISTS public.pythh_pitch_decks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  startup_url VARCHAR(512),
  source_type VARCHAR(32) NOT NULL DEFAULT 'generated',
  file_key VARCHAR(256),
  slides_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_pitch_decks_user_run ON public.pythh_pitch_decks (user_id, run_id);

CREATE TABLE IF NOT EXISTS public.pythh_outreach_emails (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  investor_name VARCHAR(128) NOT NULL,
  investor_firm VARCHAR(128) NOT NULL,
  to_email VARCHAR(256),
  subject VARCHAR(256) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  sent_at BIGINT,
  resend_message_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_outreach_emails_user_run ON public.pythh_outreach_emails (user_id, run_id);

CREATE TABLE IF NOT EXISTS public.pythh_pipeline_runs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL UNIQUE,
  startup_url VARCHAR(512) NOT NULL,
  summary TEXT,
  matched_investors_json TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_pipeline_runs_user ON public.pythh_pipeline_runs (user_id);

CREATE TABLE IF NOT EXISTS public.pythh_meetings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  run_id VARCHAR(64) NOT NULL,
  outreach_email_id INTEGER REFERENCES public.pythh_outreach_emails (id) ON DELETE SET NULL,
  investor_name VARCHAR(128) NOT NULL,
  investor_firm VARCHAR(128) NOT NULL,
  proposed_times_json TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'proposed',
  confirmed_time BIGINT,
  calendar_link VARCHAR(512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pythh_meetings_user_run ON public.pythh_meetings (user_id, run_id);

CREATE TABLE IF NOT EXISTS public.pythh_founder_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  company_name VARCHAR(256),
  company_url VARCHAR(512),
  stage VARCHAR(64),
  sector VARCHAR(128),
  ask_amount VARCHAR(64),
  deck_file_key VARCHAR(256),
  bio TEXT,
  linkedin_url VARCHAR(512),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
