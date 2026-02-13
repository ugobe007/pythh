-- ===========================================================================
-- ADD TIME DECAY TO PSYCHOLOGICAL SIGNALS
-- ===========================================================================
-- Apply exponential decay based on signal age
-- Different signals have different half-lives (how fast they decay)

-- Drop and recreate the function with time decay
DROP FUNCTION IF EXISTS calculate_psychological_multiplier(UUID) CASCADE;

CREATE OR REPLACE FUNCTION calculate_psychological_multiplier(startup_uuid UUID)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  fomo_raw DECIMAL(3,2) := 0;
  conviction_raw DECIMAL(3,2) := 0;
  urgency_raw DECIMAL(3,2) := 0;
  risk_raw DECIMAL(3,2) := 0;
  
  fomo_age_days INT := 0;
  conviction_age_days INT := 0;
  urgency_age_days INT := 0;
  risk_age_days INT := 0;
  
  fomo_decayed DECIMAL(3,2) := 0;
  conviction_decayed DECIMAL(3,2) := 0;
  urgency_decayed DECIMAL(3,2) := 0;
  risk_decayed DECIMAL(3,2) := 0;
  
  final_bonus DECIMAL(4,2);
BEGIN
  -- Get latest signal of each type with age
  SELECT 
    COALESCE(MAX(CASE WHEN signal_type = 'oversubscription' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'oversubscription' THEN EXTRACT(DAY FROM NOW() - detected_at) END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'followon' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'followon' THEN EXTRACT(DAY FROM NOW() - detected_at) END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'competitive' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'competitive' THEN EXTRACT(DAY FROM NOW() - detected_at) END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'bridge' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'bridge' THEN EXTRACT(DAY FROM NOW() - detected_at) END), 0)
  INTO fomo_raw, fomo_age_days, conviction_raw, conviction_age_days,
       urgency_raw, urgency_age_days, risk_raw, risk_age_days
  FROM psychological_signals
  WHERE startup_id = startup_uuid;
  
  -- Apply exponential decay: decayed_strength = raw_strength × 0.5^(age_days / half_life_days)
  -- Half-lives tuned to investor psychology:
  --   FOMO: 30 days (news cycles fast, FOMO window short)
  --   Conviction: 90 days (insider info stays relevant longer)
  --   Urgency: 14 days (competitive dynamics shift quickly)
  --   Risk: 45 days (bridge concerns fade if startup recovers)
  
  -- FOMO decay (30-day half-life)
  IF fomo_raw > 0 THEN
    fomo_decayed := fomo_raw * POWER(0.5, fomo_age_days::DECIMAL / 30.0);
  END IF;
  
  -- Conviction decay (90-day half-life)
  IF conviction_raw > 0 THEN
    conviction_decayed := conviction_raw * POWER(0.5, conviction_age_days::DECIMAL / 90.0);
  END IF;
  
  -- Urgency decay (14-day half-life)
  IF urgency_raw > 0 THEN
    urgency_decayed := urgency_raw * POWER(0.5, urgency_age_days::DECIMAL / 14.0);
  END IF;
  
  -- Risk decay (45-day half-life)
  IF risk_raw > 0 THEN
    risk_decayed := risk_raw * POWER(0.5, risk_age_days::DECIMAL / 45.0);
  END IF;
  
  -- Calculate ADDITIVE bonus with decayed values
  -- Formula: 0 + (FOMO × 5pt) + (Conviction × 5pt) + (Urgency × 3pt) - (Risk × 3pt)
  -- Returns: -0.3 to +1.0 (on 0-10 scale)
  final_bonus := 0.0 + 
                 (fomo_decayed * 0.5) + 
                 (conviction_decayed * 0.5) + 
                 (urgency_decayed * 0.3) - 
                 (risk_decayed * 0.3);
  
  -- Cap bonus between -0.3 and +1.0 (on 0-10 scale)
  final_bonus := GREATEST(-0.3, LEAST(1.0, final_bonus));
  
  RETURN final_bonus;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (it references the function)
DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
CREATE TRIGGER trigger_update_enhanced_god_score
  BEFORE INSERT OR UPDATE OF total_god_score, is_oversubscribed, has_followon, is_competitive, is_bridge_round
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_enhanced_god_score();

-- Add comment
COMMENT ON FUNCTION calculate_psychological_multiplier(UUID) IS 
'Calculates additive bonus with exponential time decay. Half-lives: FOMO 30d, Conviction 90d, Urgency 14d, Risk 45d';

-- Validation examples
DO $$
DECLARE
  test_bonus DECIMAL(4,2);
BEGIN
  RAISE NOTICE '✅ Time decay enabled for psychological signals';
  RAISE NOTICE '';
  RAISE NOTICE 'Decay half-lives:';
  RAISE NOTICE '  🚀 FOMO (oversubscribed): 30 days';
  RAISE NOTICE '  💎 Conviction (follow-on): 90 days';
  RAISE NOTICE '  ⚡ Urgency (competitive): 14 days';
  RAISE NOTICE '  🌉 Risk (bridge): 45 days';
  RAISE NOTICE '';
  RAISE NOTICE 'Example decay curves:';
  RAISE NOTICE '  Signal strength 1.0 (100%%):';
  RAISE NOTICE '    - After 30 days: 50%% for FOMO, 81%% for Conviction';
  RAISE NOTICE '    - After 90 days: 12.5%% for FOMO, 50%% for Conviction';
  RAISE NOTICE '    - After 180 days: 1.6%% for FOMO, 25%% for Conviction';
  RAISE NOTICE '';
  RAISE NOTICE '💡 TIP: Run recalculate-scores.ts to apply decay to existing signals';
END $$;
