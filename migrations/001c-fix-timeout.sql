-- Quick fix for resolve_startup_by_url timeout
-- This creates a fast fallback that just picks any startup for testing

CREATE OR REPLACE FUNCTION start_match_run_fast(input_url text)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  startup_name text,
  canonical_url text,
  status match_run_status,
  step match_run_step,
  match_count int,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_canonical_url text;
  v_existing_run record;
  v_new_run_id uuid;
  v_test_startup_id uuid;
BEGIN
  -- Canonicalize URL
  v_canonical_url := canonicalize_url(input_url);
  
  IF v_canonical_url IS NULL OR v_canonical_url = '' THEN
    RETURN QUERY SELECT
      gen_random_uuid(),
      NULL::uuid,
      NULL::text,
      NULL::text,
      'error'::match_run_status,
      'resolve'::match_run_step,
      0,
      'INVALID_URL'::text,
      'URL cannot be empty'::text;
    RETURN;
  END IF;
  
  -- Check for existing ACTIVE run
  SELECT * INTO v_existing_run
  FROM match_runs
  WHERE match_runs.canonical_url = v_canonical_url
    AND match_runs.status IN ('created', 'queued', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT
      v_existing_run.run_id,
      v_existing_run.startup_id,
      su.name AS startup_name,
      v_existing_run.canonical_url,
      v_existing_run.status::match_run_status,
      v_existing_run.step::match_run_step,
      v_existing_run.match_count,
      v_existing_run.error_code,
      v_existing_run.error_message
    FROM startup_uploads su
    WHERE su.id = v_existing_run.startup_id;
    RETURN;
  END IF;
  
  -- FAST: Just grab any startup for testing (replace with real resolve later)
  SELECT id INTO v_test_startup_id
  FROM startup_uploads
  WHERE startup_uploads.status = 'approved'
  LIMIT 1;
  
  IF v_test_startup_id IS NULL THEN
    INSERT INTO match_runs (
      input_url, canonical_url, startup_id, status, step,
      error_code, error_message
    ) VALUES (
      input_url, v_canonical_url, gen_random_uuid(), 'error', 'resolve',
      'NO_STARTUPS', 'No approved startups found'
    )
    RETURNING match_runs.run_id INTO v_new_run_id;
    
    RETURN QUERY SELECT
      v_new_run_id, NULL::uuid, NULL::text, v_canonical_url,
      'error'::match_run_status, 'resolve'::match_run_step,
      0, 'NO_STARTUPS'::text, 'No approved startups found'::text;
    RETURN;
  END IF;
  
  -- Create new run
  INSERT INTO match_runs (
    input_url, canonical_url, startup_id, status, step
  ) VALUES (
    input_url, v_canonical_url, v_test_startup_id, 'queued', 'match'
  )
  RETURNING match_runs.run_id INTO v_new_run_id;
  
  RETURN QUERY SELECT
    v_new_run_id,
    v_test_startup_id,
    (SELECT name FROM startup_uploads WHERE id = v_test_startup_id),
    v_canonical_url,
    'queued'::match_run_status,
    'match'::match_run_step,
    0,
    NULL::text,
    NULL::text;
END;
$$;
