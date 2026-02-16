-- Add missing columns for domain normalizer v2
-- company_domain, company_domain_confidence, domain_source already exist

ALTER TABLE startup_uploads
  ADD COLUMN IF NOT EXISTS discovery_source_url TEXT,
  ADD COLUMN IF NOT EXISTS domain_candidates JSONB;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_company_domain
  ON startup_uploads (company_domain);

CREATE INDEX IF NOT EXISTS idx_startup_uploads_domain_source
  ON startup_uploads (domain_source);
