-- Indexes to support reconcile-signals.js performance
-- source_reliability is now queried and updated; add index if missing.

CREATE INDEX IF NOT EXISTS idx_signal_events_source_reliability
  ON pythh_signal_events (source_reliability);

CREATE INDEX IF NOT EXISTS idx_signal_events_entity_signal_date
  ON pythh_signal_events (entity_id, primary_signal, detected_at DESC);

-- Composite index for duplicate clustering queries
CREATE INDEX IF NOT EXISTS idx_signal_events_reconcile
  ON pythh_signal_events (entity_id, primary_signal, detected_at)
  WHERE primary_signal IS NOT NULL;

-- Index on is_ambiguous for conflict flagging
CREATE INDEX IF NOT EXISTS idx_signal_events_ambiguous
  ON pythh_signal_events (is_ambiguous)
  WHERE is_ambiguous = true;

-- Entity metadata freshness
CREATE INDEX IF NOT EXISTS idx_entities_last_signal
  ON pythh_entities (last_signal_date DESC)
  WHERE is_active = true;
