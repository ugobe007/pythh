-- =============================================================================
-- PORTFOLIO HEALTH + GOLDILOCKS (maturity vs GOD alignment)
-- Mirrors lib/maturityClassifier.js GOD→floor mapping vs startup_uploads.maturity_level
-- Run scripts/compute-maturity.js --apply so maturity_level is populated.
--
-- Must DROP first: CREATE OR REPLACE VIEW cannot add/reorder columns vs the prior
-- portfolio_health definition (PostgreSQL error 42P16).
-- =============================================================================

DROP VIEW IF EXISTS public.portfolio_health CASCADE;

CREATE VIEW public.portfolio_health AS
WITH sector_counts AS (
  SELECT
    COALESCE(sectors[1], 'Unspecified') AS primary_sector,
    COUNT(*)::integer AS n_in_sector
  FROM startup_uploads
  WHERE status = 'approved'
  GROUP BY COALESCE(sectors[1], 'Unspecified')
),
sector_rank AS (
  SELECT
    su.id,
    COALESCE(su.sectors[1], 'Unspecified') AS primary_sector,
    CASE
      WHEN COALESCE(sc.n_in_sector, 0) <= 1 THEN 50::numeric
      ELSE ROUND(
        (PERCENT_RANK() OVER (
          PARTITION BY COALESCE(su.sectors[1], 'Unspecified')
          ORDER BY su.total_god_score NULLS LAST
        ) * 100)::numeric,
        1
      )
    END AS sector_god_percentile
  FROM startup_uploads su
  LEFT JOIN sector_counts sc ON sc.primary_sector = COALESCE(su.sectors[1], 'Unspecified')
  WHERE su.status = 'approved'
),
event_stats AS (
  SELECT
    pe.startup_id,
    MAX(pe.event_date) AS last_event_at,
    COUNT(*) FILTER (WHERE pe.event_date >= NOW() - INTERVAL '180 days')::integer AS events_last_180d
  FROM portfolio_events pe
  GROUP BY pe.startup_id
),
pillar AS (
  SELECT
    su.id,
    GREATEST(
      COALESCE(su.team_score, 0),
      COALESCE(su.traction_score, 0),
      COALESCE(su.market_score, 0),
      COALESCE(su.product_score, 0)
    ) - LEAST(
      COALESCE(su.team_score, 0),
      COALESCE(su.traction_score, 0),
      COALESCE(su.market_score, 0),
      COALESCE(su.product_score, 0)
    ) AS pillar_spread,
    LEAST(
      COALESCE(su.team_score, 0),
      COALESCE(su.traction_score, 0),
      COALESCE(su.market_score, 0),
      COALESCE(su.product_score, 0)
    ) AS pillar_min
  FROM startup_uploads su
),
mat AS (
  SELECT
    su.id,
    su.maturity_level,
    su.maturity_score,
    su.maturity_gaps,
    CASE su.maturity_level
      WHEN 'freshman' THEN 0
      WHEN 'sophomore' THEN 1
      WHEN 'junior' THEN 2
      WHEN 'senior' THEN 3
      WHEN 'graduate' THEN 4
      WHEN 'phd' THEN 5
      ELSE NULL
    END AS maturity_degree_index,
    CASE
      WHEN COALESCE(su.total_god_score, 0) >= 80 THEN 4
      WHEN COALESCE(su.total_god_score, 0) >= 65 THEN 3
      WHEN COALESCE(su.total_god_score, 0) >= 52 THEN 2
      WHEN COALESCE(su.total_god_score, 0) >= 32 THEN 1
      ELSE 0
    END AS god_implied_maturity_floor_index
  FROM startup_uploads su
),
base AS (
  SELECT
    ps.*,
    sr.primary_sector,
    sr.sector_god_percentile,
    (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0))::integer AS god_delta,
    p.pillar_spread,
    p.pillar_min,
    es.last_event_at,
    CASE
      WHEN es.last_event_at IS NOT NULL
      THEN EXTRACT(DAY FROM (NOW() - es.last_event_at))::integer
      ELSE NULL
    END AS days_since_last_event,
    COALESCE(es.events_last_180d, 0) AS events_last_180d,
    m.maturity_level,
    m.maturity_score,
    m.maturity_gaps,
    m.maturity_degree_index,
    m.god_implied_maturity_floor_index,
    CASE
      WHEN m.maturity_degree_index IS NOT NULL AND m.god_implied_maturity_floor_index IS NOT NULL
      THEN m.maturity_degree_index - m.god_implied_maturity_floor_index
      ELSE NULL
    END AS goldilocks_maturity_gap,
    (
      COALESCE(ps.current_god_score, 0) >= 60
      AND COALESCE(ps.current_god_score, 0) <= 75
    ) AS in_goldilocks_god_zone,
    CASE
      WHEN m.maturity_level IS NULL THEN 'unknown'
      WHEN m.maturity_degree_index IS NULL OR m.god_implied_maturity_floor_index IS NULL THEN 'unknown'
      WHEN (m.maturity_degree_index - m.god_implied_maturity_floor_index) <= -2 THEN 'thin_signals'
      WHEN (m.maturity_degree_index - m.god_implied_maturity_floor_index) >= 2 THEN 'ahead_of_god'
      ELSE 'aligned'
    END AS goldilocks_alignment,
    CASE
      WHEN ps.status <> 'active' THEN 'exited'
      WHEN m.maturity_degree_index IS NOT NULL
        AND m.god_implied_maturity_floor_index IS NOT NULL
        AND (m.maturity_degree_index - m.god_implied_maturity_floor_index) <= -2
        THEN 'review'
      WHEN (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0)) <= -5 THEN 'review'
      WHEN sr.sector_god_percentile < 20 THEN 'review'
      WHEN es.last_event_at IS NULL AND ps.entry_date < NOW() - INTERVAL '180 days' THEN 'review'
      WHEN es.last_event_at IS NOT NULL AND es.last_event_at < NOW() - INTERVAL '365 days' THEN 'review'
      WHEN COALESCE(p.pillar_spread, 0) >= 38 AND COALESCE(p.pillar_min, 0) < 35 THEN 'review'
      WHEN (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0)) < 0 THEN 'watch'
      WHEN sr.sector_god_percentile < 40 THEN 'watch'
      WHEN es.last_event_at IS NOT NULL AND es.last_event_at < NOW() - INTERVAL '180 days' THEN 'watch'
      WHEN es.last_event_at IS NULL AND ps.entry_date < NOW() - INTERVAL '120 days' THEN 'watch'
      WHEN m.maturity_degree_index IS NOT NULL
        AND m.god_implied_maturity_floor_index IS NOT NULL
        AND (m.maturity_degree_index - m.god_implied_maturity_floor_index) = -1
        THEN 'watch'
      WHEN m.maturity_level IS NULL AND ps.entry_date < NOW() - INTERVAL '90 days' THEN 'watch'
      ELSE 'core'
    END AS health_tier
  FROM portfolio_summary ps
  LEFT JOIN sector_rank sr ON sr.id = ps.startup_id
  LEFT JOIN event_stats es ON es.startup_id = ps.startup_id
  LEFT JOIN pillar p ON p.id = ps.startup_id
  LEFT JOIN mat m ON m.id = ps.startup_id
)
SELECT
  base.*,
  CASE base.health_tier
    WHEN 'review' THEN 0
    WHEN 'watch' THEN 1
    WHEN 'core' THEN 2
    WHEN 'exited' THEN 3
    ELSE 2
  END AS health_tier_rank
FROM base;

COMMENT ON VIEW public.portfolio_health IS
  'Virtual portfolio: health tiers + Goldilocks (maturity vs GOD floor from maturityClassifier).';
