-- Faith Signals Database Schema
-- Captures VC beliefs, validates them with portfolio data, matches to startup vision

-- 1. VC PORTFOLIO EXHAUST (Historical investments - grounding truth)
CREATE TABLE IF NOT EXISTS vc_portfolio_exhaust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id VARCHAR(255) NOT NULL,
  vc_name VARCHAR(255) NOT NULL,
  
  -- Investment details from SEC Form D
  company_name VARCHAR(500) NOT NULL,
  company_website VARCHAR(500),
  investment_date DATE,
  investment_amount DECIMAL(15,2),
  investment_stage VARCHAR(100), -- 'seed', 'Series A', 'Series B', etc.
  
  -- Company classification
  sectors TEXT[], -- ['AI', 'FinTech', 'Climate', ...]
  geography VARCHAR(100),
  company_status VARCHAR(50), -- 'active', 'exit', 'failed'
  
  -- Validation
  form_d_id VARCHAR(255),
  source_date TIMESTAMP DEFAULT NOW(),
  confidence DECIMAL(3,2), -- How confident we are in this data (0-1)
  
  CONSTRAINT unique_investment UNIQUE(vc_id, company_name, investment_date),
  CREATE INDEX idx_vc_investments ON vc_portfolio_exhaust(vc_id, investment_date DESC),
  CREATE INDEX idx_sectors ON vc_portfolio_exhaust USING GIN(sectors)
);

-- 2. VC FAITH SIGNALS (Beliefs extracted from public sources)
CREATE TABLE IF NOT EXISTS vc_faith_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id VARCHAR(255) NOT NULL,
  vc_name VARCHAR(255) NOT NULL,
  
  -- Signal identification
  signal_category VARCHAR(100), -- 'sector_belief', 'founder_psychology', 'timing_thesis', etc.
  signal_name VARCHAR(255), -- e.g., 'infrastructure_focus', 'technical_founders_only'
  
  -- The actual signal (belief statement)
  signal_text TEXT NOT NULL, -- e.g., "We invest in founders who are experts in their domain"
  
  -- Where we found this signal
  source_type VARCHAR(100), -- 'interview', 'blog_post', 'fund_announcement', 'portfolio_pattern'
  source_url TEXT,
  source_date DATE,
  author VARCHAR(255), -- e.g., 'Sequoia Partner Name'
  
  -- Quality metrics
  confidence DECIMAL(3,2) NOT NULL, -- How sure are we this is what they believe (0-1)
  extracted_date TIMESTAMP DEFAULT NOW(),
  
  -- Validation by portfolio
  portfolio_validation_count INTEGER DEFAULT 0, -- How many portfolio companies match this signal
  portfolio_total_count INTEGER DEFAULT 0, -- Total portfolio companies analyzed
  portfolio_confidence DECIMAL(3,2), -- Confidence based on portfolio data (0-1)
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  CREATE INDEX idx_vc_signals ON vc_faith_signals(vc_id, signal_category),
  CREATE INDEX idx_confidence ON vc_faith_signals(confidence DESC)
);

-- 3. VC SIGNAL VALIDATION (Cross-reference between faith signals and portfolio)
CREATE TABLE IF NOT EXISTS vc_signal_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faith_signal_id UUID NOT NULL REFERENCES vc_faith_signals(id),
  portfolio_exhaust_id UUID NOT NULL REFERENCES vc_portfolio_exhaust(id),
  
  -- Match strength
  match_score DECIMAL(3,2), -- How well does this portfolio company match this signal (0-1)
  match_reason TEXT, -- Why it matches
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CREATE INDEX idx_signal_validation ON vc_signal_validation(faith_signal_id, match_score DESC)
);

-- 4. STARTUP VISION SIGNALS (What startups believe they're building)
CREATE TABLE IF NOT EXISTS startup_vision_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL UNIQUE REFERENCES startup_uploads(id),
  
  -- Core signals extracted from startup
  mission_text TEXT, -- Their stated mission/vision
  founder_psychology TEXT, -- Founder archetypes, backgrounds
  market_thesis TEXT, -- How they see the market
  timing_urgency TEXT, -- Why now?
  
  -- Extracted signals (structured)
  vision_signals TEXT[], -- ['AI_infrastructure', 'technical_founders', 'B2B_focus', ...]
  founder_backgrounds TEXT[], -- ['scientist', 'serial_entrepreneur', 'domain_expert', ...]
  market_positioning TEXT[], -- ['large_addressable_market', 'new_category', 'disruption', ...]
  
  -- Source
  extracted_from VARCHAR(100), -- 'website', 'pitch_deck', 'founder_bio', 'description'
  extracted_date TIMESTAMP DEFAULT NOW(),
  
  CREATE INDEX idx_startup_signals ON startup_vision_signals(startup_id),
  CREATE INDEX idx_vision_signals ON startup_vision_signals USING GIN(vision_signals)
);

-- 5. PSYCHOLOGY MATCHES (VC faith signals matched to startup vision signals)
CREATE TABLE IF NOT EXISTS psychology_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id VARCHAR(255) NOT NULL,
  startup_id UUID NOT NULL REFERENCES startup_uploads(id),
  
  -- Match details
  faith_alignment_score DECIMAL(3,2) NOT NULL, -- 0-1, how well aligned
  matching_signals TEXT[], -- Which signals aligned
  matching_reasons TEXT[], -- Why they aligned
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL, -- Overall confidence in this match
  faith_signal_confidence DECIMAL(3,2), -- How confident in the faith signal
  startup_signal_confidence DECIMAL(3,2), -- How confident in startup signal
  
  -- Comparison to GOD score
  god_score DECIMAL(3,2), -- GOD score for reference
  faith_vs_data_alignment VARCHAR(50), -- 'aligned', 'divergent', 'complementary'
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CREATE INDEX idx_psychology_matches ON psychology_matches(vc_id, faith_alignment_score DESC),
  CREATE INDEX idx_startup_matches ON psychology_matches(startup_id, faith_alignment_score DESC)
);

-- 6. VC PROFILE SUMMARY (One row per VC, consolidating all signals)
CREATE TABLE IF NOT EXISTS vc_faith_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_id VARCHAR(255) NOT NULL UNIQUE,
  vc_name VARCHAR(255) NOT NULL,
  
  -- Profile stats
  total_signals INTEGER DEFAULT 0,
  total_investments INTEGER DEFAULT 0,
  
  -- Core beliefs (serialized as JSON for flexibility)
  core_beliefs JSONB, -- {
                      --   "sectors": ["AI", "FinTech"],
                      --   "stages": ["seed", "Series A"],
                      --   "founder_type": "technical",
                      --   "market_belief": "B2B enterprise",
                      --   "timing_focus": "infrastructure"
                      -- }
  
  -- Profile quality
  profile_completeness DECIMAL(3,2), -- 0-1, how complete is this profile
  last_updated TIMESTAMP DEFAULT NOW(),
  
  -- Notes
  profile_summary TEXT
);

-- 7. AUDIT LOG (Track all signal extractions and validations)
CREATE TABLE IF NOT EXISTS faith_signals_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100), -- 'signal_extracted', 'validation_run', 'profile_updated'
  vc_id VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CREATE INDEX idx_audit_vc ON faith_signals_audit(vc_id, created_at DESC)
);
