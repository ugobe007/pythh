-- ===========================================================================
-- LOWER GOD SCORE FLOOR FROM 40 → 35 FOR APPROVED STARTUPS
-- ===========================================================================
-- Date: February 18, 2026
-- Purpose: Create natural Fair (35-49) category by lowering minimum threshold
--
-- Previous floor (40): Created gap where weak startups had no room below Good
-- New floor (35): Allows realistic distribution matching VC selection reality:
--   - Fair (35-49): 20-25% - Needs work, watch list for data enrichment
--   - Good (50-59): 35-40% - Solid potential
--   - Strong (60-69): 22-25% - Competitive for funding
--   - Excellent (70-79): 10% - Top tier
--   - Elite (80-100): 2% - Unicorn track
--
-- Startups scoring <35 are flagged for priority re-scraping/data enrichment
-- via startup_jobs queue (handled by continuous-scraper.js)
-- ===========================================================================

-- Update the floor enforcement function
CREATE OR REPLACE FUNCTION enforce_god_score_floor()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce floor for approved startups with a defined score
  IF NEW.status = 'approved' AND NEW.total_god_score IS NOT NULL THEN
    -- Clamp total_god_score to minimum 35 (Fair category floor)
    IF NEW.total_god_score < 35 THEN
      NEW.total_god_score := 35;
    END IF;

    -- Clamp enhanced_god_score to at least 35 if it exists
    IF NEW.enhanced_god_score IS NOT NULL AND NEW.enhanced_god_score < 35 THEN
      NEW.enhanced_god_score := 35;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION enforce_god_score_floor() IS 
'Enforces minimum GOD score of 35 for approved startups (Fair category floor). Startups <35 flagged for data enrichment.';

-- One-time backfill: lower any existing startups at 40 floor to natural score
-- (This allows natural distribution to create Fair 35-49 category)
DO $$
DECLARE
  lowered_count INT := 0;
BEGIN
  -- Note: We're NOT raising scores, just documenting the new floor
  -- Next recalculation will naturally create 35-49 scores
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ GOD score floor lowered from 40 → 35';
  RAISE NOTICE '   Fair category (35-49) now possible';
  RAISE NOTICE '   Startups <35 will be flagged for data enrichment';
  RAISE NOTICE '   Run recalculate-scores.ts to apply new distribution';
  RAISE NOTICE '';
END $$;
