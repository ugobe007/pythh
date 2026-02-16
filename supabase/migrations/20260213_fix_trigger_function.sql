-- Fix trigger to use correct function and column names
-- The trigger was calling calculate_psychological_bonus() with psychological_bonus column
-- But we're using calculate_psychological_multiplier() with psychological_multiplier column

-- Update the trigger function to use the correct names
CREATE OR REPLACE FUNCTION update_enhanced_god_score()
RETURNS TRIGGER AS $$
DECLARE
  psych_value DECIMAL(4,2);
BEGIN
  -- Call the time-decay-enabled function (from 20260212_add_signal_decay.sql)
  psych_value := calculate_psychological_multiplier(NEW.id);
  
  -- Set the psychological_multiplier column (not psychological_bonus)
  NEW.psychological_multiplier := psych_value;
  
  -- Calculate enhanced score using ADDITION
  -- Note: psychological_multiplier is on 0-1 scale, multiply by 10 to get pts
  NEW.enhanced_god_score := LEAST(85, ROUND(NEW.total_god_score + (psych_value * 10)));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
CREATE TRIGGER trigger_update_enhanced_god_score
  BEFORE INSERT OR UPDATE OF total_god_score, is_oversubscribed, has_followon, is_competitive, is_bridge_round
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_enhanced_god_score();

-- Add comment
COMMENT ON FUNCTION update_enhanced_god_score() IS 
'Trigger function that calls calculate_psychological_multiplier() with time decay and sets psychological_multiplier column';

-- Show validation
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger function updated to use:';
  RAISE NOTICE '   - Function: calculate_psychological_multiplier() (with time decay)';
  RAISE NOTICE '   - Column: psychological_multiplier';
  RAISE NOTICE '   - Enhanced cap: 85';
  RAISE NOTICE '';
  RAISE NOTICE '💡 TIP: Update a startup to trigger recalculation:';
  RAISE NOTICE '   UPDATE startup_uploads SET total_god_score = total_god_score WHERE id = <startup_id>;';
END $$;
