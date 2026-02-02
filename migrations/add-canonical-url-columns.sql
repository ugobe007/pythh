-- Add canonical URL fields to startup_uploads for deterministic identity
-- Guarantees: same URL → same startup_id always

-- Add columns
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS canonical_url TEXT,
ADD COLUMN IF NOT EXISTS domain_key TEXT;

-- Create unique index on domain_key (the SSOT for URL identity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_uploads_domain_key 
  ON startup_uploads(domain_key) 
  WHERE domain_key IS NOT NULL;

-- Index on canonical_url for lookups
CREATE INDEX IF NOT EXISTS idx_startup_uploads_canonical_url 
  ON startup_uploads(canonical_url) 
  WHERE canonical_url IS NOT NULL;

COMMENT ON COLUMN startup_uploads.canonical_url IS 'Normalized URL: lowercase, no protocol, no www, no trailing slash';
COMMENT ON COLUMN startup_uploads.domain_key IS 'Unique domain identifier for deduplication';
