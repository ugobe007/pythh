-- Relax live pairings so typical startup_uploads rows can appear:
-- - investor_signal was total_god/10 → need GOD>=50 to pass ">=5"; use /8 so ~40 GOD ≈5.
-- - pairings threshold 5→3 (still meaningful, more coverage).
-- - investor sectors[] match is case-sensitive with =ANY(); add lower() equality via unnest.

CREATE OR REPLACE VIEW public.startup_intel_v5_sector AS
SELECT
  su.id,
  su.name,
  NULLIF(
    TRIM(
      COALESCE(
        su.extracted_data->>'sector_key',
        su.extracted_data->>'sector',
        su.extracted_data->>'primary_sector',
        CASE
          WHEN su.sectors IS NOT NULL AND cardinality(su.sectors) >= 1 THEN su.sectors[1]
          ELSE NULL
        END
      )
    ),
    ''
  ) AS sector_key,
  LEAST(
    10::numeric,
    GREATEST(
      0::numeric,
      COALESCE(su.industry_god_score, su.total_god_score, 0) / 8.0
    )
  ) AS investor_signal_sector_0_10,
  CASE
    WHEN COALESCE(su.total_god_score, 0) >= 75 THEN 'hot'
    WHEN COALESCE(su.total_god_score, 0) >= 55 THEN 'warm'
    WHEN COALESCE(su.total_god_score, 0) >= 35 THEN 'watch'
    ELSE 'cold'
  END AS investor_state_sector,
  LEAST(10::numeric, GREATEST(0::numeric, COALESCE(su.traction_score, 0) / 10.0)) AS sector_momentum_0_10,
  LEAST(10::numeric, GREATEST(0::numeric, COALESCE(su.product_score, 0) / 10.0)) AS sector_evidence_0_10,
  LEAST(
    10::numeric,
    GREATEST(0::numeric, COALESCE(su.market_score, su.vision_score, 0) / 10.0)
  ) AS sector_narrative_0_10
FROM public.startup_uploads su;

COMMENT ON VIEW public.startup_intel_v5_sector IS
  'Sector rollup from startup_uploads; investor_signal uses GOD/8 (0–10 scale, capped).';

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
raw_pairings AS (
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

GRANT SELECT ON public.startup_intel_v5_sector TO anon, authenticated;
GRANT SELECT ON public.live_signal_pairings_v1 TO anon, authenticated;
