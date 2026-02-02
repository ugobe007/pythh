-- Match Runs: Orchestration table for deterministic matching lifecycle
-- This is the SINGLE SOURCE OF TRUTH for all matching operations

CREATE TABLE IF NOT EXISTS match_runs (
  -- Identity
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  -- Lifecycle state (authoritative)
  status TEXT NOT NULL CHECK (status IN ('created', 'queued', 'processing', 'ready', 'error')),
  progress_step TEXT CHECK (progress_step IN ('resolve', 'extract', 'parse', 'match', 'rank', 'finalize')),
  
  -- Results
  match_count INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Worker coordination (lease-based locking)
  locked_by_worker TEXT,
  lock_expires_at TIMESTAMPTZ,
  
  -- Version for safe algorithm upgrades
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Debug context (JSON blob for observability)
  debug_context JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_match_runs_startup 
  ON match_runs(startup_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_runs_status 
  ON match_runs(status, updated_at DESC) 
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_match_runs_lease 
  ON match_runs(lock_expires_at) 
  WHERE status = 'processing' AND lock_expires_at IS NOT NULL;

-- Unique constraint: only one active run per startup at a time
-- "Active" = not in terminal state (ready/error)
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_runs_active_startup 
  ON match_runs(startup_id) 
  WHERE status IN ('created', 'queued', 'processing');

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_match_runs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Set completed_at when reaching terminal state
  IF NEW.status IN ('ready', 'error') AND OLD.status NOT IN ('ready', 'error') THEN
    NEW.completed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_runs_timestamp
  BEFORE UPDATE ON match_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_match_runs_timestamp();

-- Helper function: Get or create active run for startup
CREATE OR REPLACE FUNCTION get_or_create_match_run(p_startup_id UUID)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
BEGIN
  -- Try to find active run
  SELECT run_id INTO v_run_id
  FROM match_runs
  WHERE startup_id = p_startup_id
    AND status IN ('created', 'queued', 'processing')
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If none exists, create one
  IF v_run_id IS NULL THEN
    INSERT INTO match_runs (startup_id, status)
    VALUES (p_startup_id, 'created')
    RETURNING run_id INTO v_run_id;
  END IF;
  
  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Acquire worker lease (for distributed processing)
CREATE OR REPLACE FUNCTION acquire_match_run_lease(
  p_run_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_acquired BOOLEAN := FALSE;
BEGIN
  UPDATE match_runs
  SET 
    status = 'processing',
    locked_by_worker = p_worker_id,
    lock_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL
  WHERE run_id = p_run_id
    AND status IN ('created', 'queued', 'processing')
    AND (
      lock_expires_at IS NULL 
      OR lock_expires_at < NOW()
      OR locked_by_worker = p_worker_id
    )
  RETURNING TRUE INTO v_acquired;
  
  RETURN COALESCE(v_acquired, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Helper function: Extend lease (while worker is still processing)
CREATE OR REPLACE FUNCTION extend_match_run_lease(
  p_run_id UUID,
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_extended BOOLEAN := FALSE;
BEGIN
  UPDATE match_runs
  SET lock_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL
  WHERE run_id = p_run_id
    AND locked_by_worker = p_worker_id
    AND status = 'processing'
  RETURNING TRUE INTO v_extended;
  
  RETURN COALESCE(v_extended, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Helper function: Release lease and mark complete
CREATE OR REPLACE FUNCTION complete_match_run(
  p_run_id UUID,
  p_worker_id TEXT,
  p_match_count INTEGER,
  p_status TEXT DEFAULT 'ready'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE match_runs
  SET 
    status = p_status,
    match_count = p_match_count,
    locked_by_worker = NULL,
    lock_expires_at = NULL
  WHERE run_id = p_run_id
    AND locked_by_worker = p_worker_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Mark run as failed
CREATE OR REPLACE FUNCTION fail_match_run(
  p_run_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE match_runs
  SET 
    status = 'error',
    error_code = p_error_code,
    error_message = p_error_message,
    locked_by_worker = NULL,
    lock_expires_at = NULL
  WHERE run_id = p_run_id
    AND (locked_by_worker = p_worker_id OR locked_by_worker IS NULL);
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE match_runs IS 'Orchestration table for match generation lifecycle - single source of truth';
COMMENT ON COLUMN match_runs.status IS 'created=just created, queued=waiting for worker, processing=worker active, ready=matches available, error=failed';
COMMENT ON COLUMN match_runs.lock_expires_at IS 'Lease expiration for distributed worker coordination';
COMMENT ON COLUMN match_runs.debug_context IS 'JSON blob for observability: extractor counts, parser rejections, etc.';
