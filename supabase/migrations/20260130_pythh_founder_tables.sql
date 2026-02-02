-- ============================================================================
-- Pythh Founder Tables - Add-Only Migration
-- ============================================================================
-- Purpose: Support the founder-facing Pythh UI with clean SSOT layers
-- 
-- Tables added:
--   1. investor_unlocks      - Tracks which identities founders have unlocked
--   2. signal_events         - Raw market evidence (SSOT layer 1)
--   3. startup_signal_scores - Cached 0-10 signal scores (SSOT layer 2)
--   4. startup_investor_fit  - Goldilocks fit cache per pair
--   5. startup_entitlements  - Plan/unlock limits per startup
--   6. outreach_intents      - Anti-spray tracking
--   7. unlock_ledger         - Unlock accounting
--
-- CRITICAL: UI/monetization never changes layers 1-3
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. INVESTOR UNLOCKS
-- ============================================================================
-- Tracks identity reveals. Core for locked/unlocked table state.
-- Cheap EXISTS check: SELECT EXISTS(SELECT 1 FROM investor_unlocks WHERE startup_id = X AND investor_id = Y)

CREATE TABLE IF NOT EXISTS public.investor_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlock_source text NOT NULL CHECK (unlock_source IN ('free_daily', 'purchase', 'referral', 'admin')),
  run_id uuid NULL, -- ties to match_runs for audit
  UNIQUE(startup_id, investor_id)  -- Critical: prevents double-unlock race
);

-- Primary lookup: "is this investor unlocked for this startup?"
CREATE INDEX IF NOT EXISTS idx_investor_unlocks_startup 
ON public.investor_unlocks(startup_id);

-- Secondary: unlock history per investor (analytics)
CREATE INDEX IF NOT EXISTS idx_investor_unlocks_investor 
ON public.investor_unlocks(investor_id);

-- Composite for the common query pattern
CREATE INDEX IF NOT EXISTS idx_investor_unlocks_startup_unlocked
ON public.investor_unlocks(startup_id, unlocked_at DESC);

COMMENT ON TABLE public.investor_unlocks IS 
  'Tracks which investor identities a founder has unlocked. 
   UNIQUE(startup_id, investor_id) ensures no double-unlock.';

-- ============================================================================
-- 2. SIGNAL EVENTS (Raw Market Evidence - SSOT Layer 1)
-- ============================================================================
-- This is the foundation of "market reality". Never modified by UI/monetization.
-- Each row is evidence with provenance.

CREATE TABLE IF NOT EXISTS public.signal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  
  -- What happened
  event_type text NOT NULL CHECK (event_type IN (
    'founder_language_shift',
    'investor_receptivity', 
    'news_momentum',
    'capital_convergence',
    'execution_velocity'
  )),
  
  -- Provenance
  source_type text NOT NULL CHECK (source_type IN ('rss', 'web', 'social', 'pdf', 'manual', 'enrichment')),
  source_url text,
  
  -- Timing
  observed_at timestamptz NOT NULL DEFAULT now(),  -- when we saw it
  occurred_at timestamptz,                          -- when it happened (if known)
  
  -- Strength
  confidence numeric(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  magnitude numeric,  -- optional intensity
  
  -- Raw evidence
  payload jsonb NOT NULL DEFAULT '{}'::jsonb  -- excerpt + metadata
);

