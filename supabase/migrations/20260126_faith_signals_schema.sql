-- Phase 3: VC Faith Signals + Portfolio Exhaust schema
-- Creates storage for SEC Form D exhaust, extracted faith signals, validation links,
-- and faith alignment matches between startups and investors.

-- Ensure timestamp helper exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Portfolio exhaust (evidence of what a VC actually invested in)
CREATE TABLE IF NOT EXISTS public.vc_portfolio_exhaust (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  cik TEXT,
  startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE SET NULL,
  startup_name TEXT,
  startup_website TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('sec_form_d', 'portfolio_page', 'api', 'manual')),
  source_url TEXT,
  filing_date TIMESTAMPTZ,
  round TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  is_lead BOOLEAN,
  validation_status TEXT DEFAULT 'unvalidated',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vc_portfolio_exhaust_dedupe ON public.vc_portfolio_exhaust (investor_id, startup_id, startup_name, source_url, filing_date);
CREATE INDEX IF NOT EXISTS vc_portfolio_exhaust_investor_idx ON public.vc_portfolio_exhaust (investor_id);
CREATE INDEX IF NOT EXISTS vc_portfolio_exhaust_startup_idx ON public.vc_portfolio_exhaust (startup_id);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vc_portfolio_exhaust_updated_at'
  ) THEN
    CREATE TRIGGER trg_vc_portfolio_exhaust_updated_at
    BEFORE UPDATE ON public.vc_portfolio_exhaust
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Faith signals (what a VC says/believes)
CREATE TABLE IF NOT EXISTS public.vc_faith_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES public.investors(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('thesis', 'interview', 'blog', 'fund_announcement', 'tweet', 'podcast')), 
  signal_text TEXT NOT NULL,
  signal_hash TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  published_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  confidence NUMERIC NOT NULL DEFAULT 0.75,
  conviction NUMERIC NOT NULL DEFAULT 0.75,
  categories TEXT[] DEFAULT '{}'::text[],
  tags TEXT[] DEFAULT '{}'::text[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vc_faith_signals_hash_unique ON public.vc_faith_signals (investor_id, signal_hash);
CREATE INDEX IF NOT EXISTS vc_faith_signals_investor_idx ON public.vc_faith_signals (investor_id);
CREATE INDEX IF NOT EXISTS vc_faith_signals_active_idx ON public.vc_faith_signals (is_active);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vc_faith_signals_updated_at'
  ) THEN
    CREATE TRIGGER trg_vc_faith_signals_updated_at
    BEFORE UPDATE ON public.vc_faith_signals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Validation links faith signals to actual portfolio actions
CREATE TABLE IF NOT EXISTS public.vc_signal_validation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faith_signal_id UUID REFERENCES public.vc_faith_signals(id) ON DELETE CASCADE,
  portfolio_exhaust_id UUID REFERENCES public.vc_portfolio_exhaust(id) ON DELETE CASCADE,
  validation_label TEXT NOT NULL CHECK (validation_label IN ('corroborated', 'contradicted', 'unclear')),
  validation_score NUMERIC NOT NULL CHECK (validation_score >= 0 AND validation_score <= 1),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vc_signal_validation_unique ON public.vc_signal_validation (faith_signal_id, portfolio_exhaust_id);
CREATE INDEX IF NOT EXISTS vc_signal_validation_label_idx ON public.vc_signal_validation (validation_label);

-- Faith alignment matches (psychology-based matches)
CREATE TABLE IF NOT EXISTS public.faith_alignment_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES public.investors(id) ON DELETE CASCADE,
  faith_alignment_score NUMERIC NOT NULL DEFAULT 0 CHECK (faith_alignment_score >= 0 AND faith_alignment_score <= 100),
  confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  signal_ids UUID[] DEFAULT '{}'::uuid[],
  validation_ids UUID[] DEFAULT '{}'::uuid[],
  rationale JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_source TEXT DEFAULT 'faith_validation',
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS faith_alignment_unique_pair ON public.faith_alignment_matches (startup_id, investor_id);
CREATE INDEX IF NOT EXISTS faith_alignment_score_idx ON public.faith_alignment_matches (faith_alignment_score DESC);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_faith_alignment_matches_updated_at'
  ) THEN
    CREATE TRIGGER trg_faith_alignment_matches_updated_at
    BEFORE UPDATE ON public.faith_alignment_matches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Notify PostgREST to reload schema so new tables are available immediately
NOTIFY pgrst, 'reload schema';
