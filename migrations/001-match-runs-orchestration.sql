-- ====================================================================
-- BULLETPROOF MATCHING ENGINE V1 - SURGICAL ADD-ONLY MIGRATION
-- ====================================================================
-- Pattern A: Read-only wrapper around existing 4.1M matches
-- No ALTER TABLE on existing tables. No writes to startup_investor_matches.
-- Pure PostgreSQL enums + PL/pgSQL functions + lease-based coordination.
-- ====================================================================

-- ====================================================================
-- 1. ENUMS (Status state machine)
-- ====================================================================

CREATE TYPE match_run_status AS ENUM (
  'created',      -- Run initiated, not yet queued
  'queued',       -- Waiting for worker pickup
  'processing',   -- Worker actively processing
  'ready',        -- Matches ready for display
  'error'         -- Failed with error
);

CREATE TYPE match_run_step AS ENUM (
  'resolve',      -- URL → startup_id resolution
  'extract',      -- (Reserved for future: extract startup data)
  'parse',        -- (Reserved for future: parse structured data)
  'match',        -- Query existing matches from startup_investor_matches
  'rank',         -- Sort by match_score desc
  'finalize'      -- Mark ready
);

-- ====================================================================
-- 2. ORCHESTRATION TABLE (Single Source of Truth)
-- ====================================================================

