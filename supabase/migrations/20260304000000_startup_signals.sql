-- ===================================================================
-- startup_signals: Tracks behavioral & market signals for portfolio companies
-- Created: 2026-03-04
-- ===================================================================

-- Main signals table
CREATE TABLE IF NOT EXISTS startup_signals (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id    uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  signal_type   text NOT NULL,  -- 'funding', 'hiring', 'product_launch', 'press_mention', 'partnership', 'market_expansion', 'github_activity', 'regulatory'
  signal_date   timestamptz,
  signal_title  text,
  signal_url    text,
  signal_source text,           -- 'rss', 'github', 'linkedin', 'producthunt', 'crunchbase', 'web_scrape'
  strength      float CHECK (strength >= 0 AND strength <= 1),  -- 0–1 normalized signal strength
  sentiment     text CHECK (sentiment IN ('positive','neutral','negative')),
  raw_data      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- Signal type enum values (documented):
-- funding          → seed/series/bridge round announced
-- hiring           → job postings found, headcount growth
-- product_launch   → new product, feature, or version released
-- press_mention    → news article or blog post mention
-- partnership      → strategic partnership or integration announced
-- market_expansion → new geography, vertical, or customer segment
-- github_activity  → commit velocity, star growth, contributor growth
-- regulatory       → license, FDA approval, patent granted
-- executive_hire   → key hire (C-suite, VP) announced
-- award            → industry recognition, competition win

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_startup_signals_startup_id   ON startup_signals(startup_id);
CREATE INDEX IF NOT EXISTS idx_startup_signals_type_date    ON startup_signals(signal_type, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_startup_signals_startup_date ON startup_signals(startup_id, signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_startup_signals_strength     ON startup_signals(strength DESC);
CREATE INDEX IF NOT EXISTS idx_startup_signals_created_at   ON startup_signals(created_at DESC);

-- ───────────────────────────────────────────────────────────────────
-- Momentum snapshot: one row per startup, updated by the signals worker
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS startup_momentum_snapshots (
  startup_id          uuid PRIMARY KEY REFERENCES startup_uploads(id) ON DELETE CASCADE,
  -- Rolling 30-day signal counts by type
  funding_signals_30d     int DEFAULT 0,
  hiring_signals_30d      int DEFAULT 0,
  product_signals_30d     int DEFAULT 0,
  press_signals_30d       int DEFAULT 0,
  partnership_signals_30d int DEFAULT 0,
  github_signals_30d      int DEFAULT 0,
  -- Computed momentum score 0–100
  momentum_score      float DEFAULT 0,
  velocity_score      float DEFAULT 0,   -- rate of change vs prior 30d
  signal_diversity    int   DEFAULT 0,   -- how many distinct signal types in last 30d
  -- Flags
  is_trending         boolean DEFAULT false,
  is_raising          boolean DEFAULT false,  -- funding signal in last 14d
  is_hiring           boolean DEFAULT false,  -- hiring signal in last 14d
  is_launching        boolean DEFAULT false,  -- product signal in last 14d
  -- Timestamps
  first_signal_at     timestamptz,
  last_signal_at      timestamptz,
  snapshot_updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_momentum_snapshots_score     ON startup_momentum_snapshots(momentum_score DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_snapshots_trending  ON startup_momentum_snapshots(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_momentum_snapshots_raising   ON startup_momentum_snapshots(is_raising) WHERE is_raising = true;

-- ───────────────────────────────────────────────────────────────────
-- Add market_momentum column to startup_uploads (denormalized fast read)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE startup_uploads
  ADD COLUMN IF NOT EXISTS market_momentum     float DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS trending_signals    text[];  -- array of active signal types

-- Index for momentum-sorted queries
CREATE INDEX IF NOT EXISTS idx_startup_uploads_momentum ON startup_uploads(market_momentum DESC NULLS LAST)
  WHERE status = 'approved';

-- ───────────────────────────────────────────────────────────────────
-- RLS: read-only for anon/auth users
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE startup_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_momentum_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read startup_signals"
  ON startup_signals FOR SELECT USING (true);

CREATE POLICY "Public read startup_momentum_snapshots"
  ON startup_momentum_snapshots FOR SELECT USING (true);

CREATE POLICY "Service write startup_signals"
  ON startup_signals FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service write startup_momentum_snapshots"
  ON startup_momentum_snapshots FOR ALL USING (auth.role() = 'service_role');
