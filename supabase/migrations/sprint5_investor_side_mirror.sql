-- ============================================================================
-- SPRINT 5: INVESTOR-SIDE MIRROR
-- ============================================================================
-- "How discovery is forming around me."
--
-- NOT a marketplace. NOT leads. NOT deals.
-- This is: Decision support + observatory
--
-- CRITICAL PRINCIPLES (LOCKED):
-- ❌ Never expose founders
-- ❌ Never allow messaging
-- ❌ Never create inboxes
-- ❌ Never create marketplaces
-- ❌ Never sell access
-- ❌ Never show scores
-- ============================================================================

-- =============================================================================
-- 1. INVESTOR DISCOVERY FLOW
-- =============================================================================
-- Anonymized view of startups entering investor's alignment orbit

CREATE TABLE IF NOT EXISTS investor_discovery_flow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Anonymized startup info (NEVER expose identity)
  startup_type_label TEXT NOT NULL,      -- "Seed-stage infra startup"
  stage TEXT NOT NULL,                   -- Pre-seed, Seed, Series A
  industry TEXT NOT NULL,                -- SaaS, AI/ML, Fintech, etc.
  geography TEXT,                        -- Optional region
  
  -- Alignment info
  alignment_state TEXT NOT NULL,         -- forming, active, strong
  signals_present TEXT[],                -- What signals brought them
  why_appeared TEXT,                     -- "matches infra screening patterns"
  
  -- Trend tracking
  trend TEXT DEFAULT 'new' CHECK (trend IN ('new', 'rising', 'stable', 'fading')),
  first_appeared_at TIMESTAMPTZ DEFAULT NOW(),
  last_signal_at TIMESTAMPTZ DEFAULT NOW(),
  signal_count INTEGER DEFAULT 1,
  
  -- Internal reference (private, never exposed to investor)
  startup_id UUID,                       -- Internal tracking only
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discovery_flow_investor ON investor_discovery_flow(investor_id);
CREATE INDEX IF NOT EXISTS idx_discovery_flow_state ON investor_discovery_flow(alignment_state);
CREATE INDEX IF NOT EXISTS idx_discovery_flow_trend ON investor_discovery_flow(trend);

-- =============================================================================
-- 2. INVESTOR SIGNAL DISTRIBUTION
-- =============================================================================
-- What signals are driving inbound

CREATE TABLE IF NOT EXISTS investor_signal_distribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Signal breakdown
  signal_type TEXT NOT NULL,             -- technical_credibility, design_partners, etc.
  signal_label TEXT NOT NULL,            -- Human-readable label
  occurrence_count INTEGER DEFAULT 0,
  percentage DECIMAL(5,2),               -- 0.00 to 100.00
  
  -- Trend
  trend_direction TEXT DEFAULT 'stable' CHECK (trend_direction IN ('up', 'down', 'stable')),
  previous_percentage DECIMAL(5,2),
  
  -- Time window
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(investor_id, signal_type, window_start)
);

CREATE INDEX IF NOT EXISTS idx_signal_dist_investor ON investor_signal_distribution(investor_id);

-- =============================================================================
-- 3. INVESTOR ENTRY PATH DISTRIBUTION
-- =============================================================================
-- How founders are entering the flow

CREATE TABLE IF NOT EXISTS investor_entry_path_distribution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Entry path breakdown
  entry_path TEXT NOT NULL,              -- operator_referral, advisor_intro, etc.
  path_label TEXT NOT NULL,              -- Human-readable label
  occurrence_count INTEGER DEFAULT 0,
  percentage DECIMAL(5,2),
  
  -- Effectiveness
  avg_alignment_quality DECIMAL(3,2),    -- 0.00 to 1.00
  conversion_rate DECIMAL(5,2),          -- % that progress from forming to active
  
  -- Time window
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(investor_id, entry_path, window_start)
);

CREATE INDEX IF NOT EXISTS idx_entry_path_investor ON investor_entry_path_distribution(investor_id);

-- =============================================================================
-- 4. INVESTOR QUALITY DRIFT
-- =============================================================================
-- Inbound quality trend over time

