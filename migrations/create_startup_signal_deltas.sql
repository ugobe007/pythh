-- Create startup_signal_deltas table for computed signal changes
-- Phase 5: Signal Evolution

CREATE TABLE IF NOT EXISTS startup_signal_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  snapshot_from_id UUID REFERENCES startup_signal_snapshots(id) ON DELETE CASCADE,
  snapshot_to_id UUID REFERENCES startup_signal_snapshots(id) ON DELETE CASCADE,
  
  -- Time range for this delta
  from_date TIMESTAMPTZ,
  to_date TIMESTAMPTZ,
  days_elapsed INTEGER,
  
  -- Computed deltas
  phase_delta NUMERIC(5,4), -- e.g., +0.0700 = +7%
  phase_delta_percent NUMERIC(6,2), -- Pre-computed percentage for display
  
  band_changed BOOLEAN DEFAULT FALSE,
  band_from TEXT,
  band_to TEXT,
  
  match_count_delta INTEGER DEFAULT 0, -- e.g., +3
  match_count_from INTEGER,
  match_count_to INTEGER,
  
  alignment_delta NUMERIC(6,2), -- e.g., +8.50%
  alignment_from NUMERIC(6,2),
  alignment_to NUMERIC(6,2),
  
  signal_strength_delta NUMERIC(5,1), -- e.g., +0.8
  
  -- Narrative changes
  investors_gained UUID[] DEFAULT ARRAY[]::UUID[],
  investors_lost UUID[] DEFAULT ARRAY[]::UUID[],
  investors_gained_count INTEGER DEFAULT 0,
  investors_lost_count INTEGER DEFAULT 0,
  investors_stable_count INTEGER DEFAULT 0,
  
  -- Auto-generated explanation
  narrative TEXT,
  summary_emoji TEXT, -- e.g., '📈' or '📉' or '➡️'
  
  -- Metadata
  compared_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by startup (most common)
CREATE INDEX IF NOT EXISTS idx_signal_deltas_startup 
  ON startup_signal_deltas(startup_id, compared_at DESC);

-- Index for finding recent deltas
CREATE INDEX IF NOT EXISTS idx_signal_deltas_compared 
  ON startup_signal_deltas(compared_at DESC);

-- Index for finding deltas by specific snapshots
CREATE INDEX IF NOT EXISTS idx_signal_deltas_snapshots 
  ON startup_signal_deltas(snapshot_from_id, snapshot_to_id);

-- Prevent duplicate delta calculations for same snapshot pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_signal_deltas_unique_pair
  ON startup_signal_deltas(snapshot_from_id, snapshot_to_id);

-- Comment on table
COMMENT ON TABLE startup_signal_deltas IS 'Computed changes between signal snapshots for evolution UI';
COMMENT ON COLUMN startup_signal_deltas.phase_delta IS 'Change in phase score (e.g., +0.07)';
COMMENT ON COLUMN startup_signal_deltas.phase_delta_percent IS 'Percentage change for display (e.g., +7.00)';
COMMENT ON COLUMN startup_signal_deltas.investors_gained IS 'UUIDs of investors newly in top 5';
COMMENT ON COLUMN startup_signal_deltas.investors_lost IS 'UUIDs of investors dropped from top 5';
COMMENT ON COLUMN startup_signal_deltas.narrative IS 'Auto-generated explanation of changes';
