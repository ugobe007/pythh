-- Add company_status to startup_uploads (required for enrich-from-rss-news exit tracking)
ALTER TABLE startup_uploads
  ADD COLUMN IF NOT EXISTS company_status TEXT DEFAULT 'active' CHECK (company_status IN ('active', 'acquired', 'dead', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_startup_uploads_company_status ON startup_uploads(company_status);