CREATE TABLE match_runs (
  -- Identity
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,  -- FK to startup_uploads(id)
  input_url text NOT NULL,
  canonical_url text,
  
  -- Status (state machine)
  status match_run_status NOT NULL DEFAULT 'created',
  step match_run_step NOT NULL DEFAULT 'resolve',
  
  -- Results
  match_count int NOT NULL DEFAULT 0,
  error_code text,           -- e.g., 'RESOLVE_FAILED', 'NO_MATCHES_FOUND'
  error_message text,
  
  -- Worker coordination (lease-based)
  locked_by text,            -- worker_id (e.g., 'edge-function-xyz', 'cron-worker-1')
  lock_expires_at timestamptz,
  
  -- Metadata
  engine_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT match_runs_startup_fk FOREIGN KEY (startup_id) 
    REFERENCES startup_uploads(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_match_runs_startup ON match_runs(startup_id);
CREATE INDEX idx_match_runs_status ON match_runs(status);
CREATE INDEX idx_match_runs_created ON match_runs(created_at DESC);
CREATE INDEX idx_match_runs_lease ON match_runs(status, lock_expires_at) 
  WHERE status = 'queued';  -- Fast worker pickup

-- Unique constraint: one active run per URL
CREATE UNIQUE INDEX idx_match_runs_active_url 
  ON match_runs(input_url) 
  WHERE status IN ('created', 'queued', 'processing');

-- ====================================================================
-- 3. UTILITY FUNCTION: URL Canonicalization
-- ====================================================================

CREATE OR REPLACE FUNCTION canonicalize_url(input_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF input_url IS NULL OR input_url = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove whitespace, convert to lowercase
  cleaned := lower(trim(input_url));
  
  -- Remove protocol (http://, https://)
  cleaned := regexp_replace(cleaned, '^https?://', '', 'i');
  
  -- Remove www. prefix
  cleaned := regexp_replace(cleaned, '^www\.', '', 'i');
  
  -- Remove trailing slash
  cleaned := regexp_replace(cleaned, '/$', '');
  
  -- Remove query params and fragments
  cleaned := regexp_replace(cleaned, '[?#].*$', '');
  
  RETURN cleaned;
END;
$$;

-- ====================================================================
-- 4. RPC: start_match_run (Idempotent)
-- ====================================================================
-- Creates or reuses existing active match run for a URL.
-- Returns run_id immediately so frontend can poll for status.
-- ====================================================================

CREATE OR REPLACE FUNCTION start_match_run(input_url text)
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
  v_resolved record;
  v_new_run_id uuid;
BEGIN
  -- 1. Canonicalize input URL
  v_canonical_url := canonicalize_url(input_url);
  
  IF v_canonical_url IS NULL OR v_canonical_url = '' THEN
    -- Return error row
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
  
  -- 2. Check for existing active run (idempotency)
  SELECT * INTO v_existing_run
  FROM match_runs
  WHERE match_runs.input_url = start_match_run.input_url
    AND status IN ('created', 'queued', 'processing', 'ready')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    -- Reuse existing run (idempotent)
    RETURN QUERY SELECT
      v_existing_run.run_id,
      v_existing_run.startup_id,
      su.name AS startup_name,
      v_existing_run.canonical_url,
      v_existing_run.status,
      v_existing_run.step,
      v_existing_run.match_count,
      v_existing_run.error_code,
      v_existing_run.error_message
    FROM startup_uploads su
    WHERE su.id = v_existing_run.startup_id;
    RETURN;
  END IF;
  
  -- 3. Resolve URL to startup_id (using existing RPC)
  SELECT * INTO v_resolved
  FROM resolve_startup_by_url(start_match_run.input_url)
  LIMIT 1;
  
  IF NOT FOUND OR NOT v_resolved.resolved THEN
    -- Create error run
    INSERT INTO match_runs (
      input_url,
      canonical_url,
      startup_id,
      status,
      step,
      error_code,
      error_message
    ) VALUES (
      start_match_run.input_url,
      v_canonical_url,
      gen_random_uuid(),  -- Dummy ID (FK requires non-null)
      'error',
      'resolve',
      'RESOLVE_FAILED',
      'Startup not found in database'
    )
    RETURNING match_runs.run_id INTO v_new_run_id;
    
    RETURN QUERY SELECT
      v_new_run_id,
      NULL::uuid,
      NULL::text,
      v_canonical_url,
      'error'::match_run_status,
      'resolve'::match_run_step,
      0,
      'RESOLVE_FAILED'::text,
      'Startup not found in database'::text;
    RETURN;
  END IF;
  
  -- 4. Create new run (queued for worker pickup)
  INSERT INTO match_runs (
    input_url,
    canonical_url,
    startup_id,
    status,
    step
  ) VALUES (
    start_match_run.input_url,
    v_canonical_url,
    v_resolved.startup_id,
    'queued',
    'match'
  )
  RETURNING match_runs.run_id INTO v_new_run_id;
  
  -- 5. Return new run details
  RETURN QUERY SELECT
    v_new_run_id,
    v_resolved.startup_id,
    v_resolved.startup_name,
    v_canonical_url,
    'queued'::match_run_status,
    'match'::match_run_step,
    0,
    NULL::text,
    NULL::text;
END;
$$;

-- ====================================================================
-- 5. RPC: get_match_run (Status polling)
-- ====================================================================
-- Returns current status of a match run + top matches if ready.
-- ====================================================================

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
  matches jsonb  -- Top 200 matches if status='ready'
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run record;
  v_matches jsonb;
BEGIN
  -- 1. Fetch run details
  SELECT * INTO v_run
  FROM match_runs mr
  WHERE mr.run_id = input_run_id;
  
  IF NOT FOUND THEN
    -- Return error row
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
  
  -- 2. If status='ready', fetch top matches using existing RPC
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
  
  -- 3. Return run + matches
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

-- ====================================================================
-- 6. RPC: claim_next_match_run (Worker coordination)
-- ====================================================================
-- Lease-based: worker claims next queued run with 5-minute lease.
-- Returns NULL if no work available.
-- ====================================================================

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
  -- 1. Find next available run (with FOR UPDATE SKIP LOCKED for concurrency)
  SELECT * INTO v_run
  FROM match_runs
  WHERE status = 'queued'
    AND (locked_by IS NULL OR lock_expires_at < now())
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF NOT FOUND THEN
    RETURN;  -- No work available
  END IF;
  
  -- 2. Claim the run (5-minute lease)
  UPDATE match_runs
  SET
    status = 'processing',
    locked_by = worker_id,
    lock_expires_at = now() + interval '5 minutes',
    updated_at = now()
  WHERE match_runs.run_id = v_run.run_id;
  
  -- 3. Return claimed run
  RETURN QUERY SELECT
    v_run.run_id,
    v_run.startup_id,
    v_run.canonical_url;
END;
$$;

-- ====================================================================
-- 7. RPC: complete_match_run (Worker completion)
-- ====================================================================
-- Worker calls this after processing to mark run as ready or error.
-- ====================================================================

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
-- 8. TRIGGER: Auto-update updated_at timestamp
-- ====================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER match_runs_updated_at
  BEFORE UPDATE ON match_runs
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- ====================================================================
-- 9. CLEANUP: Release expired leases (run via cron)
-- ====================================================================

CREATE OR REPLACE FUNCTION release_expired_leases()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_released_count int;
BEGIN
  UPDATE match_runs
  SET
    status = 'queued',
    locked_by = NULL,
    lock_expires_at = NULL,
    updated_at = now()
  WHERE status = 'processing'
    AND lock_expires_at < now();
  
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$$;

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================
-- Next steps:
-- 1. Create API routes: POST /api/match/run, GET /api/match/run/:runId
-- 2. Create worker (cron or Edge Function) that calls:
--    - claim_next_match_run(worker_id)
--    - count_matches(startup_id)
--    - complete_match_run(run_id, 'ready', count)
-- 3. Frontend polls GET /api/match/run/:runId every 2s until status='ready'
-- ====================================================================
