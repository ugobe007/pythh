-- ============================================================================
-- P1/P2: News stream separation + Signal identification
-- ============================================================================
-- news_stream: funding | investor | startup (for P1 news stream separation)
-- signal_id: stable unique ID per event (for P2 signal numeration)
-- ============================================================================

-- Add news_stream to startup_events (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'startup_events') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'startup_events' AND column_name = 'news_stream') THEN
      ALTER TABLE public.startup_events ADD COLUMN news_stream text CHECK (news_stream IN ('funding', 'investor', 'startup'));
      COMMENT ON COLUMN public.startup_events.news_stream IS 'P1: News stream category. funding=rounds/investment, investor=partner moves/fund closes, startup=launches/milestones';
    END IF;
    -- Backfill from event_type
    UPDATE public.startup_events SET news_stream = CASE
      WHEN event_type IN ('FUNDING', 'INVESTMENT', 'ACQUISITION', 'MERGER', 'IPO_FILING', 'VALUATION') THEN 'funding'
      WHEN event_type IN ('EXEC_CHANGE') THEN 'investor'
      ELSE 'startup'
    END WHERE news_stream IS NULL;
    -- Create index for stream filtering
    CREATE INDEX IF NOT EXISTS idx_startup_events_news_stream ON public.startup_events(news_stream);
  END IF;
END $$;

-- signal_events already has id (UUID). Ensure we have a way to reference/count.
-- No schema change needed for signal_events - id is the signal identifier.
