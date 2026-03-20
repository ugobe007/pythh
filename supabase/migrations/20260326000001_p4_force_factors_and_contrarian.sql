-- ============================================================================
-- P4: Force Correlation + Reverse Logic (Contrarian)
-- ============================================================================
-- force_factors: Macro/sector/structural drivers
-- signal_force_correlation: Tie signals to forces
-- get_contrarian_signals: "If X, is ¬X also true?"
-- ============================================================================

-- 1. FORCE FACTORS — Macro, sector, structural drivers
CREATE TABLE IF NOT EXISTS public.force_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  force_type text NOT NULL CHECK (force_type IN ('macro', 'sector', 'structural')),
  description text,
  time_range text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_force_factors_type ON public.force_factors(force_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_force_factors_name ON public.force_factors(name);

COMMENT ON TABLE public.force_factors IS 'P4: Drivers that move signals. Macro=rates, IPO window. Sector=AI hype, fintech. Structural=fund vintage, dry powder.';

-- 2. SEED COMMON FORCES
INSERT INTO public.force_factors (name, force_type, description) VALUES
  ('AI sector momentum', 'sector', 'AI/ML funding and hype cycle'),
  ('Interest rates', 'macro', 'Fed policy impact on venture'),
  ('IPO window', 'macro', 'Public market exit availability'),
  ('Dry powder', 'structural', 'Uncommitted VC capital'),
  ('Fintech regulation', 'sector', 'Regulatory tailwinds/headwinds'),
  ('Climate tech', 'sector', 'Climate and sustainability funding')
ON CONFLICT (name) DO NOTHING;

-- 3. SIGNAL–FORCE CORRELATION (references startup_events or signal_events)
CREATE TABLE IF NOT EXISTS public.signal_force_correlation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_source text NOT NULL,  -- 'startup_events' | 'signal_events'
  signal_ref text NOT NULL,    -- event_id or signal id
  force_id uuid NOT NULL REFERENCES public.force_factors(id) ON DELETE CASCADE,
  correlation_score numeric(3,2) CHECK (correlation_score >= -1 AND correlation_score <= 1),
  confidence numeric(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_force_force ON public.signal_force_correlation(force_id);
CREATE INDEX IF NOT EXISTS idx_signal_force_ref ON public.signal_force_correlation(signal_source, signal_ref);

-- 4. GET CONTRARIAN SIGNALS — "If X is true, is ¬X also true?"
CREATE OR REPLACE FUNCTION public.get_contrarian_signals(
  p_hypothesis text,
  p_sector text DEFAULT NULL,
  p_days int DEFAULT 90
)
RETURNS TABLE (
  hypothesis text,
  inverse_observed boolean,
  sector text,
  metric_name text,
  metric_value numeric,
  sample_size bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hypothesis: "AI is hot" → Check if non-AI / adjacent also getting funded
  -- Hypothesis: "Seed is frothy" → Check if later stages tightening
  -- Returns inverse observation: did we see evidence of the opposite?
  CASE LOWER(TRIM(p_hypothesis))
    WHEN 'ai is hot' THEN
      RETURN QUERY
      SELECT
        p_hypothesis::text,
        (SELECT COUNT(*) FROM startup_investor_matches m
         JOIN startup_uploads s ON s.id = m.startup_id
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval
           AND s.sectors IS NOT NULL
           AND NOT (s.sectors && ARRAY['AI/ML', 'Artificial Intelligence', 'Machine Learning']::text[])
           AND (p_sector IS NULL OR p_sector = ANY(s.sectors))
        ) > 10 AS inverse_observed,
        COALESCE(p_sector, 'non-AI')::text,
        'non_ai_deals'::text,
        (SELECT COUNT(*)::numeric FROM startup_investor_matches m
         JOIN startup_uploads s ON s.id = m.startup_id
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval
           AND s.sectors IS NOT NULL
           AND NOT (s.sectors && ARRAY['AI/ML', 'Artificial Intelligence', 'Machine Learning']::text[])
        ),
        (SELECT COUNT(*) FROM startup_investor_matches m
         JOIN startup_uploads s ON s.id = m.startup_id
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval);
    WHEN 'seed frothy' THEN
      RETURN QUERY
      SELECT
        p_hypothesis::text,
        (SELECT COUNT(*) FROM startup_investor_matches m
         JOIN startup_uploads s ON s.id = m.startup_id
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval
           AND s.stage >= 3
        ) > 5 AS inverse_observed,
        COALESCE(p_sector, 'all')::text,
        'later_stage_deals'::text,
        (SELECT COUNT(*)::numeric FROM startup_investor_matches m
         JOIN startup_uploads s ON s.id = m.startup_id
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval
           AND s.stage >= 3),
        (SELECT COUNT(*) FROM startup_investor_matches m
         WHERE m.created_at >= NOW() - (p_days || ' days')::interval);
    WHEN 'seed is frothy' THEN
      RETURN QUERY
      SELECT p_hypothesis::text, (SELECT COUNT(*) FROM startup_investor_matches m JOIN startup_uploads s ON s.id = m.startup_id WHERE m.created_at >= NOW() - (p_days || ' days')::interval AND s.stage >= 3) > 5, COALESCE(p_sector, 'all')::text, 'later_stage_deals'::text, (SELECT COUNT(*)::numeric FROM startup_investor_matches m JOIN startup_uploads s ON s.id = m.startup_id WHERE m.created_at >= NOW() - (p_days || ' days')::interval AND s.stage >= 3), (SELECT COUNT(*) FROM startup_investor_matches m WHERE m.created_at >= NOW() - (p_days || ' days')::interval);
    ELSE
      -- Generic: return hypothesis with nulls (no specific inverse check)
      RETURN QUERY
      SELECT
        p_hypothesis::text,
        NULL::boolean,
        p_sector::text,
        'unknown'::text,
        NULL::numeric,
        0::bigint;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_contrarian_signals(text, text, int) IS 'P4: Contrarian check. If X is true, is ¬X also true? e.g. AI hot → non-AI deals? Seed frothy → later stages?';
