-- Harden get_sector_heat: skip null/blank sector elements from unnest (avoids odd aggregates / edge errors)

CREATE OR REPLACE FUNCTION public.get_sector_heat(p_limit int DEFAULT 10)
RETURNS TABLE (
  sector text,
  startup_count bigint,
  avg_god numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    btrim(t.sector) AS sector,
    COUNT(DISTINCT su.id)::bigint AS startup_count,
    ROUND(AVG(su.total_god_score)::numeric, 1) AS avg_god
  FROM public.startup_uploads su
  CROSS JOIN LATERAL unnest(su.sectors) AS t(sector)
  WHERE su.status = 'approved'
    AND su.sectors IS NOT NULL
    AND cardinality(su.sectors) > 0
    AND btrim(t.sector) IS NOT NULL
    AND btrim(t.sector) <> ''
  GROUP BY btrim(t.sector)
  HAVING COUNT(DISTINCT su.id) >= 3
  ORDER BY startup_count DESC, avg_god DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

COMMENT ON FUNCTION public.get_sector_heat(int) IS 'P2: Sector heat for main page. Returns sector, startup_count, avg_god.';

GRANT EXECUTE ON FUNCTION public.get_sector_heat(int) TO anon, authenticated;
