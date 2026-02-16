-- ===========================================================================
-- ADD SCORE CHANGE TRACKING FOR DEAD WOOD REMOVAL
-- ===========================================================================
-- Track when startup's GOD score last changed to identify stagnant entries
-- Startups stuck at floor (40) with no improvement over 60 days get archived

-- Add last_score_change_at column to track score updates
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS last_score_change_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: Set to updated_at for existing startups
UPDATE startup_uploads 
SET last_score_change_at = COALESCE(updated_at, created_at, NOW())
WHERE last_score_change_at IS NULL;

-- Create trigger to update last_score_change_at when GOD score changes
CREATE OR REPLACE FUNCTION update_score_change_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if GOD score actually changed
  IF OLD.total_god_score IS DISTINCT FROM NEW.total_god_score THEN
    NEW.last_score_change_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS track_score_changes ON startup_uploads;
CREATE TRIGGER track_score_changes
  BEFORE UPDATE OF total_god_score, enhanced_god_score
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_score_change_timestamp();

-- Add index for efficient dead wood queries
CREATE INDEX IF NOT EXISTS idx_stagnant_startups 
  ON startup_uploads(last_score_change_at, total_god_score, status)
  WHERE status = 'approved';

-- Add comment
COMMENT ON COLUMN startup_uploads.last_score_change_at IS 
'Tracks when GOD score last changed. Used to identify stagnant startups for cleanup (60+ days at floor level).';

-- Validation
DO $$
BEGIN
  RAISE NOTICE '✅ Score change tracking enabled';
  RAISE NOTICE '';
  RAISE NOTICE '🗑️  Dead Wood Removal Policy:';
  RAISE NOTICE '   - Startups at floor (40 pts) for 60+ days → Archived';
  RAISE NOTICE '   - No score improvement = No signal improvement';
  RAISE NOTICE '   - Keeps platform fresh & high-quality';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Query stagnant startups:';
  RAISE NOTICE '   SELECT name, total_god_score, last_score_change_at';
  RAISE NOTICE '   FROM startup_uploads';
  RAISE NOTICE '   WHERE total_god_score = 40';
  RAISE NOTICE '   AND last_score_change_at < NOW() - INTERVAL ''60 days''';
  RAISE NOTICE '   AND status = ''approved'';';
END $$;
