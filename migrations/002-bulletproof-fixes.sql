-- ====================================================================
-- BULLETPROOF FIXES - Part 1: Function fix (run this first)
-- ====================================================================

-- Fix claim_next_match_run to be ATOMIC (UPDATE + RETURNING)
-- Drop both possible existing versions
DROP FUNCTION IF EXISTS claim_next_match_run(text);
DROP FUNCTION IF EXISTS claim_next_match_run(text, int);

-- Create new version with lease_seconds parameter
CREATE FUNCTION claim_next_match_run(worker_id text, lease_seconds int DEFAULT 300)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  input_url text,
  canonical_url text,
  status match_run_status,
  step match_run_step,
  match_count int,
  error_code text,
  error_message text,
  locked_by text,
  lock_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  -- Find an eligible run and lock it atomically
  SELECT mr.run_id
  INTO v_run_id
  FROM match_runs mr
  WHERE mr.status = 'queued'
    AND (mr.lock_expires_at IS NULL OR mr.lock_expires_at < now())
  ORDER BY mr.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_run_id IS NULL THEN
    RETURN;
  END IF;

  -- Atomically mark it claimed and return the row
  RETURN QUERY
  UPDATE match_runs mr
  SET status = 'processing',
      locked_by = worker_id,
      lock_expires_at = now() + (lease_seconds || ' seconds')::interval,
      updated_at = now()
  WHERE mr.run_id = v_run_id
  RETURNING 
    mr.run_id,
    mr.startup_id,
    mr.input_url,
    mr.canonical_url,
    mr.status,
    mr.step,
    mr.match_count,
    mr.error_code,
    mr.error_message,
    mr.locked_by,
    mr.lock_expires_at,
    mr.created_at,
    mr.updated_at;
END $$;

COMMENT ON FUNCTION claim_next_match_run IS 'Atomically claims next queued run. Returns empty if no work available.';
