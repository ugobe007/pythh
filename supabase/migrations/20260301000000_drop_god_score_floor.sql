-- =============================================================================
-- Drop artificial GOD score floor (previously hard-coded at 40)
-- =============================================================================
-- Background: A DB trigger/constraint was added to prevent GOD scores below 40.
-- This creates false clustering: ~250 startups that honestly score 10–39 all
-- get bumped to 40, making them indistinguishable from genuinely mediocre ones.
-- The scoring algorithm already has a configurable baseBoostMinimum (currently 2.0)
-- which provides a calibrated floor for data-poor startups. The DB constraint
-- is redundant and corrupts the distribution.
-- =============================================================================

-- 1. Drop any CHECK constraints on total_god_score (handles various naming conventions)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'startup_uploads'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%total_god_score%'
        OR conname ILIKE '%god_score%'
        OR conname ILIKE '%score_floor%'
        OR conname ILIKE '%god_floor%'
      )
  LOOP
    EXECUTE format('ALTER TABLE startup_uploads DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE NOTICE 'Dropped constraint: %', r.conname;
  END LOOP;
END $$;

-- 2. Drop any triggers on startup_uploads that enforce a score floor
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'startup_uploads'
      AND event_object_schema = 'public'
      AND (
        trigger_name ILIKE '%god_score%'
        OR trigger_name ILIKE '%score_floor%'
        OR trigger_name ILIKE '%god_floor%'
        OR trigger_name ILIKE '%enforce%'
        OR trigger_name ILIKE '%minimum%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON startup_uploads', r.trigger_name);
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;

-- 3. Drop associated trigger functions (common naming patterns)
DROP FUNCTION IF EXISTS enforce_god_score_floor() CASCADE;
DROP FUNCTION IF EXISTS enforce_god_score_minimum() CASCADE;
DROP FUNCTION IF EXISTS god_score_floor_trigger() CASCADE;
DROP FUNCTION IF EXISTS set_god_score_floor() CASCADE;

-- 4. Add a sensible 0–100 range constraint (no artificial floor)
ALTER TABLE startup_uploads
  DROP CONSTRAINT IF EXISTS startup_uploads_god_score_range;

ALTER TABLE startup_uploads
  ADD CONSTRAINT startup_uploads_god_score_range
  CHECK (total_god_score IS NULL OR (total_god_score >= 0 AND total_god_score <= 100));
