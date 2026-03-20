-- Add features_at_time to funding_outcomes for event provenance and deduplication
-- Required by enrich-from-rss-news.js for funding/exit tracking
ALTER TABLE funding_outcomes
  ADD COLUMN IF NOT EXISTS features_at_time JSONB;

COMMENT ON COLUMN funding_outcomes.features_at_time IS 'Event provenance: { event_id, source_url, source_title, amount_raw, stage, acquirer }';
