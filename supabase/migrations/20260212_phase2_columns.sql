-- ===========================================================================
-- PHASE 2 PSYCHOLOGICAL SIGNALS - ADDITIONAL COLUMNS
-- ===========================================================================
-- Date: February 12, 2026 (Supplement)
-- Purpose: Add Phase 2 behavioral intelligence columns to startup_uploads
--
-- Phase 2 Signals:
-- - Sector pivot detection (investor strategic shifts)
-- - Social proof cascades (tier-1 leads triggering herd behavior)
-- - Repeat founder signals (serial entrepreneurs)
-- - Cofounder exit risks (early warning for internal problems)
-- ===========================================================================

-- Add Phase 2 columns to startup_uploads table
ALTER TABLE startup_uploads
  -- Sector Pivot Signals
  ADD COLUMN IF NOT EXISTS has_sector_pivot BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pivot_investor TEXT,
  ADD COLUMN IF NOT EXISTS pivot_from_sector TEXT,
  ADD COLUMN IF NOT EXISTS pivot_to_sector TEXT,
  ADD COLUMN IF NOT EXISTS pivot_strength DECIMAL(3,2),
  
  -- Social Proof Cascade Signals
  ADD COLUMN IF NOT EXISTS has_social_proof_cascade BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tier1_leader TEXT,
  ADD COLUMN IF NOT EXISTS follower_count INTEGER,
  ADD COLUMN IF NOT EXISTS cascade_strength DECIMAL(3,2),
  
  -- Repeat Founder Signals
  ADD COLUMN IF NOT EXISTS is_repeat_founder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS previous_companies TEXT[],
  ADD COLUMN IF NOT EXISTS previous_exits JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS founder_strength DECIMAL(3,2),
  
  -- Cofounder Exit Signals (Risk)
  ADD COLUMN IF NOT EXISTS has_cofounder_exit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS departed_role TEXT,
  ADD COLUMN IF NOT EXISTS departed_name TEXT,
  ADD COLUMN IF NOT EXISTS exit_risk_strength DECIMAL(3,2);

-- Add comments for documentation
COMMENT ON COLUMN startup_uploads.has_sector_pivot IS 'Detected when tier-1 investors shift sector focus (e.g., Sequoia: crypto → AI)';
COMMENT ON COLUMN startup_uploads.has_social_proof_cascade IS 'Tier-1 investor lead triggered follow-on investments (herd behavior)';
COMMENT ON COLUMN startup_uploads.is_repeat_founder IS 'Serial entrepreneur detected (2nd+ startup)';
COMMENT ON COLUMN startup_uploads.has_cofounder_exit IS 'Cofounder departure detected (red flag risk)';
COMMENT ON COLUMN startup_uploads.previous_exits IS 'Array of {company, acquirer} objects for repeat founders';

-- Validation notice
DO $$
BEGIN
  RAISE NOTICE 'Phase 2 psychological signal columns added successfully!';
  RAISE NOTICE 'New columns: has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit';
  RAISE NOTICE 'Total Phase 2 columns: 17 (sector pivot: 5, social proof: 4, repeat founder: 4, cofounder exit: 4)';
END $$;
