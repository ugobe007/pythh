-- ============================================================================
-- Pythh Canonical Verification System v2.0.0
-- Full alignment with TypeScript canonical contracts
-- ============================================================================

-- ============================================================================
-- 1. ENUMS (create if not exists)
-- ============================================================================

DO $$
BEGIN
  -- Action types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_type_v2') THEN
    CREATE TYPE action_type_v2 AS ENUM (
      'product_release',
      'customer_closed',
      'revenue_change',
      'hiring',
      'press',
      'partnership',
      'fundraising',
      'investor_meeting',
      'other'
    );
  END IF;

  -- Impact guess
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_guess_v2') THEN
    CREATE TYPE impact_guess_v2 AS ENUM ('low', 'medium', 'high');
  END IF;

  -- Action status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_status_v2') THEN
    CREATE TYPE action_status_v2 AS ENUM (
      'pending',
      'provisional_applied',
      'verified',
      'rejected',
      'needs_info'
    );
  END IF;

  -- Evidence types
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evidence_type_v2') THEN
    CREATE TYPE evidence_type_v2 AS ENUM (
      'oauth_connector',
      'webhook_event',
      'document_upload',
      'screenshot',
      'email_proof',
      'public_link',
      'bank_transaction',
      'manual_review_note'
    );
  END IF;

  -- Verification tier
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_tier_v2') THEN
    CREATE TYPE verification_tier_v2 AS ENUM (
      'unverified',
      'soft_verified',
      'verified',
      'trusted'
    );
  END IF;

  -- Connector providers
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connector_provider') THEN
    CREATE TYPE connector_provider AS ENUM (
      'stripe',
      'ga4',
      'github',
      'plaid',
      'hubspot',
      'linear',
      'notion'
    );
  END IF;

  -- Connector status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'connector_status') THEN
    CREATE TYPE connector_status AS ENUM (
      'connected',
      'pending',
      'error',
      'expired',
      'not_connected'
    );
  END IF;

  -- Blocker severity
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'blocker_severity_v2') THEN
    CREATE TYPE blocker_severity_v2 AS ENUM ('hard', 'soft');
  END IF;
END $$;

-- ============================================================================
-- 2. ACTION_EVENTS (canonical schema v2)
-- ============================================================================

-- Create new canonical table
CREATE TABLE IF NOT EXISTS action_events_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  actor_user_id UUID,  -- nullable for now until auth is wired

  type action_type_v2 NOT NULL,
  title TEXT NOT NULL,
  details TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  impact_guess impact_guess_v2 NOT NULL DEFAULT 'medium',

  -- Structured fields for scoring
  fields JSONB DEFAULT '{}'::jsonb,
  
  -- Evidence requirements computed at intake
  verification_plan JSONB NOT NULL DEFAULT '{
    "requirements": [],
    "targetVerification": 0.85,
    "verificationWindowDays": 14
  }'::jsonb,

  -- Current state
  status action_status_v2 NOT NULL DEFAULT 'pending',

  -- Delta references
  provisional_delta_id UUID,
  verified_delta_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_events_v2_startup ON action_events_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_action_events_v2_status ON action_events_v2(status);
CREATE INDEX IF NOT EXISTS idx_action_events_v2_type ON action_events_v2(type);
CREATE INDEX IF NOT EXISTS idx_action_events_v2_occurred ON action_events_v2(occurred_at DESC);

-- ============================================================================
-- 3. EVIDENCE_ARTIFACTS (canonical schema v2)
-- ============================================================================

-- Create new canonical table
CREATE TABLE IF NOT EXISTS evidence_artifacts_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  action_id UUID REFERENCES action_events_v2(id) ON DELETE SET NULL,
  
  type evidence_type_v2 NOT NULL,

  -- Reference data
  ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Expected: { url?, fileKey?, provider?, providerEventId?, hash? }

  -- Machine-extracted data
  extracted JSONB,
  -- Expected: { flags?, amounts?, dates?, entities? }

  -- Trust metadata
  tier verification_tier_v2 NOT NULL DEFAULT 'unverified',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evidence_v2_startup ON evidence_artifacts_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_evidence_v2_action ON evidence_artifacts_v2(action_id);
CREATE INDEX IF NOT EXISTS idx_evidence_v2_type ON evidence_artifacts_v2(type);
CREATE INDEX IF NOT EXISTS idx_evidence_v2_tier ON evidence_artifacts_v2(tier);

-- ============================================================================
-- 4. VERIFICATION_STATES (canonical schema v2)
-- ============================================================================

