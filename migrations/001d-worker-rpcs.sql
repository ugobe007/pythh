-- ====================================================================
-- PART 4: WORKER RPC FUNCTIONS (Run after Part 3)
-- ====================================================================

-- Get match run status
CREATE OR REPLACE FUNCTION get_match_run(input_run_id uuid)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  startup_name text,
  canonical_url text,
  status match_run_status,
  step match_run_step,
  match_count int,
  error_code text,
  error_message text,
  created_at timestamptz,
  updated_at timestamptz,
  matches jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run record;
  v_matches jsonb;
BEGIN
  SELECT * INTO v_run
  FROM match_runs mr
  WHERE mr.run_id = input_run_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      input_run_id,
      NULL::uuid,
      NULL::text,
      NULL::text,
      'error'::match_run_status,
      'resolve'::match_run_step,
      0,
      'RUN_NOT_FOUND'::text,
      'Match run does not exist'::text,
      now(),
      now(),
      '[]'::jsonb;
    RETURN;
  END IF;
  
  IF v_run.status = 'ready' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'investor_id', m.investor_id,
        'investor_name', m.investor_name,
        'firm', m.firm,
        'match_score', m.match_score,
        'sectors', m.sectors,
        'stage', m.stage,
        'check_size_min', m.check_size_min,
        'check_size_max', m.check_size_max
      )
    ) INTO v_matches
    FROM get_top_matches(v_run.startup_id, 200) m;
  ELSE
    v_matches := '[]'::jsonb;
  END IF;
  
  RETURN QUERY SELECT
    v_run.run_id,
    v_run.startup_id,
    su.name AS startup_name,
    v_run.canonical_url,
    v_run.status,
    v_run.step,
    v_run.match_count,
    v_run.error_code,
    v_run.error_message,
    v_run.created_at,
    v_run.updated_at,
    COALESCE(v_matches, '[]'::jsonb)
  FROM startup_uploads su
  WHERE su.id = v_run.startup_id;
END;
$$;

-- Claim next run (worker coordination)
CREATE OR REPLACE FUNCTION claim_next_match_run(worker_id text)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  canonical_url text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run record;
BEGIN
  SELECT * INTO v_run
  FROM match_runs
  WHERE status = 'queued'
    AND (locked_by IS NULL OR lock_expires_at < now())
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  UPDATE match_runs
  SET
    status = 'processing',
    locked_by = worker_id,
    lock_expires_at = now() + interval '5 minutes',
    updated_at = now()
  WHERE match_runs.run_id = v_run.run_id;
  
  RETURN QUERY SELECT
    v_run.run_id,
    v_run.startup_id,
    v_run.canonical_url;
END;
$$;

-- Complete match run
CREATE OR REPLACE FUNCTION complete_match_run(
  input_run_id uuid,
  final_status match_run_status,
  final_match_count int DEFAULT 0,
  final_error_code text DEFAULT NULL,
  final_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE match_runs
  SET
    status = final_status,
    step = 'finalize',
    match_count = final_match_count,
    error_code = final_error_code,
    error_message = final_error_message,
    locked_by = NULL,
    lock_expires_at = NULL,
    updated_at = now()
  WHERE run_id = input_run_id;
  
  RETURN FOUND;
END;
$$;

-- ====================================================================
-- DEBUG RPC (Development/Troubleshooting)
-- ====================================================================

CREATE OR REPLACE FUNCTION get_match_run_debug(input_run_id uuid)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  input_url text,
  canonical_url text,
  status match_run_status,
  step match_run_step,
  match_count int,
  locked_by text,
  lock_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  age_seconds int,
  lease_expired boolean,
  is_stuck boolean
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.run_id,
    mr.startup_id,
    mr.input_url,
    mr.canonical_url,
    mr.status,
    mr.step,
    mr.match_count,
    mr.locked_by,
    mr.lock_expires_at,
    mr.created_at,
    mr.updated_at,
    EXTRACT(EPOCH FROM (now() - mr.created_at))::int AS age_seconds,
    (mr.lock_expires_at < now()) AS lease_expired,
    (mr.status = 'processing' AND mr.lock_expires_at < now()) AS is_stuck
  FROM match_runs mr
  WHERE mr.run_id = input_run_id;
END;
$$;
