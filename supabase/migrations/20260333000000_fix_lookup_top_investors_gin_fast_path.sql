-- Replaces the slow jsonb-unnest full-scan version.
-- Strategy:
--   1. Fast path: p_sector = ANY(i.sectors) — hits the GIN index, O(log n)
--   2. Slow path: case-insensitive unnest — only runs when exact match returns 0 rows
--      (handles legacy data where sector casing differs from the canonical INDUSTRIES list)
-- The GIN index (idx_investors_sectors_gin) was created in 20260331200000 and remains valid.

CREATE OR REPLACE FUNCTION public.get_lookup_top_investors(p_sector text, p_limit int DEFAULT 10)
RETURNS TABLE (
  id                       uuid,
  name                     text,
  firm                     text,
  sectors                  text[],
  stage                    text[],
  investor_score           double precision,
  investment_pace_per_year double precision,
  total_investments        bigint,
  linkedin_url             text,
  investment_thesis        text,
  updated_at               timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sector text := trim(p_sector);
  v_limit  int  := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
BEGIN
  IF length(v_sector) = 0 THEN
    RETURN;
  END IF;

  -- Fast path: exact match using GIN index (idx_investors_sectors_gin)
  RETURN QUERY
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
  WHERE v_sector = ANY(i.sectors)
  ORDER BY
    i.investment_pace_per_year DESC NULLS LAST,
    i.total_investments DESC NULLS LAST,
    i.investor_score DESC NULLS LAST
  LIMIT v_limit;

  -- If the fast path produced rows, we are done.
  IF FOUND THEN
    RETURN;
  END IF;

  -- Slow path: case-insensitive fallback for legacy/mixed-case sector values.
  -- Full scan but only runs when the exact-match GIN query returns nothing.
  RETURN QUERY
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
    AND EXISTS (
      SELECT 1
      FROM unnest(i.sectors) AS s(v)
      WHERE lower(trim(s.v)) = lower(v_sector)
    )
  ORDER BY
    i.investment_pace_per_year DESC NULLS LAST,
    i.total_investments DESC NULLS LAST,
    i.investor_score DESC NULLS LAST
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.get_lookup_top_investors(text, int) IS
  'Top investors for a sector tag. Fast path uses GIN index; slow case-insensitive path only runs on empty exact match.';

GRANT EXECUTE ON FUNCTION public.get_lookup_top_investors(text, int) TO anon, authenticated;
