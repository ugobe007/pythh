-- ============================================================================
-- ML PIPELINE FIX + AUTO-APPROVAL
-- Feb 20, 2026
-- 
-- 1. Creates god_algorithm_config table for ML weight persistence
-- 2. Bulk-approves existing pending startups
-- 3. Auto-approve trigger for future submissions
-- ============================================================================

-- ============================================================================
-- 1. GOD ALGORITHM CONFIG TABLE
-- Stores the active algorithm configuration (weights, divisors, etc.)
-- ML recommendations write here; scoring service reads from here.
-- ============================================================================

CREATE TABLE IF NOT EXISTS god_algorithm_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Config scalars (mirrors GOD_SCORE_CONFIG in startupScoringService.ts)
  normalization_divisor NUMERIC(5,2) NOT NULL DEFAULT 19.0,
  base_boost_minimum    NUMERIC(4,2) NOT NULL DEFAULT 2.8,
  vibe_bonus_cap        NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  -- Component weights (team, traction, market, product, vision, etc.)
  component_weights     JSONB NOT NULL DEFAULT '{
    "team": 3.0,
    "traction": 3.0,
    "market": 2.0,
    "product": 2.0,
    "vision": 2.0,
    "ecosystem": 1.5,
    "grit": 1.5,
    "problemValidation": 2.0
  }',
  -- Metadata
  is_active             BOOLEAN NOT NULL DEFAULT true,
  applied_from_rec_id   UUID REFERENCES ml_recommendations(id) ON DELETE SET NULL,
  applied_by            TEXT NOT NULL DEFAULT 'system',
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only ever keep one active config (upsert pattern: deactivate old, insert new)
CREATE INDEX IF NOT EXISTS idx_god_config_active ON god_algorithm_config(is_active, created_at DESC);

-- Seed with current production values
INSERT INTO god_algorithm_config (
  normalization_divisor, base_boost_minimum, vibe_bonus_cap, applied_by, description
) VALUES (
  19.0, 2.8, 1.0, 'system', 'Production baseline — calibrated Feb 20, 2026'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. AUTO-APPROVE TRIGGER
-- Admin review removed. All new startups go straight to approved.
-- ============================================================================

CREATE OR REPLACE FUNCTION startup_auto_approve()
RETURNS TRIGGER AS $$
BEGIN
  -- If a startup arrives as 'pending', flip it to 'approved' immediately
  IF NEW.status = 'pending' THEN
    NEW.status = 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_startup_auto_approve ON startup_uploads;

CREATE TRIGGER trg_startup_auto_approve
  BEFORE INSERT OR UPDATE OF status
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION startup_auto_approve();

-- ============================================================================
-- 3. BULK-APPROVE existing pending startups
-- ============================================================================

UPDATE startup_uploads
SET status = 'approved', updated_at = now()
WHERE status = 'pending';

-- Log it
DO $$
DECLARE
  rows_updated INT;
BEGIN
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  -- Can't use ROW_COUNT after the UPDATE in a DO block with GET DIAGNOSTICS
  -- Just raise a notice so it shows up in the Supabase logs
  RAISE NOTICE 'Auto-approved pending startups migration complete';
END;
$$;
