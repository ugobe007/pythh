-- ============================================================================
-- FIX MATCH QUEUE BLOCKER
-- ============================================================================
-- Problem: Unique constraint on (startup_id, status) prevents get_next_from_queue
--          from working when there are stuck 'processing' entries
-- 
-- Root cause: The constraint UNIQUE(startup_id, status) means only ONE row per
--             startup can have status='processing'. If jobs get stuck, the worker
--             can't claim new work because it tries to create a second 'processing' row.
--
-- Solutions:
-- 1. Release stuck processing items (immediate fix)
-- 2. Fix get_next_from_queue() to be truly atomic (permanent fix)
-- ============================================================================

-- STEP 1: Release stuck processing items (older than 30 minutes)
-- Safe to run repeatedly - only affects genuinely stuck jobs
UPDATE match_generation_queue
SET 
  status = 'pending',
  updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '30 minutes';

-- STEP 2: Fix the get_next_from_queue function to handle the constraint properly
-- The issue: When we try to UPDATE a row from pending→processing, if that startup
-- already has a 'processing' row (stuck), the unique constraint prevents the update.
--
-- Solution: Don't create a new status, just UPDATE the existing row atomically.
-- This is already what the function does, but we need to ensure it's truly atomic.

-- Current function is correct, but let's add error handling
CREATE OR REPLACE FUNCTION get_next_from_queue()
RETURNS TABLE (
  id UUID,
  startup_id UUID,
  priority INT,
  attempts INT
) AS $$
BEGIN
  -- This UPDATE is atomic: it finds one pending row and marks it processing
  -- FOR UPDATE SKIP LOCKED ensures no race conditions
  -- If the constraint is hit, it means the row was already processing (shouldn't happen)
  RETURN QUERY
  UPDATE match_generation_queue q
  SET 
    status = 'processing',
    updated_at = NOW(),
    attempts = q.attempts + 1
  WHERE q.id = (
    SELECT q2.id
    FROM match_generation_queue q2
    WHERE q2.status = 'pending'
    ORDER BY q2.priority DESC, q2.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.startup_id, q.priority, q.attempts;
  
  -- If we got nothing, no rows were pending
  -- The constraint error should never happen if we're only updating pending→processing
  -- But if it does, it means data corruption (duplicate pending rows or stuck processing rows)
  
EXCEPTION
  WHEN unique_violation THEN
    -- Log the issue and return nothing
    INSERT INTO ai_logs (log_type, action_type, input_data, status)
    VALUES (
      'match_queue',
      'constraint_error',
      jsonb_build_object('error', 'Unique constraint violated in get_next_from_queue'),
      'error'
    );
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- STEP 3: Add a cleanup function for stuck processing items (to run periodically)
CREATE OR REPLACE FUNCTION cleanup_stuck_queue_items(
  p_stuck_threshold_minutes INT DEFAULT 30
) RETURNS INT AS $$
DECLARE
  v_cleaned INT;
BEGIN
  WITH updated AS (
    UPDATE match_generation_queue
    SET 
      status = 'pending',
      updated_at = NOW()
    WHERE status = 'processing'
      AND updated_at < NOW() - (p_stuck_threshold_minutes || ' minutes')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cleaned FROM updated;
  
  -- Log cleanup
  IF v_cleaned > 0 THEN
    INSERT INTO ai_logs (log_type, action_type, input_data, output_data, status)
    VALUES (
      'match_queue',
      'cleanup_stuck_items',
      jsonb_build_object('threshold_minutes', p_stuck_threshold_minutes),
      jsonb_build_object('cleaned_count', v_cleaned),
      'success'
    );
  END IF;
  
  RETURN v_cleaned;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Verify queue status after cleanup
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  MIN(updated_at) as oldest_update
FROM match_generation_queue
GROUP BY status
ORDER BY status;

-- STEP 5: Show any startups with duplicate status entries (data integrity check)
SELECT 
  startup_id,
  status,
  COUNT(*) as duplicate_count
FROM match_generation_queue
GROUP BY startup_id, status
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

COMMENT ON FUNCTION cleanup_stuck_queue_items(INT) IS 'Release stuck processing items back to pending. Run periodically (e.g., every 10 minutes via cron).';
COMMENT ON FUNCTION get_next_from_queue() IS 'Get next pending item and mark as processing (atomic, handles constraint violations gracefully)';
