-- startup_intel_v5_sector: required by live_signal_pairings_v1 (20260117) and server /api/live-pairings.
-- The v5 view historically lived outside repo migrations; derive it from startup_uploads.

ALTER TABLE public.startup_uploads
  ADD COLUMN IF NOT EXISTS sectors text[],
  ADD COLUMN IF NOT EXISTS total_god_score numeric,
  ADD COLUMN IF NOT EXISTS traction_score numeric,
  ADD COLUMN IF NOT EXISTS product_score numeric,
  ADD COLUMN IF NOT EXISTS market_score numeric,
  ADD COLUMN IF NOT EXISTS vision_score numeric,
  ADD COLUMN IF NOT EXISTS industry_god_score numeric;

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
      COALESCE(su.industry_god_score, su.total_god_score, 0) / 10.0
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
  'Sector-facing rollup from startup_uploads (compat name startup_intel_v5_sector).';

GRANT SELECT ON public.startup_intel_v5_sector TO anon, authenticated;