-- Drop old if exists, create canonical
DROP TABLE IF EXISTS verification_states_v2 CASCADE;
CREATE TABLE verification_states_v2 (
  action_id UUID PRIMARY KEY REFERENCES action_events_v2(id) ON DELETE CASCADE,
  
  current_verification NUMERIC(4,3) NOT NULL DEFAULT 0.2 CHECK (current_verification >= 0 AND current_verification <= 1),
  tier verification_tier_v2 NOT NULL DEFAULT 'unverified',
  satisfied BOOLEAN NOT NULL DEFAULT false,

  missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of VerificationRequirement objects

  matched_evidence_ids UUID[] DEFAULT '{}',
  notes TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. SCORE_SNAPSHOTS (canonical schema v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS score_snapshots_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  as_of TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Feature map: { featureId: FeatureSnapshot }
  features JSONB NOT NULL DEFAULT '{}'::jsonb,

  total_signal NUMERIC(10,4) NOT NULL DEFAULT 0,
  total_god NUMERIC(10,4) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_v2_startup ON score_snapshots_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_v2_asof ON score_snapshots_v2(as_of DESC);

-- ============================================================================
-- 6. SCORE_DELTAS (canonical schema v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS score_deltas_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  prev_snapshot_id UUID REFERENCES score_snapshots_v2(id) ON DELETE SET NULL,
  next_snapshot_id UUID REFERENCES score_snapshots_v2(id) ON DELETE SET NULL,

  delta_signal NUMERIC(10,4) NOT NULL DEFAULT 0,
  delta_god NUMERIC(10,4) NOT NULL DEFAULT 0,

  -- Top movers: [{ featureId, delta, reasons[], evidenceRefs[]? }]
  top_movers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Blockers: [{ id, severity, message, fixPath }]
  blockers JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deltas_v2_startup ON score_deltas_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_deltas_v2_created ON score_deltas_v2(created_at DESC);

-- Add FK constraints back to action_events_v2
ALTER TABLE action_events_v2
  ADD CONSTRAINT fk_provisional_delta 
  FOREIGN KEY (provisional_delta_id) 
  REFERENCES score_deltas_v2(id) ON DELETE SET NULL;

ALTER TABLE action_events_v2
  ADD CONSTRAINT fk_verified_delta 
  FOREIGN KEY (verified_delta_id) 
  REFERENCES score_deltas_v2(id) ON DELETE SET NULL;

-- ============================================================================
-- 7. CONNECTED_SOURCES (canonical schema v2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS connected_sources_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  provider connector_provider NOT NULL,
  status connector_status NOT NULL DEFAULT 'not_connected',

  last_sync_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One source per provider per startup
  UNIQUE(startup_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sources_v2_startup ON connected_sources_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_sources_v2_provider ON connected_sources_v2(provider);
CREATE INDEX IF NOT EXISTS idx_sources_v2_status ON connected_sources_v2(status);

-- ============================================================================
-- 8. ACTIVE_BLOCKING_FACTORS (track current blockers per startup)
-- ============================================================================

CREATE TABLE IF NOT EXISTS active_blocking_factors_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  blocker_id TEXT NOT NULL,  -- canonical IDs: identity_not_verified, evidence_insufficient, etc.
  severity blocker_severity_v2 NOT NULL,
  message TEXT NOT NULL,
  fix_path TEXT NOT NULL,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Partial unique index for active blockers only
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_blocker_v2 
  ON active_blocking_factors_v2(startup_id, blocker_id) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_blockers_v2_startup ON active_blocking_factors_v2(startup_id);
CREATE INDEX IF NOT EXISTS idx_blockers_v2_active ON active_blocking_factors_v2(is_active) WHERE is_active = true;

-- ============================================================================
-- 9. DELTA_CONFIG (system-wide scoring configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS delta_config_v2 (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton
  
  -- Verification tier multipliers
  verification_multipliers JSONB NOT NULL DEFAULT '{
    "unverified": 0.20,
    "soft_verified": 0.45,
    "verified": 0.85,
    "trusted": 1.0
  }'::jsonb,

  -- Feature weights
  feature_weights JSONB NOT NULL DEFAULT '{
    "traction": 0.20,
    "founder_velocity": 0.15,
    "investor_intent": 0.15,
    "market_belief_shift": 0.10,
    "capital_convergence": 0.10,
    "team_strength": 0.15,
    "product_quality": 0.10,
    "market_size": 0.05
  }'::jsonb,

  -- GOD adjustment weights
  god_weights JSONB NOT NULL DEFAULT '{
    "signal": 0.25,
    "traction": 0.35,
    "investorIntent": 0.20,
    "penaltyPerBlocker": 0.5
  }'::jsonb,

  -- Provisional caps
  provisional_caps JSONB NOT NULL DEFAULT '{
    "maxVerificationMultiplier": 0.35,
    "defaultWindowDays": 14
  }'::jsonb,

  -- Freshness decay
  freshness_half_life_days NUMERIC NOT NULL DEFAULT 14,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO delta_config_v2 (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Startup scorecard summary
CREATE OR REPLACE VIEW startup_scorecard AS
SELECT 
  s.id AS startup_id,
  s.name,
  s.total_god_score AS god_score,
  COALESCE(snap.total_signal, 0) AS signal_score,
  COALESCE(snap.total_god, s.total_god_score) AS snapshot_god,
  snap.as_of AS last_snapshot,
  (SELECT COUNT(*) FROM action_events_v2 ae WHERE ae.startup_id = s.id AND ae.status = 'pending') AS pending_actions,
  (SELECT COUNT(*) FROM action_events_v2 ae WHERE ae.startup_id = s.id AND ae.status = 'verified') AS verified_actions,
  (SELECT COUNT(*) FROM active_blocking_factors_v2 ab WHERE ab.startup_id = s.id AND ab.is_active = true) AS active_blockers
FROM startup_uploads s
LEFT JOIN LATERAL (
  SELECT * FROM score_snapshots_v2 ss 
  WHERE ss.startup_id = s.id 
  ORDER BY ss.as_of DESC 
  LIMIT 1
) snap ON true
WHERE s.status = 'approved';

-- View: Action with verification state
CREATE OR REPLACE VIEW action_with_verification AS
SELECT 
  a.*,
  vs.current_verification,
  vs.tier AS verification_tier,
  vs.satisfied AS verification_satisfied,
  vs.missing AS missing_requirements,
  vs.matched_evidence_ids
FROM action_events_v2 a
LEFT JOIN verification_states_v2 vs ON vs.action_id = a.id;

-- ============================================================================
-- 11. MIGRATE DATA FROM OLD TABLES (if needed)
-- ============================================================================

-- Migrate action_events to action_events_v2
INSERT INTO action_events_v2 (
  id, startup_id, actor_user_id, type, title, details, 
  occurred_at, submitted_at, impact_guess, fields,
  verification_plan, status, created_at
)
SELECT 
  ae.id,
  ae.startup_id,
  ae.reported_by,
  CASE ae.category
    WHEN 'revenue' THEN 'revenue_change'::action_type_v2
    WHEN 'product' THEN 'product_release'::action_type_v2
    WHEN 'hiring' THEN 'hiring'::action_type_v2
    WHEN 'funding' THEN 'fundraising'::action_type_v2
    WHEN 'partnership' THEN 'partnership'::action_type_v2
    WHEN 'press' THEN 'press'::action_type_v2
    WHEN 'milestone' THEN 'product_release'::action_type_v2
    ELSE 'other'::action_type_v2
  END,
  ae.title,
  ae.description,
  COALESCE(ae.action_date, ae.created_at),
  ae.created_at,
  CASE ae.impact_guess
    WHEN 'low' THEN 'low'::impact_guess_v2
    WHEN 'medium' THEN 'medium'::impact_guess_v2
    WHEN 'high' THEN 'high'::impact_guess_v2
    ELSE 'medium'::impact_guess_v2
  END,
  '{}'::jsonb,
  jsonb_build_object(
    'requirements', '[]'::jsonb,
    'targetVerification', 0.85,
    'verificationWindowDays', 14
  ),
  CASE ae.verification_status
    WHEN 'pending' THEN 'pending'::action_status_v2
    WHEN 'verified' THEN 'verified'::action_status_v2
    WHEN 'rejected' THEN 'rejected'::action_status_v2
    ELSE 'pending'::action_status_v2
  END,
  ae.created_at
FROM action_events ae
WHERE NOT EXISTS (
  SELECT 1 FROM action_events_v2 WHERE id = ae.id
);

-- Create verification states for migrated actions
INSERT INTO verification_states_v2 (action_id, current_verification, tier, satisfied, missing, updated_at)
SELECT 
  id,
  CASE status
    WHEN 'verified' THEN 0.85
    WHEN 'provisional_applied' THEN 0.35
    ELSE 0.2
  END,
  CASE status
    WHEN 'verified' THEN 'verified'::verification_tier_v2
    WHEN 'provisional_applied' THEN 'soft_verified'::verification_tier_v2
    ELSE 'unverified'::verification_tier_v2
  END,
  status = 'verified',
  '[]'::jsonb,
  NOW()
FROM action_events_v2
WHERE NOT EXISTS (
  SELECT 1 FROM verification_states_v2 WHERE action_id = action_events_v2.id
);

-- ============================================================================
-- 12. UPDATED_AT TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_events_v2_updated_at ON action_events_v2;
CREATE TRIGGER action_events_v2_updated_at
  BEFORE UPDATE ON action_events_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS connected_sources_v2_updated_at ON connected_sources_v2;
CREATE TRIGGER connected_sources_v2_updated_at
  BEFORE UPDATE ON connected_sources_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS verification_states_v2_updated_at ON verification_states_v2;
CREATE TRIGGER verification_states_v2_updated_at
  BEFORE UPDATE ON verification_states_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done!
-- ============================================================================
