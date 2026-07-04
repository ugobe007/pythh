-- Investor signal events: partner moves, thesis shifts, portfolio adds
-- Aligns with docs/SIGNAL_SYSTEM_ROADMAP.md event_type enum

CREATE TABLE IF NOT EXISTS public.investor_signal_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN (
    'portfolio_add', 'partner_join', 'thesis_shift', 'fund_close', 'news_mention'
  )),
  signal_id       text NOT NULL,
  title           text NOT NULL,
  summary         text,
  magnitude       real DEFAULT 0.5 CHECK (magnitude >= 0 AND magnitude <= 1),
  source_table    text,
  source_id       text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  detected_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_signal_events_investor
  ON public.investor_signal_events (investor_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_investor_signal_events_type
  ON public.investor_signal_events (event_type, detected_at DESC);

ALTER TABLE public.investor_signal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY investor_signal_events_read
  ON public.investor_signal_events FOR SELECT USING (true);

CREATE POLICY investor_signal_events_write
  ON public.investor_signal_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.investor_signal_events TO anon, authenticated;
GRANT ALL ON public.investor_signal_events TO service_role;

COMMENT ON TABLE public.investor_signal_events IS
  'Typed investor activity signals: portfolio_add, partner_join, thesis_shift, fund_close, news_mention';

-- Rolling firm thesis snapshot (derived from recent deals)
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS rolling_thesis_summary text,
  ADD COLUMN IF NOT EXISTS rolling_thesis_sectors text[],
  ADD COLUMN IF NOT EXISTS rolling_thesis_stages text[],
  ADD COLUMN IF NOT EXISTS rolling_thesis_updated_at timestamptz;

COMMENT ON COLUMN public.investors.rolling_thesis_summary IS
  'Auto-derived from investor_investments in last 90d — not manual thesis';
