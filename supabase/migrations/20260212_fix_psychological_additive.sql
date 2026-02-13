-- ===========================================================================
-- FIX: Convert Psychological Signals from Multiplicative to Additive
-- ===========================================================================
-- CRITICAL CORRECTION: The initial implementation incorrectly used multiplicative
-- scaling (base × multiplier) instead of additive bonus (base + bonus) as specified
-- in the architecture. This creates inequality where high-scores get bigger absolute
-- boosts than low-scores for the same signal.
--
-- Architecture Requirement (startupScoringService.ts lines 22-27):
--   FINAL SCORE = GOD base (0-100) + Signals bonus (0-10)
--
-- OLD (WRONG): enhanced = 84 × 1.35 = 113 (capped 100)
-- NEW (CORRECT): enhanced = 84 + 6 = 90
-- ===========================================================================

-- Step 1: Rename column from psychological_multiplier to psychological_bonus
ALTER TABLE startup_uploads 
  RENAME COLUMN psychological_multiplier TO psychological_bonus;

-- Step 2: Update column comment to reflect additive approach
COMMENT ON COLUMN startup_uploads.psychological_bonus IS 'Calculated bonus points based on behavioral signals (-3 to +10 points, typically 1-3)';
COMMENT ON COLUMN startup_uploads.enhanced_god_score IS 'total_god_score + psychological_bonus (capped at 100)';

-- Step 3: Drop old function
DROP FUNCTION IF EXISTS calculate_psychological_multiplier(UUID);

-- Step 4: Create new additive bonus calculation function
CREATE OR REPLACE FUNCTION calculate_psychological_bonus(startup_uuid UUID)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  fomo_boost DECIMAL(3,2) := 0;
  conviction_boost DECIMAL(3,2) := 0;
  urgency_boost DECIMAL(3,2) := 0;
  risk_penalty DECIMAL(3,2) := 0;
  final_bonus DECIMAL(4,2);
BEGIN
  -- Get all signals for this startup
  SELECT 
    COALESCE(MAX(CASE WHEN signal_type = 'oversubscription' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'followon' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'competitive' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'bridge' THEN signal_strength END), 0)
  INTO fomo_boost, conviction_boost, urgency_boost, risk_penalty
  FROM psychological_signals
  WHERE startup_id = startup_uuid;
  
  -- Calculate ADDITIVE bonus (not multiplicative)
  -- Formula: 0 + (FOMO × 5pt) + (Conviction × 5pt) + (Urgency × 3pt) - (Risk × 3pt)
  -- Scale: Strength is 0-1, so multiply by point values to get 0-10 range
  final_bonus := 0.0 + 
                 (fomo_boost * 5.0) +       -- 0-5 points
                 (conviction_boost * 5.0) +  -- 0-5 points
                 (urgency_boost * 3.0) -     -- 0-3 points
                 (risk_penalty * 3.0);       -- 0-3 penalty
  
  -- Cap bonus between -3 and +10 points
  final_bonus := GREATEST(-3.0, LEAST(10.0, final_bonus));
  
  RETURN final_bonus;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update trigger function to use additive formula
CREATE OR REPLACE FUNCTION update_enhanced_god_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate psychological bonus (ADDITIVE, not multiplicative)
  NEW.psychological_bonus := calculate_psychological_bonus(NEW.id);
  
  -- Calculate enhanced score using ADDITION (capped at 100)
  NEW.enhanced_god_score := LEAST(100, ROUND(NEW.total_god_score + NEW.psychological_bonus));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update view to use new column name
DROP VIEW IF EXISTS hot_startups_with_signals;
CREATE OR REPLACE VIEW hot_startups_with_signals AS
SELECT 
  s.id,
  s.name,
  s.total_god_score,
  s.enhanced_god_score,
  s.psychological_bonus,  -- Changed from psychological_multiplier
  s.is_oversubscribed,
  s.has_followon,
  s.is_competitive,
  s.is_bridge_round,
  s.status,
  s.created_at,
  COUNT(ps.id) AS signal_count
FROM startup_uploads s
LEFT JOIN psychological_signals ps ON ps.startup_id = s.id
WHERE s.status = 'approved'
  AND s.enhanced_god_score > s.total_god_score  -- Only startups with psychological boost
GROUP BY s.id, s.name, s.total_god_score, s.enhanced_god_score, 
         s.psychological_bonus, s.is_oversubscribed, s.has_followon,
         s.is_competitive, s.is_bridge_round, s.status, s.created_at
ORDER BY s.enhanced_god_score DESC;

-- Step 7: Recalculate all enhanced scores with correct additive formula
UPDATE startup_uploads
SET enhanced_god_score = LEAST(100, ROUND(total_god_score + COALESCE(psychological_bonus, 0)))
WHERE total_god_score IS NOT NULL;

-- Step 8: Log migration
DO $$
BEGIN
  RAISE NOTICE '✅ CORRECTED: Psychological signals now use ADDITIVE formula (base + bonus)';
  RAISE NOTICE '   OLD (WRONG): enhanced = base × multiplier (84 × 1.35 = 113)';
  RAISE NOTICE '   NEW (CORRECT): enhanced = base + bonus (84 + 6 = 90)';
  RAISE NOTICE '   Column renamed: psychological_multiplier → psychological_bonus';
  RAISE NOTICE '   Function updated: calculate_psychological_bonus() now returns -3 to +10 points';
  RAISE NOTICE '   All enhanced_god_score values recalculated with additive formula';
END $$;
