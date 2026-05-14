-- Training events for name-gating / junk classification (feeds ML export + baseline models).
-- Populated by: reclassify-zero-signal-junk.js (--ml-log), enrich-sparse-startups.js (--ml-log).

CREATE TABLE IF NOT EXISTS entity_gate_ml_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  startup_id UUID REFERENCES startup_uploads(id) ON DELETE SET NULL,
  name TEXT NOT NULL,

  -- Where this row was logged from
  event_source TEXT NOT NULL CHECK (event_source IN (
    'pre_gate',
    'reclassify_needs_url',
    'enrich_sparse'
  )),

  -- startup_uploads.entity_gate at observation time (nullable if unknown)
  entity_gate TEXT,

  -- reclassify: which eviction path; enrich: how the run ended
  bucket TEXT,
  enrichment_result TEXT,

  -- Validator + logic engine snapshot (same signals we use for rules)
  validator_valid BOOLEAN,
  validator_reason TEXT,
  logic_track TEXT,
  logic_reason TEXT,
  ontology_hint TEXT,

  -- Suggested training label: junk = negative class for "is a real startup name"
  training_label TEXT NOT NULL CHECK (training_label IN ('junk', 'clean', 'ambiguous')),

  meta JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX IF NOT EXISTS idx_entity_gate_ml_events_created_at
  ON entity_gate_ml_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_gate_ml_events_startup_id
  ON entity_gate_ml_events (startup_id);

CREATE INDEX IF NOT EXISTS idx_entity_gate_ml_events_label_source
  ON entity_gate_ml_events (training_label, event_source);

COMMENT ON TABLE entity_gate_ml_events IS 'Append-only events for training junk/name-gate models; opt-in via --ml-log or ENTITY_GATE_ML_LOG=1';
