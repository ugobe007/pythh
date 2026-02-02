-- Create startup_signal_snapshots table for historical signal state
-- Phase 5: Signal Evolution

CREATE TABLE IF NOT EXISTS startup_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Signal metrics
  phase_score NUMERIC(5,4) CHECK (phase_score >= 0 AND phase_score <= 1), -- 0.0000 to 1.0000
  signal_band TEXT CHECK (signal_band IN ('low', 'med', 'high')),
  signal_strength NUMERIC(5,1), -- e.g., 6.5
  signal_max NUMERIC(5,1) DEFAULT 10.0, -- max score for signal strength gauge
  match_count INTEGER DEFAULT 0,
  alignment_score NUMERIC(6,2), -- Overall alignment percentage (e.g., 87.50)
  
  -- Top 5 investor IDs at this moment
  top_5_investor_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Context metadata
  heat TEXT CHECK (heat IN ('cool', 'warming', 'hot')),
  velocity_label TEXT,
  tier_label TEXT,
  observers_7d INTEGER DEFAULT 0,
  
  -- Startup context at capture
  startup_name TEXT,
  startup_stage TEXT,
  startup_industry TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by startup (most common - get latest snapshots)
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_startup 
  ON startup_signal_snapshots(startup_id, captured_at DESC);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_captured 
  ON startup_signal_snapshots(captured_at DESC);

-- Index for finding snapshots by signal band (analytics)
CREATE INDEX IF NOT EXISTS idx_signal_snapshots_band 
  ON startup_signal_snapshots(signal_band);

-- Prevent duplicate snapshots within short time window (1 hour)
CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_snapshots_unique_hour
  ON startup_signal_snapshots(startup_id, date_trunc('hour', captured_at));

-- Comment on table
COMMENT ON TABLE startup_signal_snapshots IS 'Historical snapshots of startup signal state for evolution tracking';
COMMENT ON COLUMN startup_signal_snapshots.phase_score IS 'Phase position (0-1): 0 = discovery, 1 = pull';
COMMENT ON COLUMN startup_signal_snapshots.signal_band IS 'Signal strength band: low | med | high';
COMMENT ON COLUMN startup_signal_snapshots.top_5_investor_ids IS 'Array of top 5 investor UUIDs at this moment';
