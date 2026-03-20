-- Drop any existing views that might conflict
DROP VIEW IF EXISTS hot_startups_with_signals CASCADE;
DROP VIEW IF EXISTS sector_momentum_trend CASCADE;

-- Drop the old functions if they exist
DROP FUNCTION IF EXISTS calculate_psychological_multiplier(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_enhanced_god_score() CASCADE;

-- Drop the trigger only if startup_uploads exists (table may not exist in fresh/local setups)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'startup_uploads') THEN
    DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
  END IF;
END $$;

-- Now you can safely apply the main migration:
-- Copy and paste the contents of 20260212_psychological_signals.sql into Supabase SQL Editor
