-- If no investor matches sector / thesis / firm text, still return one random named investor
-- so live_signal_pairings_v1 is non-empty for all top_startups (up to LIMIT 100).

CREATE OR REPLACE VIEW public.live_signal_pairings_v1 AS
WITH
top_startups AS (
  SELECT
    id,
    name,
    sector_key,
    investor_signal_sector_0_10,
    investor_state_sector,
    sector_momentum_0_10,
    sector_evidence_0_10,
    sector_narrative_0_10
  FROM public.startup_intel_v5_sector
  WHERE sector_key IS NOT NULL
    AND investor_signal_sector_0_10 IS NOT NULL
    AND investor_signal_sector_0_10 >= 3
  ORDER BY
    CASE WHEN investor_state_sector = 'hot' THEN 0 ELSE 1 END,
    investor_signal_sector_0_10 DESC NULLS LAST
  LIMIT 100
),
strict_ok AS (
  SELECT DISTINCT s.id
  FROM top_startups s
  JOIN public.investors i ON (
    (i.sectors IS NOT NULL AND EXISTS (
      SELECT 1
      FROM unnest(i.sectors) AS u(elem)
      WHERE lower(btrim(elem::text)) = lower(btrim(s.sector_key::text))
    ))
    OR (i.investment_thesis IS NOT NULL AND i.investment_thesis ILIKE '%' || s.sector_key || '%')
    OR (i.firm_description_normalized IS NOT NULL AND i.firm_description_normalized ILIKE '%' || s.sector_key || '%')
  )
  WHERE i.name IS NOT NULL
),
raw_strict AS (
  SELECT
    s.id AS startup_id,
    s.name AS startup_name,
    i.id AS investor_id,
    i.name AS investor_name,
    s.sector_key,
    s.investor_signal_sector_0_10,
    s.investor_state_sector,
    s.sector_momentum_0_10,
    s.sector_evidence_0_10,
    s.sector_narrative_0_10,
    ROW_NUMBER() OVER (PARTITION BY s.id ORDER BY random()) AS inv_rank
  FROM top_startups s
  JOIN public.investors i ON (
    (i.sectors IS NOT NULL AND EXISTS (
      SELECT 1
      FROM unnest(i.sectors) AS u(elem)
      WHERE lower(btrim(elem::text)) = lower(btrim(s.sector_key::text))
    ))
    OR (i.investment_thesis IS NOT NULL AND i.investment_thesis ILIKE '%' || s.sector_key || '%')
    OR (i.firm_description_normalized IS NOT NULL AND i.firm_description_normalized ILIKE '%' || s.sector_key || '%')
  )
  WHERE i.name IS NOT NULL
),
raw_fallback AS (
  SELECT
    s.id AS startup_id,
    s.name AS startup_name,
    i.id AS investor_id,
    i.name AS investor_name,
    s.sector_key,
    s.investor_signal_sector_0_10,
    s.investor_state_sector,
    s.sector_momentum_0_10,
    s.sector_evidence_0_10,
    s.sector_narrative_0_10,
    1 AS inv_rank
  FROM top_startups s
  CROSS JOIN LATERAL (
    SELECT i.id, i.name
    FROM public.investors i
    WHERE i.name IS NOT NULL
    ORDER BY random()
    LIMIT 1
  ) i
  WHERE NOT EXISTS (SELECT 1 FROM strict_ok o WHERE o.id = s.id)
),
raw_pairings AS (
  SELECT * FROM raw_strict
  UNION ALL
  SELECT * FROM raw_fallback
)
SELECT
  startup_id,
  startup_name,
  investor_id,
  investor_name,
  CASE
    WHEN COALESCE(sector_momentum_0_10, 0) >= COALESCE(sector_evidence_0_10, 0)
     AND COALESCE(sector_momentum_0_10, 0) >= COALESCE(sector_narrative_0_10, 0)
    THEN 'Capital velocity'
    WHEN COALESCE(sector_evidence_0_10, 0) >= COALESCE(sector_momentum_0_10, 0)
     AND COALESCE(sector_evidence_0_10, 0) >= COALESCE(sector_narrative_0_10, 0)
    THEN 'Stage readiness'
    ELSE 'Thesis convergence'
  END AS reason,
  LEAST(GREATEST(COALESCE(investor_signal_sector_0_10, 0) / 10.0, 0), 1) AS confidence,
  sector_key,
  NOW() AS created_at
FROM raw_pairings
WHERE inv_rank = 1
ORDER BY
  CASE WHEN investor_state_sector = 'hot' THEN 0 ELSE 1 END,
  confidence DESC;

COMMENT ON VIEW public.live_signal_pairings_v1 IS
  'Top startups paired to sector-matching investors; if none match, one random named investor (fallback).';

GRANT SELECT ON public.live_signal_pairings_v1 TO anon, authenticated;
