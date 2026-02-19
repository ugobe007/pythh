
-- Add market_signals column to startup_uploads
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS market_signals JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_startup_uploads_market_signals 
  ON startup_uploads USING GIN(market_signals);

COMMENT ON COLUMN startup_uploads.market_signals IS 
  'Market intelligence: funding velocity, sector momentum, investor behavior';


-- See supabase/migrations/20260212_psychological_signals.sql for full psychological signals schema