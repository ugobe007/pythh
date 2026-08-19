-- Keep the resumable funding-evidence backfill inside the API statement timeout.
-- The partial index matches its fixed event-type filter and deterministic order.

CREATE INDEX IF NOT EXISTS idx_startup_events_funding_backfill_order
  ON public.startup_events (created_at DESC, id DESC)
  WHERE event_type IN ('FUNDING', 'INVESTMENT');

COMMENT ON INDEX public.idx_startup_events_funding_backfill_order IS
  'Supports bounded historical funding evidence scans at a fixed created_at watermark.';
