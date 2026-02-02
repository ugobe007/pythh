-- Migration 04: Create startup_signal_deltas table
-- Run AFTER: 03_create_startup_signal_snapshots_table.sql

CREATE TABLE IF NOT EXISTS startup_signal_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  snapshot_from_id UUID REFERENCES startup_signal_snapshots(id) ON DELETE CASCADE,
  snapshot_to_id UUID REFERENCES startup_signal_snapshots(id) ON DELETE CASCADE,
  
  -- Time range
  from_date TIMESTAMPTZ,
  to_date TIMESTAMPTZ,
  days_elapsed INTEGER,
  
  -- Deltas
  phase_delta NUMERIC(5,4),
  phase_delta_percent NUMERIC(6,2),
  
  band_changed BOOLEAN DEFAULT FALSE,
  band_from TEXT,
  band_to TEXT,
  
  match_count_delta INTEGER DEFAULT 0,
  match_count_from INTEGER,
  match_count_to INTEGER,
  
  alignment_delta NUMERIC(6,2),
  alignment_from NUMERIC(6,2),
  alignment_to NUMERIC(6,2),
  
  signal_strength_delta NUMERIC(5,1),
  
  -- Investor changes
  investors_gained UUID[] DEFAULT ARRAY[]::UUID[],
  investors_lost UUID[] DEFAULT ARRAY[]::UUID[],
  investors_gained_count INTEGER DEFAULT 0,
  investors_lost_count INTEGER DEFAULT 0,
  investors_stable_count INTEGER DEFAULT 0,
  
  -- Narrative
  narrative TEXT,
  summary_emoji TEXT,
  
  compared_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_deltas_startup 
  ON startup_signal_deltas(startup_id, compared_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_deltas_compared 
  ON startup_signal_deltas(compared_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_deltas_snapshots 
  ON startup_signal_deltas(snapshot_from_id, snapshot_to_id);

-- Unique constraint: one delta per snapshot pair
DROP INDEX IF EXISTS idx_signal_deltas_unique_pair;
CREATE UNIQUE INDEX idx_signal_deltas_unique_pair
  ON startup_signal_deltas(snapshot_from_id, snapshot_to_id);

COMMENT ON TABLE startup_signal_deltas IS 'Computed changes between signal snapshots for evolution UI';
