-- ============================================================================
-- PIPELINE DIAGNOSTIC RPC
-- ============================================================================
-- Creates a production-ready RPC for diagnosing pipeline state.
-- Use this instead of pasting SQL files when debugging in production.
--
-- Usage:
--   SELECT * FROM diagnose_pipeline('a77fa91a-8b14-4fa6-9c3c-b2d7589a8bc4');
--
-- Returns:
--   - startup_id: The startup being diagnosed
--   - queue_status: Current queue state (or 'not_queued')
--   - queue_attempts: How many times queue processor tried
--   - queue_updated_at: Last queue update timestamp
--   - last_error: Most recent queue error (if any)
--   - match_count: Total matches in database
--   - active_match_count: Matches with active investors
--   - last_match_at: When last match was created
--   - system_state: 'ready', 'matching', or 'needs_queue'
--   - diagnosis: Human-readable explanation
-- ============================================================================

CREATE OR REPLACE FUNCTION diagnose_pipeline(p_startup_id uuid)
RETURNS TABLE(
  startup_id uuid,
  queue_status text,
  queue_attempts int,
  queue_updated_at timestamptz,
  last_error text,
  match_count bigint,
  active_match_count bigint,
  last_match_at timestamptz,
  system_state text,
  diagnosis text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_queue_status text;
  v_queue_attempts int;
  v_queue_updated_at timestamptz;
  v_last_error text;
  v_match_count bigint;
  v_active_match_count bigint;
  v_last_match_at timestamptz;
  v_system_state text;
  v_diagnosis text;
BEGIN
  -- Get queue state (if exists)
  SELECT 
    q.status,
    q.attempts,
    q.updated_at,
    q.last_error
  INTO 
    v_queue_status,
    v_queue_attempts,
    v_queue_updated_at,
    v_last_error
  FROM public.match_generation_queue q
  WHERE q.startup_id = p_startup_id
  ORDER BY q.updated_at DESC
  LIMIT 1;
  
  -- Get match counts
  SELECT 
    COUNT(*),
    MAX(sim.created_at)
  INTO 
    v_match_count,
    v_last_match_at
  FROM public.startup_investor_matches sim
  WHERE sim.startup_id = p_startup_id;
  
  -- Get active investor match count
  SELECT COUNT(*)
  INTO v_active_match_count
  FROM public.startup_investor_matches sim
  JOIN public.investors i ON i.id = sim.investor_id
  WHERE sim.startup_id = p_startup_id
    AND i.status = 'active';
  
  -- Compute system state
  v_match_count := COALESCE(v_match_count, 0);
  v_active_match_count := COALESCE(v_active_match_count, 0);
  v_queue_status := COALESCE(v_queue_status, 'not_queued');
  v_queue_attempts := COALESCE(v_queue_attempts, 0);
  
  -- Determine state and diagnosis
  IF v_match_count >= 1000 THEN
    v_system_state := 'ready';
    v_diagnosis := format('Ready to display (%s matches, %s active)', v_match_count, v_active_match_count);
  ELSIF v_queue_status IN ('pending', 'processing') THEN
    v_system_state := 'matching';
    v_diagnosis := format('Queue processing (status: %s, attempt: %s, matches: %s/1000)', 
                         v_queue_status, v_queue_attempts, v_match_count);
  ELSIF v_match_count > 0 THEN
    v_system_state := 'partial';
    v_diagnosis := format('Partial matches (%s/1000), queue may have failed', v_match_count);
  ELSE
    v_system_state := 'needs_queue';
    v_diagnosis := 'No matches and no active queue item - needs enqueue';
  END IF;
  
  -- Return single row
  RETURN QUERY SELECT
    p_startup_id,
    v_queue_status,
    v_queue_attempts,
    v_queue_updated_at,
    v_last_error,
    v_match_count,
    v_active_match_count,
    v_last_match_at,
    v_system_state,
    v_diagnosis;
END;
$$;

-- Grant execute to anon/authenticated for debugging
GRANT EXECUTE ON FUNCTION diagnose_pipeline(uuid) TO anon, authenticated;

COMMENT ON FUNCTION diagnose_pipeline IS 'Production diagnostic for pipeline state - shows queue status, match counts, and recommended action';
