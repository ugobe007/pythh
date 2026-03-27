-- Replaces get_lookup_top_investors after 20260331200000 so this wins in migration order.
-- Works when investors.sectors / stage are text[] OR jsonb — always normalize via to_jsonb()
-- so we never COALESCE(text[], jsonb) (PostgreSQL rejects that at parse time).

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
    -- @> on jsonb arrays is easy to get wrong (case, whitespace); match unnested elements instead
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
  'Top investors for a sector tag; sectors/stage may be text[] or jsonb (normalized via to_jsonb).';

GRANT EXECUTE ON FUNCTION public.get_lookup_top_investors(text, int) TO anon, authenticated;
