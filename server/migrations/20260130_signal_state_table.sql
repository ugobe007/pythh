-- ============================================================================
-- SIGNAL STATE TABLE
-- ============================================================================
-- Stores signal dimensions per startup for 50% change threshold tracking
-- Signals only update GOD score when they change significantly (≥50%)
-- 
-- Created: January 30, 2026
-- Purpose: Support layered signal architecture with stability threshold
-- ============================================================================

-- Create signal state table
CREATE TABLE IF NOT EXISTS startup_signals_state (
  startup_id UUID PRIMARY KEY REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  -- Signal dimensions (JSONB for flexibility)
  dimensions JSONB NOT NULL DEFAULT '{
    "product_velocity": 0,
    "funding_acceleration": 0,
    "customer_adoption": 0,
    "market_momentum": 0,
    "competitive_dynamics": 0
  }',
  
  -- Computed signals bonus (0-10, typically 1-3, 7+ rare)
  signals_bonus DECIMAL(4,2) NOT NULL DEFAULT 0
    CHECK (signals_bonus >= 0 AND signals_bonus <= 10),
  
  -- Last time signals changed significantly (≥50%)
  last_significant_change TIMESTAMPTZ,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_signals_state_bonus 
  ON startup_signals_state(signals_bonus DESC);

CREATE INDEX IF NOT EXISTS idx_signals_state_updated 
  ON startup_signals_state(updated_at DESC);

-- Add signals_bonus column to startup_uploads if not exists
-- This stores the APPLIED signals bonus (only updated on ≥50% change)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'startup_uploads' 
    AND column_name = 'signals_bonus'
  ) THEN
    ALTER TABLE startup_uploads 
    ADD COLUMN signals_bonus DECIMAL(4,2) DEFAULT 0
      CHECK (signals_bonus >= 0 AND signals_bonus <= 10);
    
    COMMENT ON COLUMN startup_uploads.signals_bonus IS 
      'Signal bonus applied to GOD score (0-10, typically 1-3). Only updates on ≥50% change.';
  END IF;
END $$;

-- Add total_score column that combines GOD + Signals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'startup_uploads' 
    AND column_name = 'total_score_with_signals'
  ) THEN
    ALTER TABLE startup_uploads 
    ADD COLUMN total_score_with_signals DECIMAL(5,2) 
      GENERATED ALWAYS AS (LEAST(100, total_god_score + COALESCE(signals_bonus, 0))) STORED;
    
    COMMENT ON COLUMN startup_uploads.total_score_with_signals IS 
      'Final score = GOD base + Signals bonus (capped at 100)';
  END IF;
END $$;

-- Comments
COMMENT ON TABLE startup_signals_state IS 
  'Tracks signal dimensions per startup for 50% change threshold. Signals only update when they change significantly.';

COMMENT ON COLUMN startup_signals_state.dimensions IS 
  'Signal dimensions: product_velocity, funding_acceleration, customer_adoption, market_momentum, competitive_dynamics (each 0-1)';

COMMENT ON COLUMN startup_signals_state.signals_bonus IS 
  'Computed signals bonus (0-10). Typical: 1-3. Rare: 7+. Max: 10.';

COMMENT ON COLUMN startup_signals_state.last_significant_change IS 
  'Timestamp of last ≥50% change in any signal dimension';

-- ============================================================================
-- SIGNAL STABILITY POLICY
-- ============================================================================
-- 
-- ARCHITECTURE:
--   FINAL SCORE = GOD base (0-100) + Signals bonus (0-10)
-- 
-- STABILITY RULE:
--   Signals ONLY update when they change by ≥50% from stored value
--   This prevents noise and over-reaction to minor market movements
-- 
-- EXPECTED DISTRIBUTION:
--   - Most startups: 1-3 point signal boost
--   - Elite startups: 5-7 point signal boost
--   - Exceptional: 8-10 point signal boost (very rare)
-- 
-- ============================================================================
