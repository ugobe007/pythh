-- Restore get_lookup_top_investors JSONB + text[] compatibility.
--
-- Regression: 20260333000000_fix_lookup_top_investors_gin_fast_path.sql runs AFTER
-- 20260331210000_fix_get_lookup_top_investors_jsonb_or_text.sql (sort order: 033 > 031)
-- and replaced the function with v_sector = ANY(i.sectors), which only works for text[].
-- The app schema stores investors.sectors as JSONB (see create_investors_and_uploads.sql),
-- so the fast-path migration returned zero rows and /lookup appeared "broken" (blank tables).

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
    sub.id,
    sub.name,
    sub.firm,
    sub.sectors_out,
    sub.stage_out,
    sub.investor_score::double precision,
    sub.investment_pace_per_year::double precision,
    sub.total_investments::bigint,
    sub.linkedin_url,
    sub.investment_thesis,
    sub.updated_at
  FROM (
    SELECT
      i.id,
      i.name,
      i.firm,
      COALESCE(
        (SELECT array_agg(v)
         FROM jsonb_array_elements_text(COALESCE(to_jsonb(i.sectors), '[]'::jsonb)) AS t(v)),
        ARRAY[]::text[]
      ) AS sectors_out,
      COALESCE(
        (SELECT array_agg(v)
         FROM jsonb_array_elements_text(COALESCE(to_jsonb(i.stage), '[]'::jsonb)) AS t(v)),
        ARRAY[]::text[]
      ) AS stage_out,
      i.investor_score,
      i.investment_pace_per_year,
      i.total_investments,
      i.linkedin_url,
      i.investment_thesis,
      i.updated_at,
      COALESCE(to_jsonb(i.sectors), '[]'::jsonb) AS sec_j
    FROM public.investors i
  ) sub
  WHERE length(trim(p_sector)) > 0
    AND sub.sec_j IS NOT NULL
    AND jsonb_typeof(sub.sec_j) = 'array'
    AND jsonb_array_length(sub.sec_j) > 0
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(sub.sec_j) AS m(v)
      WHERE lower(trim(m.v)) = lower(trim(p_sector))
    )
  ORDER BY
    sub.investment_pace_per_year DESC NULLS LAST,
    sub.total_investments DESC NULLS LAST,
    sub.investor_score DESC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

COMMENT ON FUNCTION public.get_lookup_top_investors(text, int) IS
  'Top investors by sector tag. investors.sectors may be JSONB or text[] (via to_jsonb). Fixed 2026-04-03: reverts GIN-only text[] regression.';

GRANT EXECUTE ON FUNCTION public.get_lookup_top_investors(text, int) TO anon, authenticated;
