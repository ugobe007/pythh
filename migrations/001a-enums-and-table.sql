-- ====================================================================
-- PART 1: ENUMS AND TABLE (Fast - run first)
-- ====================================================================

-- Enums
CREATE TYPE match_run_status AS ENUM (
  'created', 'queued', 'processing', 'ready', 'error'
);

CREATE TYPE match_run_step AS ENUM (
  'resolve', 'extract', 'parse', 'match', 'rank', 'finalize'
);

-- Table
CREATE TABLE match_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL,
  input_url text NOT NULL,
  canonical_url text,
  status match_run_status NOT NULL DEFAULT 'created',
  step match_run_step NOT NULL DEFAULT 'resolve',
  match_count int NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  locked_by text,
  lock_expires_at timestamptz,
  engine_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_runs_startup_fk FOREIGN KEY (startup_id) 
    REFERENCES startup_uploads(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_match_runs_startup ON match_runs(startup_id);
CREATE INDEX idx_match_runs_status ON match_runs(status);
CREATE INDEX idx_match_runs_created ON match_runs(created_at DESC);
CREATE INDEX idx_match_runs_lease ON match_runs(status, lock_expires_at) 
  WHERE status = 'queued';

-- Unique constraint: one active run per canonical URL (excludes 'ready' for reruns)
CREATE UNIQUE INDEX idx_match_runs_active_url 
  ON match_runs(canonical_url) 
  WHERE status IN ('created', 'queued', 'processing');
