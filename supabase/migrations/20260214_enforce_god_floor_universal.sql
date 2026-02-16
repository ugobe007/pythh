-- ===========================================================================
-- ENFORCE UNIVERSAL MINIMUM GOD SCORE FLOOR (40 pts) FOR APPROVED STARTUPS
-- ===========================================================================
-- Purpose: Remove all scores below 40 for approved startups.
--
-- This migration updates the existing enforce_god_score_floor() trigger
-- function so that **any** approved startup with a non-null GOD score
-- is clamped to a minimum of 40/100, regardless of data richness.
--
-- Previous behavior (20260213_enforce_god_floor.sql):
--   - Only startups that "have data" (extracted_data/traction/team/etc.)
--     were raised to 40; truly sparse/junk rows were allowed to stay < 40.
--
-- New behavior:
--   - All approved startups with total_god_score < 40 are raised to 40.
--   - enhanced_god_score is also raised to at least 40 when present.
--   - Non-approved rows are left unchanged.
--
-- This keeps relative ordering above 40 intact while eliminating the
-- long low tail in the approved population.
-- ===========================================================================

CREATE OR REPLACE FUNCTION enforce_god_score_floor()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce floor for approved startups with a defined score
  IF NEW.status = 'approved' AND NEW.total_god_score IS NOT NULL THEN
    -- Clamp total_god_score to minimum 40
    IF NEW.total_god_score < 40 THEN
      NEW.total_god_score := 40;
    END IF;

    -- Clamp enhanced_god_score to at least 40 if it exists
    IF NEW.enhanced_god_score IS NOT NULL AND NEW.enhanced_god_score < 40 THEN
      NEW.enhanced_god_score := 40;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and uses the updated function
DROP TRIGGER IF EXISTS trigger_enforce_god_floor ON startup_uploads;
CREATE TRIGGER trigger_enforce_god_floor
  BEFORE INSERT OR UPDATE OF total_god_score, extracted_data, mrr, customer_count
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_god_score_floor();

COMMENT ON FUNCTION enforce_god_score_floor() IS 
'Enforces minimum GOD score of 40 for all approved startups (total and enhanced scores).';

-- One-time backfill: raise any existing approved startups below 40 to 40
DO $$
DECLARE
  updated_count INT := 0;
BEGIN
  UPDATE startup_uploads
  SET 
    total_god_score = GREATEST(40, total_god_score),
    enhanced_god_score = CASE 
      WHEN enhanced_god_score IS NULL THEN enhanced_god_score
      ELSE GREATEST(40, enhanced_god_score)
    END
  WHERE status = 'approved'
    AND total_god_score IS NOT NULL
    AND total_god_score < 40;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Universal GOD score floor applied to approved startups';
  RAISE NOTICE '   Backfilled: % startups raised to >= 40', updated_count;
  RAISE NOTICE '';
END $$;
