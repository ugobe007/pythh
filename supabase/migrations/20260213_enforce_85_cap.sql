-- Enforce 85 cap on enhanced_god_score by including all bonuses
-- Current issue: Trigger only considers total_god_score + psychological bonus
-- Should be: total_god_score + signals_bonus + psychological bonus, capped at 85

CREATE OR REPLACE FUNCTION update_enhanced_god_score()
RETURNS TRIGGER AS $$
DECLARE
  psych_value DECIMAL(4,2);
  signals_value DECIMAL(5,2);
BEGIN
  -- Call the time-decay-enabled function (from 20260212_add_signal_decay.sql)
  psych_value := calculate_psychological_multiplier(NEW.id);
  
  -- Get signals_bonus (Phase 1 signals)
  signals_value := COALESCE(NEW.signals_bonus, 0);
  
  -- Set the psychological_multiplier column
  NEW.psychological_multiplier := psych_value;
  
  -- Calculate enhanced score: base + signals + psychological, CAPPED AT 85
  -- Note: psychological_multiplier is on 0-1 scale, multiply by 10 to get pts
  -- This ensures even high base scores (85+) are capped at 85 enhanced
  NEW.enhanced_god_score := LEAST(85, ROUND(NEW.total_god_score + signals_value + (psych_value * 10)));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
CREATE TRIGGER trigger_update_enhanced_god_score
  BEFORE INSERT OR UPDATE OF total_god_score, signals_bonus, is_oversubscribed, has_followon, is_competitive, is_bridge_round
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_enhanced_god_score();

COMMENT ON FUNCTION update_enhanced_god_score() IS 
'Trigger function that calculates enhanced_god_score = min(85, total_god_score + signals_bonus + psychological_bonus)';

DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced score cap enforcement updated';
  RAISE NOTICE '   Formula: min(85, base + signals + psychological)';
  RAISE NOTICE '   All startups capped at 85 max, regardless of base score';
  RAISE NOTICE '';
  RAISE NOTICE '💡 TIP: Trigger updates on startups with enhanced > 85';
END $$;
