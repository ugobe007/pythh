-- ===========================================================================
-- PSYCHOLOGICAL SIGNALS SCHEMA
-- ===========================================================================
-- Date: February 12, 2026
-- Purpose: Store behavioral intelligence about investor psychology
-- 
-- Core Philosophy: Investors are humans showing human behavior, psychology,
-- greed, pride, and ego. We listen to those signals to predict their actions.
-- ===========================================================================

-- PSYCHOLOGICAL SIGNALS TABLE
-- Tracks individual psychological events detected from news, RSS, etc.
CREATE TABLE IF NOT EXISTS psychological_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  -- Signal Classification
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'oversubscription',  -- FOMO indicator
    'followon',          -- Conviction indicator
    'competitive',       -- Urgency indicator
    'bridge',            -- Risk indicator
    'sector_pivot',      -- Strategic shift
    'social_proof',      -- Cascade effect
    'founder_repeat',    -- Serial founder bonus
    'cofounder_exit'     -- Risk flag
  )),
  
  -- Signal Strength (0.00 to 1.00)
  signal_strength DECIMAL(3,2) NOT NULL CHECK (signal_strength >= 0 AND signal_strength <= 1),
  
  -- Metadata (JSONB for flexibility)
  -- Examples:
  --   oversubscription: {"multiplier": 3, "amount_raised": "$5M", "demand": "$15M"}
  --   followon: {"investors": ["Sequoia Capital", "Greylock Partners"], "count": 2}
  --   competitive: {"term_sheets": 5, "bidding_war": true}
  --   bridge: {"runway_months": 3, "milestone_missed": true}
  metadata JSONB DEFAULT '{}',
  
  -- Source & Timing
  source TEXT NOT NULL, -- 'rss_scraper', 'manual_entry', 'api_enrichment', 'inference_extractor'
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional: Link to discovery source
  article_url TEXT,
  article_title TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_psychological_signals_startup 
  ON psychological_signals(startup_id);
  
CREATE INDEX IF NOT EXISTS idx_psychological_signals_type 
  ON psychological_signals(signal_type);
  
CREATE INDEX IF NOT EXISTS idx_psychological_signals_detected 
  ON psychological_signals(detected_at DESC);

-- Composite index for startup + type queries
CREATE INDEX IF NOT EXISTS idx_psychological_signals_startup_type 
  ON psychological_signals(startup_id, signal_type);

-- GIN index for JSONB metadata queries
CREATE INDEX IF NOT EXISTS idx_psychological_signals_metadata 
  ON psychological_signals USING GIN(metadata);


-- ===========================================================================
-- INVESTOR BEHAVIOR PATTERNS TABLE
-- Classify investor types: fast mover, herd follower, contrarian, thesis-driven
-- ===========================================================================

CREATE TABLE IF NOT EXISTS investor_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  
  -- Pattern Classification
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'fast_mover',      -- Acts within days of signal
    'herd_follower',   -- Waits for others to move first
    'contrarian',      -- Invests against trends
    'thesis_driven',   -- Invests based on sector conviction
    'opportunistic'    -- Spread across many sectors
  )),
  
  -- Confidence Score (0.00 to 1.00)
  -- Based on historical investment pattern analysis
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Supporting Data
  investment_count INT DEFAULT 0,              -- Total investments made
  days_to_decision_avg DECIMAL(5,1),           -- Avg days from signal to investment
  follow_rate DECIMAL(3,2),                    -- % of investments after tier-1 lead
  solo_investment_rate DECIMAL(3,2),           -- % of investments as solo/lead
  sector_diversity_score DECIMAL(3,2),         -- 0 = focused, 1 = diverse
  
  -- Metadata
  analysis_date DATE DEFAULT CURRENT_DATE,
  data_source TEXT, -- 'ml_analysis', 'manual_classification', 'historical_patterns'
  notes TEXT,
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_investor_behavior_investor 
  ON investor_behavior_patterns(investor_id);
  
CREATE INDEX IF NOT EXISTS idx_investor_behavior_pattern 
  ON investor_behavior_patterns(pattern_type);

