-- Add stage_estimate to startup_uploads if missing (required by investor lookup)
-- Run this in Supabase SQL Editor if you get "column startup_uploads.stage_estimate does not exist"

ALTER TABLE startup_uploads
  ADD COLUMN IF NOT EXISTS stage_estimate TEXT;

CREATE INDEX IF NOT EXISTS idx_startup_uploads_stage_estimate
  ON startup_uploads(stage_estimate) WHERE stage_estimate IS NOT NULL;

COMMENT ON COLUMN startup_uploads.stage_estimate IS 'Stage estimate: pre-seed, seed, series-a, etc.';
