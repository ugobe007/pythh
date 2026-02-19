-- ============================================================================
-- ACTIVATE PSYCHOLOGICAL SIGNALS - SQL Migration
-- ============================================================================
-- Date: February 17, 2026
-- Purpose: Add missing market_signals column to complete signal architecture
-- ============================================================================

-- Add market_signals column to startup_uploads
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS market_signals JSONB DEFAULT '{}';

-- Create GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_startup_uploads_market_signals 
  ON startup_uploads USING GIN(market_signals);

-- Add column comment
COMMENT ON COLUMN startup_uploads.market_signals IS 
  'Market intelligence signals: funding velocity, sector momentum, investor behavior patterns';

-- Verify column was created
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'startup_uploads'
  AND column_name = 'market_signals';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ market_signals column created successfully';
  RAISE NOTICE '📊 Column type: JSONB with GIN index for fast queries';
  RAISE NOTICE '🔍 Default value: {} (empty JSON object)';
END $$;
