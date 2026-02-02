-- Ontology System for Semantic Entity Classification
-- Implements Tier 1 ontologies (actor categories)

-- ============================================
-- TIER 1: Entity Category Ontology
-- ============================================

CREATE TABLE IF NOT EXISTS entity_ontologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'STARTUP',      -- Companies being built/funded
    'INVESTOR',     -- VCs, angels, funds deploying capital
    'FOUNDER',      -- People starting companies
    'EXECUTIVE',    -- People in company roles
    'PLACE',        -- Geographic entities (countries, cities)
    'GENERIC_TERM', -- Categories (SMEs, Big VCs, Researchers)
    'AMBIGUOUS'     -- Needs disambiguation (Washington, Apple)
  )),
  confidence FLOAT NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK (source IN (
    'MANUAL_SEED',    -- Hand-curated
    'CRUNCHBASE',     -- Imported from Crunchbase
    'ML_INFERENCE',   -- Learned from patterns
    'USER_CORRECTION' -- Human feedback
  )),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_entity_ontologies_name 
  ON entity_ontologies(entity_name);
CREATE INDEX IF NOT EXISTS idx_entity_ontologies_type 
  ON entity_ontologies(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_ontologies_confidence 
  ON entity_ontologies(confidence DESC);

-- ============================================
-- TIER 2: Linguistic Pattern Ontology
-- ============================================

CREATE TABLE IF NOT EXISTS linguistic_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'POSSESSIVE',      -- "your startup", "my company"
    'PREPOSITIONAL',   -- "for you", "to them"
    'DESCRIPTOR',      -- "cool", "innovative"
    'STATEMENT_EMBED', -- Full descriptions in headlines
    'PRONOUN'          -- "you", "we", "they"
  )),
  pattern_regex TEXT NOT NULL,
  examples TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Role-Based Inference Rules
-- ============================================

CREATE TABLE IF NOT EXISTS role_inference_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  frame_type TEXT NOT NULL,
  subject_likely_type TEXT NOT NULL, -- What SUBJECT usually is
  object_likely_type TEXT NOT NULL,  -- What OBJECT usually is
  confidence FLOAT NOT NULL DEFAULT 0.9,
  examples TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Seed Data: Common Ontologies
-- ============================================

-- Seed: Known investors
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Sequoia', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Andreessen Horowitz', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Y Combinator', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Google Ventures', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Accel', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Kleiner Perkins', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('General Catalyst', 'INVESTOR', 1.0, 'MANUAL_SEED'),
  ('Lightspeed', 'INVESTOR', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- Seed: Generic terms (NOT startups)
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('MIT Researchers', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Indian Startups', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Big VCs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('SMEs', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Founders', 'GENERIC_TERM', 1.0, 'MANUAL_SEED'),
  ('Former USDS Leaders', 'GENERIC_TERM', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- Seed: Places (NOT startups)
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source) VALUES
  ('Africa', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('India', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('UK', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Europe', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('China', 'PLACE', 1.0, 'MANUAL_SEED'),
  ('Silicon Valley', 'PLACE', 1.0, 'MANUAL_SEED')
ON CONFLICT DO NOTHING;

-- Seed: Ambiguous entities (need context)
INSERT INTO entity_ontologies (entity_name, entity_type, confidence, source, metadata) VALUES
  ('Washington', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["person", "place"]}'),
  ('Apple', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "fruit"]}'),
  ('Google', 'AMBIGUOUS', 0.5, 'MANUAL_SEED', '{"could_be": ["startup", "investor"]}')
ON CONFLICT DO NOTHING;

-- Seed: Role inference rules
INSERT INTO role_inference_rules (event_type, frame_type, subject_likely_type, object_likely_type, confidence, examples) VALUES
  ('INVESTMENT', 'DIRECTIONAL', 'INVESTOR', 'STARTUP', 0.95, ARRAY['Sequoia invests in Stripe', 'Accel leads round for Figma']),
  ('FUNDING', 'SELF_EVENT', 'STARTUP', 'NONE', 0.95, ARRAY['Stripe raises $100M', 'Figma closes Series A']),
  ('ACQUISITION', 'DIRECTIONAL', 'STARTUP', 'STARTUP', 0.9, ARRAY['Google acquires Fitbit', 'Meta buys Instagram']),
  ('PARTNERSHIP', 'BIDIRECTIONAL', 'STARTUP', 'STARTUP', 0.8, ARRAY['Stripe partners with Shopify']),
  ('LAUNCH', 'SELF_EVENT', 'STARTUP', 'NONE', 0.95, ARRAY['Figma launches FigJam', 'Notion unveils AI features'])
ON CONFLICT DO NOTHING;

-- Seed: Linguistic patterns (Tier 2)
INSERT INTO linguistic_patterns (pattern_type, pattern_regex, examples) VALUES
  ('POSSESSIVE', '^(your|my|our|their|his|her)\s+', ARRAY['your startup', 'my company', 'their product']),
  ('PREPOSITIONAL', '\bfor\s+you\b', ARRAY['for you', 'to you', 'with you']),
  ('PRONOUN', '\b(you|we|they|us|them)\b', ARRAY['you should', 'we think', 'they believe']),
  ('DESCRIPTOR', '\b(cool|new|innovative|hot|best|top)\b', ARRAY['cool startup', 'new app', 'top founders']),
  ('STATEMENT_EMBED', 'is\s+(the|a)\s+\w+\s+way\s+to', ARRAY['is the new way to', 'is a better way to'])
ON CONFLICT DO NOTHING;

-- ============================================
-- Helper Functions
-- ============================================

-- Function: Lookup entity type
CREATE OR REPLACE FUNCTION lookup_entity_type(entity_name TEXT)
RETURNS TABLE(entity_type TEXT, confidence FLOAT, source TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.entity_type, e.confidence, e.source
  FROM entity_ontologies e
  WHERE e.entity_name ILIKE entity_name
  ORDER BY e.confidence DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Get role inference for event type
CREATE OR REPLACE FUNCTION get_role_inference(
  p_event_type TEXT,
  p_frame_type TEXT
)
RETURNS TABLE(
  subject_type TEXT,
  object_type TEXT,
  confidence FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT r.subject_likely_type, r.object_likely_type, r.confidence
  FROM role_inference_rules r
  WHERE r.event_type = p_event_type
    AND r.frame_type = p_frame_type
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies (public read)
-- ============================================

ALTER TABLE entity_ontologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE linguistic_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_inference_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to ontologies"
  ON entity_ontologies FOR SELECT
  USING (true);

CREATE POLICY "Public read access to patterns"
  ON linguistic_patterns FOR SELECT
  USING (true);

CREATE POLICY "Public read access to rules"
  ON role_inference_rules FOR SELECT
  USING (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE entity_ontologies IS 'Tier 1 Ontology: Entity category classification (startup, investor, place, etc)';
COMMENT ON TABLE linguistic_patterns IS 'Tier 2 Ontology: Linguistic patterns for disambiguation (possessive, prepositional, etc)';
COMMENT ON TABLE role_inference_rules IS 'Context-based inference rules: what SUBJECT/OBJECT likely are based on event type';
