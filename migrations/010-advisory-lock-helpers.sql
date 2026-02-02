-- Migration 010: Advisory Lock Helper Functions
-- Purpose: Integer-based advisory locks for worker process coordination
-- Prevents duplicate worker execution (34 rogue processes never again!)

-- Try to acquire an advisory lock using a bigint key
-- Returns true if lock acquired, false if already held
CREATE OR REPLACE FUNCTION try_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_key);
END;
$$;

-- Release an advisory lock using a bigint key
-- Returns true if lock was released, false if not held
CREATE OR REPLACE FUNCTION release_advisory_lock(lock_key bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_key);
END;
$$;

-- Grant execute to service role (used by workers)
GRANT EXECUTE ON FUNCTION try_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION release_advisory_lock(bigint) TO service_role;

-- Also grant to authenticated/anon for completeness
GRANT EXECUTE ON FUNCTION try_advisory_lock(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION release_advisory_lock(bigint) TO anon;

-- Test the functions work correctly
DO $$
DECLARE
  lock_acquired boolean;
  lock_released boolean;
  test_key bigint := 999999999;  -- Unique test key
BEGIN
  -- Should acquire successfully
  SELECT try_advisory_lock(test_key) INTO lock_acquired;
  IF NOT lock_acquired THEN
    RAISE EXCEPTION 'Failed to acquire test lock';
  END IF;
  
  -- Should fail (already held)
  SELECT try_advisory_lock(test_key) INTO lock_acquired;
  IF lock_acquired THEN
    RAISE EXCEPTION 'Lock should not be acquired twice in same session';
  END IF;
  
  -- Should release successfully
  SELECT release_advisory_lock(test_key) INTO lock_released;
  IF NOT lock_released THEN
    RAISE EXCEPTION 'Failed to release test lock';
  END IF;
  
  -- Should acquire again after release
  SELECT try_advisory_lock(test_key) INTO lock_acquired;
  IF NOT lock_acquired THEN
    RAISE EXCEPTION 'Failed to re-acquire test lock';
  END IF;
  
  -- Clean up
  PERFORM release_advisory_lock(test_key);
  
  RAISE NOTICE 'Advisory lock functions validated successfully ✅';
END;
$$;
