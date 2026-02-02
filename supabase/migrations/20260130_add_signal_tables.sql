-- ============================================================================
-- SIGNAL SCORING TABLES
-- Migration to add signal columns to startup_uploads and create signal history
-- ============================================================================
-- 
-- ARCHITECTURE:
--   GOD Score (0-100) = Base score from 23 algorithms
--   Signals Bonus (0-10) = Market intelligence layer
--   Final Score = GOD + Signals
--
-- SIGNAL DIMENSIONS (5 total, max 10 points):
--   - product_velocity (0-1 normalized → max 2.0 points)
--   - funding_acceleration (0-1 normalized → max 2.5 points)
--   - customer_adoption (0-1 normalized → max 2.0 points)
--   - market_momentum (0-1 normalized → max 1.5 points)
--   - competitive_dynamics (0-1 normalized → max 2.0 points)
--
-- STABILITY RULE: 50% change threshold (signals only update on significant changes)
-- ============================================================================

-- Add signal columns to startup_uploads
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS signals_bonus DECIMAL(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_velocity_signal DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS funding_acceleration_signal DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_adoption_signal DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS market_momentum_signal DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS competitive_dynamics_signal DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS signals_updated_at TIMESTAMPTZ;

-- Add final_score column (GOD + Signals)
ALTER TABLE startup_uploads
ADD COLUMN IF NOT EXISTS final_score DECIMAL(5,2) GENERATED ALWAYS AS (total_god_score + COALESCE(signals_bonus, 0)) STORED;

-- Create signal history table for auditing
CREATE TABLE IF NOT EXISTS signal_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  old_value DECIMAL(3,2),
  new_value DECIMAL(3,2),
  change_percent DECIMAL(5,2),
  applied BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_signal_history_startup ON signal_history(startup_id);
CREATE INDEX IF NOT EXISTS idx_signal_history_applied ON signal_history(applied);
CREATE INDEX IF NOT EXISTS idx_startup_signals_bonus ON startup_uploads(signals_bonus) WHERE signals_bonus > 0;
CREATE INDEX IF NOT EXISTS idx_startup_final_score ON startup_uploads(final_score);

-- Comment on columns
COMMENT ON COLUMN startup_uploads.signals_bonus IS 'Total signal bonus (0-10), layered on GOD score';
COMMENT ON COLUMN startup_uploads.product_velocity_signal IS 'Product shipping velocity signal (0-1 normalized)';
COMMENT ON COLUMN startup_uploads.funding_acceleration_signal IS 'Funding momentum signal (0-1 normalized)';
COMMENT ON COLUMN startup_uploads.customer_adoption_signal IS 'Customer growth velocity signal (0-1 normalized)';
COMMENT ON COLUMN startup_uploads.market_momentum_signal IS 'Market attention/press signal (0-1 normalized)';
COMMENT ON COLUMN startup_uploads.competitive_dynamics_signal IS 'Competitive positioning signal (0-1 normalized)';
COMMENT ON COLUMN startup_uploads.final_score IS 'GOD score + signals bonus (auto-calculated)';
COMMENT ON TABLE signal_history IS 'Audit trail for signal changes with 50% threshold logic';
