-- ============================================================================
-- P5: LP Target List — Database structure for fundraise pipeline
-- ============================================================================
-- LP Database: real pipeline, not random contacts.
-- Target: 150 LPs (50 FO, 20 FoF, 40 HNW, 20 Operators, 20 Corporate)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lp_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Person
  name text NOT NULL,
  
  -- Organization
  organization text,
  
  -- LP Type: Family Office / FoF / HNW / Corporate / Operator
  lp_type text NOT NULL CHECK (lp_type IN (
    'family_office', 'fof', 'hnw', 'corporate', 'operator'
  )),
  
  -- Location
  location text,
  location_city text,
  location_region text,
  
  -- Investment profile
  check_size text,                    -- e.g. "$250k", "$500k", "$1M"
  check_size_min_usd int,             -- optional numeric for filtering
  check_size_max_usd int,
  investment_focus text[],            -- VC, AI, Data, Fintech, General
  
  -- Pipeline
  connection text CHECK (connection IN ('warm', 'cold', 'event', 'intro')),
  status text NOT NULL DEFAULT 'not_contacted' CHECK (status IN (
    'not_contacted', 'contacted', 'meeting', 'in_dd', 'closed'
  )),
  
  -- Contact
  email text,
  linkedin_url text,
  twitter_url text,
  notes text,
  
  -- Source tracking
  source text,                        -- e.g. "LinkedIn", "SuperReturn", "PitchBook"
  source_detail text,                 -- e.g. "Family Office Principal search"
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lp_targets_lp_type ON public.lp_targets(lp_type);
CREATE INDEX IF NOT EXISTS idx_lp_targets_status ON public.lp_targets(status);
CREATE INDEX IF NOT EXISTS idx_lp_targets_connection ON public.lp_targets(connection);
CREATE INDEX IF NOT EXISTS idx_lp_targets_organization ON public.lp_targets(organization);
CREATE INDEX IF NOT EXISTS idx_lp_targets_investment_focus ON public.lp_targets USING GIN(investment_focus);

COMMENT ON TABLE public.lp_targets IS 'P5: LP target list for fundraise. 150 target: 50 FO, 20 FoF, 40 HNW, 20 Operators, 20 Corporate.';

-- LP sources reference (where to find LPs)
CREATE TABLE IF NOT EXISTS public.lp_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'conference', 'linkedin_search', 'tool', 'event', 'intro_network'
  )),
  url text,
  search_query text,                  -- e.g. "Family Office Principal"
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_sources_name ON public.lp_sources(name);

-- Seed LP source ideas from the spec
INSERT INTO public.lp_sources (name, source_type, search_query, notes) VALUES
  ('LinkedIn: Family Office Principal', 'linkedin_search', 'Family Office Principal', 'Direct search'),
  ('LinkedIn: Family Office CIO', 'linkedin_search', 'Family Office CIO', 'Direct search'),
  ('LinkedIn: Direct Investments Family Office', 'linkedin_search', 'Direct Investments Family Office', 'Direct search'),
  ('LinkedIn: Single Family Office', 'linkedin_search', 'Single Family Office', 'Direct search'),
  ('LinkedIn: Fund of Funds', 'linkedin_search', 'Fund of Funds', 'FoF search'),
  ('LinkedIn: Capital Partner', 'linkedin_search', 'Capital Partner', 'FoF search'),
  ('LinkedIn: LP Investor', 'linkedin_search', 'LP Investor', 'FoF search'),
  ('LinkedIn: Portfolio Manager Venture', 'linkedin_search', 'Portfolio Manager Venture', 'FoF search'),
  ('SuperReturn', 'conference', NULL, 'LP attendee lists / speakers'),
  ('Milken Institute', 'conference', NULL, 'LP attendee lists / speakers'),
  ('SALT Conference', 'conference', NULL, 'LP attendee lists / speakers'),
  ('Family Office Association', 'conference', NULL, 'LP attendee lists / speakers'),
  ('Opal Group Family Office Summit', 'conference', NULL, 'LP attendee lists / speakers'),
  ('VC Rising', 'conference', NULL, 'LP attendee lists / speakers'),
  ('TechGC', 'conference', NULL, 'LP attendee lists / speakers'),
  ('iGlobal Forum', 'conference', NULL, 'LP attendee lists / speakers'),
  ('PitchBook', 'tool', NULL, 'LP data'),
  ('Crunchbase', 'tool', NULL, 'LP data'),
  ('AngelList', 'tool', NULL, 'LP data'),
  ('LinkedIn Sales Navigator', 'tool', NULL, 'Very useful for LP search'),
  ('Twitter', 'tool', NULL, 'LPs on Twitter quietly')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE public.lp_sources IS 'P5: Where to find LPs — conferences, LinkedIn searches, tools.';

-- Pipeline stats: total and target by LP type
CREATE OR REPLACE FUNCTION public.get_lp_pipeline_stats()
RETURNS TABLE (
  lp_type text,
  total bigint,
  target int,
  not_contacted bigint,
  contacted bigint,
  meeting bigint,
  in_dd bigint,
  closed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH type_targets AS (
    SELECT * FROM (VALUES
      ('family_office', 50), ('fof', 20), ('hnw', 40), ('operator', 20), ('corporate', 20)
    ) AS t(lp_type, target)
  ),
  counts AS (
    SELECT lp_type, status, COUNT(*)::bigint AS cnt
    FROM lp_targets
    GROUP BY lp_type, status
  )
  SELECT
    tt.lp_type,
    COALESCE(SUM(c.cnt), 0)::bigint AS total,
    tt.target::int,
    COALESCE(MAX(CASE WHEN c.status = 'not_contacted' THEN c.cnt END), 0)::bigint AS not_contacted,
    COALESCE(MAX(CASE WHEN c.status = 'contacted' THEN c.cnt END), 0)::bigint AS contacted,
    COALESCE(MAX(CASE WHEN c.status = 'meeting' THEN c.cnt END), 0)::bigint AS meeting,
    COALESCE(MAX(CASE WHEN c.status = 'in_dd' THEN c.cnt END), 0)::bigint AS in_dd,
    COALESCE(MAX(CASE WHEN c.status = 'closed' THEN c.cnt END), 0)::bigint AS closed
  FROM type_targets tt
  LEFT JOIN counts c ON c.lp_type = tt.lp_type
  GROUP BY tt.lp_type, tt.target;
$$;

COMMENT ON FUNCTION public.get_lp_pipeline_stats() IS 'P5: LP pipeline counts by type vs target (150 total).';
