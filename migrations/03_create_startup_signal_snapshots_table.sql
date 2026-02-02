-- Migration 03: Create startup_signal_snapshots table
-- Run AFTER: 02_create_startup_jobs_table.sql

CREATE TABLE IF NOT EXISTS startup_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Signal metrics
  phase_score NUMERIC(5,4) CHECK (phase_score >= 0 AND phase_score <= 1),
  signal_band TEXT CHECK (signal_band IN ('low', 'med', 'high')),
  signal_strength NUMERIC(5,1),
  signal_max NUMERIC(5,1) DEFAULT 10.0,
  match_count INTEGER DEFAULT 0,
  alignment_score NUMERIC(6,2),
  
  -- Top 5 investor IDs
  top_5_investor_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Context
  heat TEXT CHECK (heat IN ('cool', 'warming', 'hot')),
  velocity_label TEXT,
  tier_label TEXT,
  observers_7d INTEGER DEFAULT 0,
  
  -- Startup context
  startup_name TEXT,
  startup_stage TEXT,
  startup_industry TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_snapshots_startup 
  ON startup_signal_snapshots(startup_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_captured 
  ON startup_signal_snapshots(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_band 
  ON startup_signal_snapshots(signal_band);

COMMENT ON TABLE startup_signal_snapshots IS 'Historical snapshots of startup signal state for evolution tracking';
COMMENT ON COLUMN startup_signal_snapshots.captured_at IS 'Timestamp of snapshot capture. Rate-limit snapshot creation in application code (e.g., max 1 per hour)';
