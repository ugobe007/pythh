-- Migration 02: Create startup_jobs table
-- Run AFTER: 01_create_normalize_url_function.sql

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

-- Unique constraint on normalized URL (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_jobs_url_normalized 
  ON startup_jobs(url_normalized);

CREATE INDEX IF NOT EXISTS idx_startup_jobs_status ON startup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_startup_jobs_startup_id ON startup_jobs(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_jobs_created ON startup_jobs(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_startup_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_startup_jobs_updated_at ON startup_jobs;
CREATE TRIGGER trigger_startup_jobs_updated_at
  BEFORE UPDATE ON startup_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_startup_jobs_updated_at();

COMMENT ON TABLE startup_jobs IS 'Tracks backend job state for startup signal processing';
