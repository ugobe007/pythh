-- Add last_scraped_at column to startup_uploads
-- This tracks when startup data was last refreshed by scrapers

-- Add column if not exists
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- Create index for efficient queries (finding stale startups)
CREATE INDEX IF NOT EXISTS idx_startup_last_scraped 
ON startup_uploads(last_scraped_at) 
WHERE status = 'approved';

-- Create index for score history queries (ordered by creation time)
CREATE INDEX IF NOT EXISTS idx_score_history_created_at 
ON score_history(created_at DESC);

-- Update existing startups to have a default last_scraped_at
-- (Set to created_at so they're counted as "scanned" initially)
UPDATE startup_uploads 
SET last_scraped_at = created_at 
WHERE last_scraped_at IS NULL 
  AND created_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN startup_uploads.last_scraped_at 
IS 'Timestamp of last data refresh by scraper pipeline. Used to identify stale data.';
