-- Fast Top-10 lookup by sector for /lookup (avoids slow PostgREST overlap + multi-order plans)
-- Requires sectors as text[] (current app schema).

CREATE INDEX IF NOT EXISTS idx_investors_sectors_gin ON public.investors USING GIN (sectors);

CREATE OR REPLACE FUNCTION public.get_lookup_top_investors(p_sector text, p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  name text,
  firm text,
  sectors text[],
  stage text[],
  investor_score double precision,
  investment_pace_per_year double precision,
  total_investments bigint,
  linkedin_url text,
  investment_thesis text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.name,
    i.firm,
    i.sectors,
    i.stage,
    i.investor_score::double precision,
    i.investment_pace_per_year::double precision,
    i.total_investments::bigint,
    i.linkedin_url,
    i.investment_thesis,
    i.updated_at
  FROM public.investors i
  WHERE i.sectors IS NOT NULL
    AND cardinality(i.sectors) > 0
    AND p_sector = ANY (i.sectors)
  ORDER BY
    i.investment_pace_per_year DESC NULLS LAST,
    i.total_investments DESC NULLS LAST,
    i.investor_score DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

COMMENT ON FUNCTION public.get_lookup_top_investors(text, int) IS
  'Top investors for a sector tag; used by /lookup to avoid slow client overlap queries.';

GRANT EXECUTE ON FUNCTION public.get_lookup_top_investors(text, int) TO anon, authenticated;
