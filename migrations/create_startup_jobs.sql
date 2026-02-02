-- Create startup_jobs table for backend job state tracking
-- Phase 3: Backend Job Model

-- ============================================
-- URL Normalization Function
-- ============================================

CREATE OR REPLACE FUNCTION normalize_url(input_url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_url, '^https?://', '', 'i'),
      '/$', ''
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_url IS 'Normalizes URLs: trim, lowercase, no protocol, no trailing slash';

-- ============================================
-- Startup Jobs Table
-- ============================================

CREATE TABLE IF NOT EXISTS startup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL GENERATED ALWAYS AS (normalize_url(url)) STORED,
  status TEXT NOT NULL CHECK (status IN ('queued', 'building', 'scoring', 'matching', 'ready', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_message TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on normalized URL (prevents case/protocol/slash duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_jobs_url_normalized 
  ON startup_jobs(url_normalized);

-- Index for querying by startup_id
CREATE INDEX IF NOT EXISTS idx_startup_jobs_startup_id ON startup_jobs(startup_id);

-- Index for finding recent jobs
CREATE INDEX IF NOT EXISTS idx_startup_jobs_created ON startup_jobs(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_startup_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_startup_jobs_updated_at
  BEFORE UPDATE ON startup_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_startup_jobs_updated_at();

-- Comment on table
COMMENT ON TABLE startup_jobs IS 'Tracks backend job state for startup signal processing';
COMMENT ON COLUMN startup_jobs.status IS 'Job status: queued | building | scoring | matching | ready | failed';
COMMENT ON COLUMN startup_jobs.progress_percent IS 'Progress percentage (0-100) for UI display';
