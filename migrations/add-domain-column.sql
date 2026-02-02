-- Add normalized domain column to startup_uploads
-- This eliminates fragile website URL matching

ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_startup_uploads_domain 
ON startup_uploads(domain);

-- Backfill existing domains from website URLs
UPDATE startup_uploads
SET domain = CASE
  WHEN website IS NULL THEN NULL
  WHEN website ILIKE 'http://%' THEN 
    regexp_replace(
      regexp_replace(lower(website), '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  WHEN website ILIKE 'https://%' THEN 
    regexp_replace(
      regexp_replace(lower(website), '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  ELSE 
    regexp_replace(
      regexp_replace(lower(website), '^(www\.)?', ''),
      '/.*$', ''
    )
END
WHERE domain IS NULL AND website IS NOT NULL;

-- Add comment
COMMENT ON COLUMN startup_uploads.domain IS 'Normalized domain (e.g., "were.com") extracted from website URL. Used for fast, reliable matching.';
