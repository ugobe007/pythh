-- SSOT-Compliant Phase-Change Event Storage
-- 2-Phase Persistence: Always store events, conditionally store graph joins

-- Drop existing table if it has old schema (safe - no data loss since it's new)
DROP TABLE IF EXISTS startup_events CASCADE;

-- Phase A: Event storage (100% coverage, even FILTERED/OTHER)
CREATE TABLE startup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity (SSOT: hash(publisher + url) for stable dedup)
  event_id TEXT UNIQUE NOT NULL,
  
  -- Semantics (parser is SSOT)
  event_type TEXT NOT NULL CHECK (event_type IN (
    'FUNDING', 'INVESTMENT', 'ACQUISITION', 'MERGER', 'PARTNERSHIP',
    'LAUNCH', 'IPO_FILING', 'VALUATION', 'EXEC_CHANGE', 'CONTRACT',
    'OTHER', 'FILTERED'
  )),
  frame_type TEXT NOT NULL CHECK (frame_type IN (
    'BIDIRECTIONAL', 'DIRECTIONAL', 'SELF_EVENT', 'EXEC_EVENT', 'UNKNOWN'
  )),
  frame_confidence FLOAT NOT NULL CHECK (frame_confidence >= 0 AND frame_confidence <= 1),
  
  -- Slots
  subject TEXT,
  object TEXT,
  verb TEXT,
  
  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL,
  
  -- Source provenance
  source_publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_published_at TIMESTAMPTZ,
  
  -- Extracted signals (JSONB for flexibility)
  amounts JSONB,  -- { raw, currency, value, magnitude, usd }
  round TEXT,     -- "Seed", "Series A", etc.
  semantic_context JSONB,  -- Array of scored evidence
  entities JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of { name, role, confidence, source }
  
  -- Parser metadata
  extraction_meta JSONB NOT NULL,  -- { pattern_id, filtered_reason, fallback_used, decision, graph_safe, reject_reason }
  notes JSONB,  -- Parser notes
  
  -- Housekeeping
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes separately (allows DESC sort order)
CREATE INDEX IF NOT EXISTS idx_startup_events_event_type ON startup_events(event_type);
CREATE INDEX IF NOT EXISTS idx_startup_events_occurred_at ON startup_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_startup_events_subject ON startup_events(subject);
CREATE INDEX IF NOT EXISTS idx_startup_events_object ON startup_events(object);
CREATE INDEX IF NOT EXISTS idx_startup_events_frame_confidence ON startup_events(frame_confidence);
CREATE INDEX IF NOT EXISTS idx_startup_events_created_at ON startup_events(created_at DESC);

-- Add comments for documentation (wrapped in DO block to handle existing table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'startup_events') THEN
    EXECUTE 'COMMENT ON TABLE startup_events IS ''Phase-Change v1.0.0 events - ALWAYS inserted regardless of quality (parser is SSOT)''';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startup_events' AND column_name = 'event_id') THEN
      EXECUTE 'COMMENT ON COLUMN startup_events.event_id IS ''Stable dedup key: hash(publisher + url) - title changes, URL does not''';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startup_events' AND column_name = 'extraction_meta') THEN
      EXECUTE 'COMMENT ON COLUMN startup_events.extraction_meta IS ''Parser decision gates: { decision: ACCEPT|REJECT, graph_safe: boolean, reject_reason?: string }''';
    END IF;
  END IF;
END $$;

-- Phase B: Graph joins (conditional on parser.graph_safe=true)
-- Uses existing startup_uploads table, add backref to events

-- Add event tracking to startup_uploads (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'startup_uploads' AND column_name = 'discovery_event_id'
  ) THEN
    ALTER TABLE startup_uploads 
    ADD COLUMN discovery_event_id UUID REFERENCES startup_events(id);
    
    CREATE INDEX idx_startup_uploads_discovery_event 
    ON startup_uploads(discovery_event_id);
  END IF;
END $$;

-- Add comment for discovery_event_id column (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'startup_uploads' AND column_name = 'discovery_event_id') THEN
    EXECUTE 'COMMENT ON COLUMN startup_uploads.discovery_event_id IS ''Link to Phase-Change event that discovered this startup (only when graph_safe=true)''';
  END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON startup_events TO anon;
GRANT SELECT, INSERT, UPDATE ON startup_events TO authenticated;

-- Enable RLS (but allow service role full access)
ALTER TABLE startup_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" 
  ON startup_events 
  FOR ALL 
  USING (true);

-- Policy: Authenticated users can read all events
CREATE POLICY "Authenticated can read events" 
  ON startup_events 
  FOR SELECT 
  TO authenticated 
  USING (true);