CREATE INDEX IF NOT EXISTS idx_signal_events_startup_occurred 
ON public.signal_events(startup_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_events_type_occurred 
ON public.signal_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_events_observed 
ON public.signal_events(observed_at DESC);

COMMENT ON TABLE public.signal_events IS 
  'Raw market evidence with provenance. SSOT Layer 1.
   Never modified by UI/monetization logic.';

-- ============================================================================
-- 3. STARTUP SIGNAL SCORES (Cached Scores - SSOT Layer 2)
-- ============================================================================
-- Precomputed 0-10 signal score per startup. What the UI reads.
-- Recalculated by backend, never by frontend.

CREATE TABLE IF NOT EXISTS public.startup_signal_scores (
  startup_id uuid PRIMARY KEY REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  as_of timestamptz NOT NULL DEFAULT now(),
  
  -- Total (the candy)
  signals_total numeric(4,1) NOT NULL CHECK (signals_total >= 0 AND signals_total <= 10),
  
  -- Dimension subscores (each capped per weights)
  founder_language_shift numeric(4,1) NOT NULL DEFAULT 0 CHECK (founder_language_shift >= 0 AND founder_language_shift <= 2.0),
  investor_receptivity numeric(4,1) NOT NULL DEFAULT 0 CHECK (investor_receptivity >= 0 AND investor_receptivity <= 2.5),
  news_momentum numeric(4,1) NOT NULL DEFAULT 0 CHECK (news_momentum >= 0 AND news_momentum <= 1.5),
  capital_convergence numeric(4,1) NOT NULL DEFAULT 0 CHECK (capital_convergence >= 0 AND capital_convergence <= 2.0),
  execution_velocity numeric(4,1) NOT NULL DEFAULT 0 CHECK (execution_velocity >= 0 AND execution_velocity <= 2.0),
  
  -- Debug info (top contributors, decay applied)
  debug jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_startup_signal_scores_as_of 
ON public.startup_signal_scores(as_of DESC);

COMMENT ON TABLE public.startup_signal_scores IS 
  'Cached signal scores (0-10) per startup. SSOT Layer 2.
   Weights: founder_language=0.20(max 2.0), investor_receptivity=0.25(max 2.5), 
   news=0.15(max 1.5), capital=0.20(max 2.0), velocity=0.20(max 2.0).
   Total cap = 10.0';

-- ============================================================================
-- 4. STARTUP INVESTOR FIT (Goldilocks Cache)
-- ============================================================================
-- Cached fit bucket per startup-investor pair.
-- Prevents computing fit on every request across millions of rows.

CREATE TABLE IF NOT EXISTS public.startup_investor_fit (
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  
  -- The bucket (what UI shows)
  fit_bucket text NOT NULL CHECK (fit_bucket IN ('early', 'good', 'high')),
  
  -- Optional underlying score for debugging/transitions
  fit_score numeric(5,2),
  
  -- Transition tracking (prevents thrash)
  last_bucket text,
  last_changed_at timestamptz,
  
  as_of timestamptz NOT NULL DEFAULT now(),
  
  PRIMARY KEY(startup_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_startup_investor_fit_startup_bucket 
ON public.startup_investor_fit(startup_id, fit_bucket);

CREATE INDEX IF NOT EXISTS idx_startup_investor_fit_as_of 
ON public.startup_investor_fit(as_of DESC);

COMMENT ON TABLE public.startup_investor_fit IS 
  'Goldilocks fit cache per startup-investor pair.
   Bucket = timing, not quality. Transition requires threshold + persistence.';

-- ============================================================================
-- 5. STARTUP ENTITLEMENTS (Plan/Unlock Limits)
-- ============================================================================
-- Capabilities, not "upgrade marketing". Clean accounting.
-- ALL fields NOT NULL with sensible defaults to prevent NULL bugs

CREATE TABLE IF NOT EXISTS public.startup_entitlements (
  startup_id uuid PRIMARY KEY REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  
  -- Plan (capabilities)
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  
  -- Limits (all NOT NULL with defaults)
  daily_unlock_limit int NOT NULL DEFAULT 3,
  blurred_rows_limit int NOT NULL DEFAULT 50,  -- how many locked rows to show
  export_enabled boolean NOT NULL DEFAULT false,
  
  -- Daily reset tracking (NOT NULL prevents race bugs)
  unlocks_used_today int NOT NULL DEFAULT 0,
  last_reset_at timestamptz NOT NULL DEFAULT now(),
  
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for plan-based queries (admin analytics)
CREATE INDEX IF NOT EXISTS idx_startup_entitlements_plan
ON public.startup_entitlements(plan);

COMMENT ON TABLE public.startup_entitlements IS 
  'Founder capabilities by plan. Not "premium pitch" language.
   daily_unlock_limit enforced via unlock_ledger.';

-- ============================================================================
-- 6. OUTREACH INTENTS (Anti-Spray Tracking)
-- ============================================================================
-- Tracks founder intent to contact. Enables guardrails without punishment.

CREATE TABLE IF NOT EXISTS public.outreach_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  
  -- Status
  status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'drafted', 'sent', 'replied')),
  
  -- Channel
  channel text CHECK (channel IN ('email', 'warm_intro', 'linkedin', 'other')),
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(startup_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_outreach_intents_startup_status 
ON public.outreach_intents(startup_id, status);

COMMENT ON TABLE public.outreach_intents IS 
  'Anti-spray tracking. Enables rate limits without punishment.
   Copy: "Pythh throttles outreach to protect deliverability and signal quality."';

-- ============================================================================
-- 7. UNLOCK LEDGER (Accounting)
-- ============================================================================
-- Clean accounting for unlocks. Enables "leash mode" and audit.

CREATE TABLE IF NOT EXISTS public.unlock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  
  -- Transaction
  delta int NOT NULL,  -- +10 purchased, -1 used
  reason text NOT NULL CHECK (reason IN ('daily_grant', 'purchase', 'refund', 'used', 'admin')),
  
  -- Balance snapshot (for debugging)
  balance_after int,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unlock_ledger_startup_created 
ON public.unlock_ledger(startup_id, created_at DESC);

COMMENT ON TABLE public.unlock_ledger IS 
  'Unlock accounting. delta: +N for grants/purchases, -1 for usage.
   Enables clean "You have 2 unlocks left today" UI.';

-- ============================================================================
-- INITIALIZE ENTITLEMENTS FOR EXISTING STARTUPS
-- ============================================================================
-- Create default entitlements for existing approved startups

INSERT INTO public.startup_entitlements (startup_id, plan, daily_unlock_limit, blurred_rows_limit)
SELECT id, 'free', 3, 50
FROM public.startup_uploads
WHERE status = 'approved'
ON CONFLICT (startup_id) DO NOTHING;

-- ============================================================================
-- CRITICAL INDEX: Match table query optimization
-- ============================================================================
-- This index is REQUIRED for get_live_match_table to not scan 4.1M rows
-- Pattern: WHERE startup_id = X AND match_score >= 50 ORDER BY match_score DESC LIMIT N

CREATE INDEX IF NOT EXISTS idx_sims_startup_score_desc
ON public.startup_investor_matches (startup_id, match_score DESC);

COMMIT;
