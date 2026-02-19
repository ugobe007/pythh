-- Fix ml_recommendations table - add missing columns
-- Issue: Server tries to update applied_at and applied_by, but columns don't exist

ALTER TABLE ml_recommendations
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by text;

-- Update status check constraint to include 'applied'
ALTER TABLE ml_recommendations
  DROP CONSTRAINT IF EXISTS ml_recommendations_status_check;

ALTER TABLE ml_recommendations
  ADD CONSTRAINT ml_recommendations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'applied'));

COMMENT ON COLUMN ml_recommendations.applied_at IS 'When recommendation was applied to production';
COMMENT ON COLUMN ml_recommendations.applied_by IS 'Admin user who applied the recommendation';