-- Unique constraint: One pattern per investor (update pattern_type over time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_behavior_unique 
  ON investor_behavior_patterns(investor_id);


-- ===========================================================================
-- SECTOR MOMENTUM TABLE
-- Track "hot sector" cascades and timing windows
-- ===========================================================================

CREATE TABLE IF NOT EXISTS sector_momentum (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Sector Info
  sector TEXT NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Momentum Metrics
  signal_velocity DECIMAL(5,2) NOT NULL,       -- Deals per week
  tier1_investor_count INT DEFAULT 0,           -- Number of tier-1 firms active
  total_deal_count INT DEFAULT 0,               -- Total deals this week
  avg_deal_size_millions DECIMAL(8,2),          -- Average deal size
  
  -- Momentum Score (0.00 to 1.00)
  -- 0.00 = dead sector, 1.00 = nuclear hot
  momentum_score DECIMAL(3,2) NOT NULL CHECK (momentum_score >= 0 AND momentum_score <= 1),
  
  -- Change vs Previous Week
  momentum_change_pct DECIMAL(5,2),             -- % change from last week
  
  -- Tier-1 Investor Names (for social proof tracking)
  tier1_investors JSONB DEFAULT '[]',           -- ["Sequoia", "a16z", "Greylock"]
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sector_momentum_sector 
  ON sector_momentum(sector);
  
CREATE INDEX IF NOT EXISTS idx_sector_momentum_week 
  ON sector_momentum(week_start DESC);
  
CREATE INDEX IF NOT EXISTS idx_sector_momentum_score 
  ON sector_momentum(momentum_score DESC);

-- Unique constraint: One record per sector per week
CREATE UNIQUE INDEX IF NOT EXISTS idx_sector_momentum_unique 
  ON sector_momentum(sector, week_start);


-- ===========================================================================
-- ADD PSYCHOLOGICAL SIGNAL COLUMNS TO startup_uploads
-- ===========================================================================

-- Add psychological signal fields to existing startup_uploads table
-- These will be populated by inference-extractor.js during scraping

ALTER TABLE startup_uploads 
  ADD COLUMN IF NOT EXISTS is_oversubscribed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS oversubscription_multiple DECIMAL(3,1),
  ADD COLUMN IF NOT EXISTS fomo_signal_strength DECIMAL(3,2),
  
  ADD COLUMN IF NOT EXISTS has_followon BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS followon_investors TEXT[],
  ADD COLUMN IF NOT EXISTS conviction_signal_strength DECIMAL(3,2),
  
  ADD COLUMN IF NOT EXISTS is_competitive BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS term_sheet_count INT,
  ADD COLUMN IF NOT EXISTS urgency_signal_strength DECIMAL(3,2),
  
  ADD COLUMN IF NOT EXISTS is_bridge_round BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_signal_strength DECIMAL(3,2),
  
  ADD COLUMN IF NOT EXISTS psychological_multiplier DECIMAL(4,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS enhanced_god_score INT; -- GOD score with psychological boost

-- Comment on columns
COMMENT ON COLUMN startup_uploads.is_oversubscribed IS 'Detected from "3x oversubscribed" patterns - FOMO indicator';
COMMENT ON COLUMN startup_uploads.has_followon IS 'Existing investors doubling down - conviction indicator';
COMMENT ON COLUMN startup_uploads.is_competitive IS 'Multiple term sheets detected - urgency indicator';
COMMENT ON COLUMN startup_uploads.is_bridge_round IS 'Bridge financing detected - risk indicator';
COMMENT ON COLUMN startup_uploads.psychological_multiplier IS 'Calculated multiplier based on behavioral signals (1.0 = neutral, >1.0 = boost, <1.0 = penalty)';
COMMENT ON COLUMN startup_uploads.enhanced_god_score IS 'total_god_score * psychological_multiplier (capped at 100)';


-- ===========================================================================
-- VIEWS FOR ANALYTICS
-- ===========================================================================

-- Hot Startups View (with psychological boost)
CREATE OR REPLACE VIEW hot_startups_with_signals AS
SELECT 
  s.id,
  s.name,
  s.total_god_score,
  s.enhanced_god_score,
  s.psychological_multiplier,
  s.is_oversubscribed,
  s.has_followon,
  s.is_competitive,
  s.is_bridge_round,
  s.status,
  s.created_at,
  COUNT(ps.id) AS signal_count
FROM startup_uploads s
LEFT JOIN psychological_signals ps ON ps.startup_id = s.id
WHERE s.status = 'approved'
  AND s.enhanced_god_score > s.total_god_score  -- Only startups with psychological boost
GROUP BY s.id, s.name, s.total_god_score, s.enhanced_god_score, 
         s.psychological_multiplier, s.is_oversubscribed, s.has_followon,
         s.is_competitive, s.is_bridge_round, s.status, s.created_at
ORDER BY s.enhanced_god_score DESC;

-- Sector Momentum 4-Week Trend
CREATE OR REPLACE VIEW sector_momentum_trend AS
SELECT 
  sector,
  AVG(momentum_score) AS avg_momentum_4weeks,
  SUM(total_deal_count) AS total_deals_4weeks,
  ARRAY_AGG(DISTINCT tier1_investors) AS all_tier1_investors,
  MAX(week_start) AS latest_week
FROM sector_momentum
WHERE week_start >= CURRENT_DATE - INTERVAL '28 days'
GROUP BY sector
ORDER BY avg_momentum_4weeks DESC;


-- ===========================================================================
-- FUNCTIONS
-- ===========================================================================

-- Function to calculate psychological multiplier from signals
CREATE OR REPLACE FUNCTION calculate_psychological_multiplier(startup_uuid UUID)
RETURNS DECIMAL(4,2) AS $$
DECLARE
  fomo_boost DECIMAL(3,2) := 0;
  conviction_boost DECIMAL(3,2) := 0;
  urgency_boost DECIMAL(3,2) := 0;
  risk_penalty DECIMAL(3,2) := 0;
  final_multiplier DECIMAL(4,2);
BEGIN
  -- Get all signals for this startup
  SELECT 
    COALESCE(MAX(CASE WHEN signal_type = 'oversubscription' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'followon' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'competitive' THEN signal_strength END), 0),
    COALESCE(MAX(CASE WHEN signal_type = 'bridge' THEN signal_strength END), 0)
  INTO fomo_boost, conviction_boost, urgency_boost, risk_penalty
  FROM psychological_signals
  WHERE startup_id = startup_uuid;
  
  -- Calculate multiplier
  -- Formula: 1 + (FOMO * 0.3) + (Conviction * 0.25) + (Urgency * 0.2) - (Risk * 0.15)
  final_multiplier := 1.0 + 
                      (fomo_boost * 0.3) + 
                      (conviction_boost * 0.25) + 
                      (urgency_boost * 0.2) - 
                      (risk_penalty * 0.15);
  
  -- Cap multiplier between 0.70 and 1.60
  final_multiplier := GREATEST(0.70, LEAST(1.60, final_multiplier));
  
  RETURN final_multiplier;
END;
$$ LANGUAGE plpgsql;

-- Function to update enhanced GOD score
CREATE OR REPLACE FUNCTION update_enhanced_god_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate psychological multiplier
  NEW.psychological_multiplier := calculate_psychological_multiplier(NEW.id);
  
  -- Calculate enhanced score (capped at 100)
  NEW.enhanced_god_score := LEAST(100, ROUND(NEW.total_god_score * NEW.psychological_multiplier));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update enhanced score when total_god_score changes
DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
CREATE TRIGGER trigger_update_enhanced_god_score
  BEFORE INSERT OR UPDATE OF total_god_score, is_oversubscribed, has_followon, is_competitive, is_bridge_round
  ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_enhanced_god_score();


-- ===========================================================================
-- GRANTS (RLS will be added separately if needed)
-- ===========================================================================

-- Grant permissions (adjust based on your RLS policies)
-- GRANT SELECT ON psychological_signals TO authenticated;
-- GRANT SELECT ON investor_behavior_patterns TO authenticated;
-- GRANT SELECT ON sector_momentum TO authenticated;


-- ===========================================================================
-- VALIDATION
-- ===========================================================================

-- Test the calculate_psychological_multiplier function
DO $$
BEGIN
  RAISE NOTICE 'Psychological signals schema created successfully!';
  RAISE NOTICE 'Tables: psychological_signals, investor_behavior_patterns, sector_momentum';
  RAISE NOTICE 'New columns added to startup_uploads: is_oversubscribed, has_followon, is_competitive, is_bridge_round, psychological_multiplier, enhanced_god_score';
  RAISE NOTICE 'Function: calculate_psychological_multiplier(startup_uuid)';
  RAISE NOTICE 'Views: hot_startups_with_signals, sector_momentum_trend';
END $$;
