-- Phase-Change Event Storage Migration
-- Run this against your Supabase database to enable CapitalEvent storage

-- =====================================================================
-- 1. startup_events table (main events storage)
-- =====================================================================

CREATE TABLE IF NOT EXISTS startup_events (
  -- Identity
  event_id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  
  -- Semantics
  event_type TEXT NOT NULL CHECK (event_type IN (
    'FUNDING', 'INVESTMENT', 'ACQUISITION', 'MERGER', 'PARTNERSHIP',
    'LAUNCH', 'IPO_FILING', 'VALUATION', 'EXEC_CHANGE', 'CONTRACT',
    'OTHER', 'FILTERED'
  )),
  verb TEXT,
  frame_type TEXT NOT NULL CHECK (frame_type IN (
    'BIDIRECTIONAL', 'DIRECTIONAL', 'SELF_EVENT', 'EXEC_EVENT', 'UNKNOWN'
  )),
  frame_confidence REAL NOT NULL CHECK (frame_confidence >= 0 AND frame_confidence <= 1),
  
  -- Slots
  subject TEXT,
  object TEXT,
  
  -- Source metadata
  publisher TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  
  -- Full payload (JSONB for queryability)
  payload JSONB NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_events_event_type ON startup_events(event_type);
CREATE INDEX idx_events_occurred_at ON startup_events(occurred_at DESC);
CREATE INDEX idx_events_published_at ON startup_events(published_at DESC);
CREATE INDEX idx_events_subject ON startup_events(subject);
CREATE INDEX idx_events_object ON startup_events(object);
CREATE INDEX idx_events_publisher ON startup_events(publisher);

-- JSONB indexes for payload queries
CREATE INDEX idx_events_payload_gin ON startup_events USING GIN (payload);

-- Compound index for common queries
CREATE INDEX idx_events_type_date ON startup_events(event_type, occurred_at DESC);

-- =====================================================================
-- 2. startup_event_entities table (entity-event join for graph queries)
-- =====================================================================

CREATE TABLE IF NOT EXISTS startup_event_entities (
  event_id TEXT NOT NULL REFERENCES startup_events(event_id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUBJECT', 'OBJECT', 'COUNTERPARTY')),
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL CHECK (source IN ('frame', 'heuristic')),
  
  PRIMARY KEY (event_id, entity_name, role)
);

-- Fast entity→events lookup
CREATE INDEX idx_event_entities_entity ON startup_event_entities(entity_name);
CREATE INDEX idx_event_entities_role ON startup_event_entities(role);

-- Compound index for filtered entity lookups
CREATE INDEX idx_event_entities_entity_role ON startup_event_entities(entity_name, role);

-- =====================================================================
-- 3. Useful views for common queries
-- =====================================================================

-- View: Recent funding events with entities
CREATE OR REPLACE VIEW recent_funding_events AS
SELECT 
  e.event_id,
  e.occurred_at,
  e.title,
  e.subject AS company,
  e.verb,
  e.payload->'amounts'->>'raw' AS amount,
  e.payload->>'round' AS round,
  e.publisher,
  e.url,
  array_agg(DISTINCT ee.entity_name) AS all_entities
FROM startup_events e
LEFT JOIN startup_event_entities ee ON e.event_id = ee.event_id
WHERE e.event_type = 'FUNDING'
GROUP BY e.event_id, e.occurred_at, e.title, e.subject, e.verb, e.payload, e.publisher, e.url
ORDER BY e.occurred_at DESC;

-- View: Acquisition pipeline
CREATE OR REPLACE VIEW acquisition_events AS
SELECT 
  e.event_id,
  e.occurred_at,
  e.subject AS acquirer,
  e.object AS target,
  e.title,
  e.frame_confidence,
  e.url
FROM startup_events e
WHERE e.event_type = 'ACQUISITION'
ORDER BY e.occurred_at DESC;

-- View: Company event timeline
CREATE OR REPLACE VIEW company_event_timeline AS
SELECT 
  ee.entity_name AS company,
  e.event_type,
  e.occurred_at,
  e.title,
  ee.role,
  e.url
FROM startup_event_entities ee
JOIN startup_events e ON ee.event_id = e.event_id
WHERE e.event_type != 'FILTERED'
ORDER BY ee.entity_name, e.occurred_at DESC;

-- =====================================================================
-- 4. Helper functions
-- =====================================================================

-- Function: Get event count by type
CREATE OR REPLACE FUNCTION get_event_type_distribution()
RETURNS TABLE (event_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.event_type, COUNT(*)::BIGINT
  FROM startup_events e
  WHERE e.event_type != 'FILTERED'
  GROUP BY e.event_type
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get company event count
CREATE OR REPLACE FUNCTION get_company_event_count(company_name TEXT)
RETURNS TABLE (event_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.event_type, COUNT(*)::BIGINT
  FROM startup_events e
  JOIN startup_event_entities ee ON e.event_id = ee.event_id
  WHERE ee.entity_name = company_name
  GROUP BY e.event_type
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 5. Row Level Security (RLS) - Optional but recommended
-- =====================================================================

-- Enable RLS
ALTER TABLE startup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_event_entities ENABLE ROW LEVEL SECURITY;

-- Policy: Public read access (adjust based on your security needs)
CREATE POLICY "Allow public read" ON startup_events
  FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON startup_event_entities
  FOR SELECT USING (true);

-- Policy: Service role can write (for scraper/ingestor)
CREATE POLICY "Allow service write" ON startup_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service write" ON startup_event_entities
  FOR INSERT WITH CHECK (true);

-- =====================================================================
-- 6. Example queries
-- =====================================================================

-- Get all funding events in last 30 days:
-- SELECT * FROM recent_funding_events WHERE occurred_at > NOW() - INTERVAL '30 days';

-- Get event type distribution:
-- SELECT * FROM get_event_type_distribution();

-- Find all events involving a specific company:
-- SELECT * FROM company_event_timeline WHERE company = 'Metaview';

-- Find all partnerships with Google:
-- SELECT e.title, e.occurred_at, ee_other.entity_name AS partner
-- FROM startup_events e
-- JOIN startup_event_entities ee_google ON e.event_id = ee_google.event_id
-- JOIN startup_event_entities ee_other ON e.event_id = ee_other.event_id
-- WHERE ee_google.entity_name = 'Google'
--   AND ee_other.entity_name != 'Google'
--   AND e.event_type = 'PARTNERSHIP'
-- ORDER BY e.occurred_at DESC;

-- =====================================================================
-- 7. Cleanup (if re-running migration)
-- =====================================================================

-- DROP TABLE IF EXISTS startup_event_entities CASCADE;
-- DROP TABLE IF EXISTS startup_events CASCADE;
-- DROP VIEW IF EXISTS recent_funding_events;
-- DROP VIEW IF EXISTS acquisition_events;
-- DROP VIEW IF EXISTS company_event_timeline;
-- DROP FUNCTION IF EXISTS get_event_type_distribution();
-- DROP FUNCTION IF EXISTS get_company_event_count(TEXT);