CREATE TABLE IF NOT EXISTS investor_quality_drift (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Quality metrics
  week_bucket DATE NOT NULL,             -- Week start date
  total_inbound INTEGER DEFAULT 0,
  
  -- Alignment state breakdown
  strong_count INTEGER DEFAULT 0,
  active_count INTEGER DEFAULT 0,
  forming_count INTEGER DEFAULT 0,
  
  -- Quality ratios
  strong_percentage DECIMAL(5,2),
  active_percentage DECIMAL(5,2),
  forming_percentage DECIMAL(5,2),
  
  -- Trend indicators
  quality_score DECIMAL(3,2),            -- Weighted score 0-1
  week_over_week_change DECIMAL(5,2),    -- % change from previous week
  trend_direction TEXT CHECK (trend_direction IN ('improving', 'stable', 'declining')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(investor_id, week_bucket)
);

CREATE INDEX IF NOT EXISTS idx_quality_drift_investor ON investor_quality_drift(investor_id);
CREATE INDEX IF NOT EXISTS idx_quality_drift_week ON investor_quality_drift(week_bucket DESC);

-- =============================================================================
-- 5. INVESTOR FEEDBACK (Light reaction buttons)
-- =============================================================================
-- 👍 Good inbound / 👎 Not relevant / ⏸ Too early

CREATE TABLE IF NOT EXISTS investor_inbound_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  discovery_flow_id UUID NOT NULL REFERENCES investor_discovery_flow(id) ON DELETE CASCADE,
  
  -- Feedback (simple, no comments, no notes)
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'good_inbound',     -- 👍
    'not_relevant',     -- 👎
    'too_early'         -- ⏸
  )),
  
  -- Metadata for learning
  signals_at_feedback TEXT[],            -- Snapshot of signals when feedback given
  alignment_state_at_feedback TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(investor_id, discovery_flow_id)  -- One feedback per item
);

CREATE INDEX IF NOT EXISTS idx_feedback_investor ON investor_inbound_feedback(investor_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON investor_inbound_feedback(feedback_type);

-- =============================================================================
-- 6. INVESTOR OBSERVATORY SESSION
-- =============================================================================
-- Track investor engagement with the observatory

CREATE TABLE IF NOT EXISTS investor_observatory_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Session info
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  
  -- Engagement metrics
  items_viewed INTEGER DEFAULT 0,
  feedback_given INTEGER DEFAULT 0,
  sections_visited TEXT[],               -- ['flow', 'signals', 'paths', 'drift']
  time_on_page_seconds INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observatory_sessions_investor ON investor_observatory_sessions(investor_id);
CREATE INDEX IF NOT EXISTS idx_observatory_sessions_start ON investor_observatory_sessions(session_start DESC);

-- =============================================================================
-- 7. INVESTOR ACCESS (Invite-only initially)
-- =============================================================================

CREATE TABLE IF NOT EXISTS investor_observatory_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Access control
  access_granted BOOLEAN DEFAULT FALSE,
  access_level TEXT DEFAULT 'standard' CHECK (access_level IN ('standard', 'premium', 'admin')),
  invite_code TEXT UNIQUE,
  invited_by TEXT,
  
  -- Preferences
  email_reports_enabled BOOLEAN DEFAULT FALSE,
  report_frequency TEXT DEFAULT 'weekly' CHECK (report_frequency IN ('daily', 'weekly', 'monthly', 'never')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(investor_id)
);

CREATE INDEX IF NOT EXISTS idx_observatory_access_investor ON investor_observatory_access(investor_id);
CREATE INDEX IF NOT EXISTS idx_observatory_access_code ON investor_observatory_access(invite_code) WHERE invite_code IS NOT NULL;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE investor_discovery_flow ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_signal_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_entry_path_distribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_quality_drift ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_inbound_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_observatory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_observatory_access ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT ALL ON investor_discovery_flow TO authenticated;
GRANT ALL ON investor_discovery_flow TO anon;
GRANT ALL ON investor_signal_distribution TO authenticated;
GRANT ALL ON investor_signal_distribution TO anon;
GRANT ALL ON investor_entry_path_distribution TO authenticated;
GRANT ALL ON investor_entry_path_distribution TO anon;
GRANT ALL ON investor_quality_drift TO authenticated;
GRANT ALL ON investor_quality_drift TO anon;
GRANT ALL ON investor_inbound_feedback TO authenticated;
GRANT ALL ON investor_inbound_feedback TO anon;
GRANT ALL ON investor_observatory_sessions TO authenticated;
GRANT ALL ON investor_observatory_sessions TO anon;
GRANT ALL ON investor_observatory_access TO authenticated;
GRANT ALL ON investor_observatory_access TO anon;
