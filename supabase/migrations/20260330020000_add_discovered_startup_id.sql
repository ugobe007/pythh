-- ────────────────────────────────────────────────────────────────────────────
-- Migration: add discovered_startup_id to pythh_entities
-- Allows the discovery pipeline (ingest-discovered-signals.js) to link
-- pythh_entities back to discovered_startups records.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE pythh_entities
  ADD COLUMN IF NOT EXISTS discovered_startup_id uuid
    REFERENCES discovered_startups(id) ON DELETE SET NULL;

-- Index for fast skip-existing lookups
CREATE INDEX IF NOT EXISTS idx_pythh_entities_discovered_startup_id
  ON pythh_entities(discovered_startup_id)
  WHERE discovered_startup_id IS NOT NULL;
