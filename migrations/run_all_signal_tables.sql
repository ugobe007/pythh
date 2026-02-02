-- Run all signal architecture migrations
-- Execute this file in Supabase SQL Editor

-- ============================================
-- 0. URL NORMALIZATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION normalize_url(input_url TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(input_url, '^https?://', '', 'i'),
      '/$', ''
    )
  ));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_url IS 'Normalizes URLs: lowercase, no protocol, no trailing slash';

-- ============================================
-- 1. STARTUP JOBS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS startup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_normalized TEXT NOT NULL GENERATED ALWAYS AS (normalize_url(url)) STORED,
  status TEXT NOT NULL CHECK (status IN ('queued', 'building', 'scoring', 'matching', 'ready', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  error_message TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on normalized URL (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_jobs_url_normalized 
  ON startup_jobs(url_normalized);

CREATE INDEX IF NOT EXISTS idx_startup_jobs_status ON startup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_startup_jobs_startup_id ON startup_jobs(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_jobs_created ON startup_jobs(created_at DESC);

CREATE OR REPLACE FUNCTION update_startup_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_startup_jobs_updated_at ON startup_jobs;
CREATE TRIGGER trigger_startup_jobs_updated_at
  BEFORE UPDATE ON startup_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_startup_jobs_updated_at();

-- ============================================
-- 2. STARTUP SIGNAL SNAPSHOTS TABLE
-- ============================================

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

-- Unique constraint: one snapshot per hour per startup
DROP INDEX IF EXISTS idx_signal_snapshots_unique_hour;
CREATE UNIQUE INDEX idx_signal_snapshots_unique_hour
  ON startup_signal_snapshots(startup_id, date_trunc('hour', captured_at));

-- ============================================
-- 3. STARTUP SIGNAL DELTAS TABLE
-- ============================================

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

DROP INDEX IF EXISTS idx_signal_deltas_unique_pair;
CREATE UNIQUE INDEX idx_signal_deltas_unique_pair
  ON startup_signal_deltas(snapshot_from_id, snapshot_to_id);

-- ============================================
-- VERIFY TABLES EXIST
-- ============================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('startup_jobs', 'startup_signal_snapshots', 'startup_signal_deltas');
  
  IF table_count = 3 THEN
    RAISE NOTICE '✅ All signal architecture tables created successfully';
    RAISE NOTICE '📊 Tables: startup_jobs (with URL normalization), startup_signal_snapshots, startup_signal_deltas';
    RAISE NOTICE '🔧 Indexes and triggers created';
    RAISE NOTICE '🔒 Unique constraint on url_normalized prevents duplicates';
  ELSE
    RAISE WARNING '⚠️  Only % of 3 tables were created', table_count;
  END IF;
END $$;
