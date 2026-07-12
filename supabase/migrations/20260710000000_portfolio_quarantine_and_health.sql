-- Portfolio integrity: entity quarantine, entered-late flags, health model tuning.

ALTER TABLE virtual_portfolio
  ADD COLUMN IF NOT EXISTS entity_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS entity_quarantine_reason TEXT,
  ADD COLUMN IF NOT EXISTS entered_late BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN virtual_portfolio.entity_quarantined IS
  'Wrong-company match or unverified mark — excluded from headline MOIC and outreach.';
COMMENT ON COLUMN virtual_portfolio.entered_late IS
  'Entry valuation >= $200M at pick — excluded from seed-stage headline MOIC.';

-- portfolio_summary exposes flags for API + health view
DROP VIEW IF EXISTS portfolio_health;
DROP VIEW IF EXISTS portfolio_summary;

CREATE VIEW portfolio_summary AS
SELECT
  vp.id,
  vp.startup_id,
  su.name                   AS startup_name,
  su.tagline,
  su.website,
  su.sectors,
  su.stage                  AS current_stage,
  vp.entry_date,
  vp.entry_stage,
  vp.entry_god_score,
  su.total_god_score        AS current_god_score,
  vp.entry_valuation_usd,
  vp.current_valuation_usd,
  vp.virtual_check_usd,
  vp.status,
  vp.exit_date,
  vp.exit_type,
  vp.exit_valuation_usd,
  vp.exit_acquirer,
  vp.moic,
  vp.irr_annualized,
  vp.holding_days,
  vp.entry_rationale,
  vp.notes,
  vp.entity_quarantined,
  vp.entity_quarantine_reason,
  vp.entered_late,
  (SELECT pe.round_type
     FROM portfolio_events pe
    WHERE pe.startup_id = vp.startup_id
      AND pe.event_type = 'funding_round'
    ORDER BY pe.event_date DESC LIMIT 1)  AS latest_round_type,
  (SELECT pe.post_money_usd
     FROM portfolio_events pe
    WHERE pe.startup_id = vp.startup_id
      AND pe.event_type = 'funding_round'
    ORDER BY pe.event_date DESC LIMIT 1)  AS latest_round_post_money,
  (SELECT pe.lead_investor
     FROM portfolio_events pe
    WHERE pe.startup_id = vp.startup_id
      AND pe.event_type = 'funding_round'
    ORDER BY pe.event_date DESC LIMIT 1)  AS latest_lead_investor,
  (SELECT COUNT(*)
     FROM portfolio_events pe
    WHERE pe.startup_id = vp.startup_id
      AND pe.event_type = 'funding_round') AS total_rounds_tracked,
  vp.added_by,
  vp.created_at
FROM virtual_portfolio vp
JOIN startup_uploads su ON su.id = vp.startup_id;

-- Health: verified funding in last 90d clears pillar-only review; expose quarantine flags
CREATE OR REPLACE VIEW portfolio_health AS
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
    COUNT(*) FILTER (WHERE pe.event_date >= NOW() - INTERVAL '180 days')::integer AS events_last_180d,
    COUNT(*) FILTER (
      WHERE pe.event_type = 'funding_round'
        AND pe.verified = TRUE
        AND pe.event_date >= NOW() - INTERVAL '90 days'
    )::integer AS verified_funding_last_90d
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
base AS (
  SELECT
    ps.*,
    sr.primary_sector,
    sr.sector_god_percentile,
    (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0))::integer AS god_delta,
    p.pillar_spread,
    p.pillar_min,
    es.last_event_at,
    COALESCE(es.verified_funding_last_90d, 0) AS verified_funding_last_90d,
    CASE
      WHEN es.last_event_at IS NOT NULL
      THEN EXTRACT(DAY FROM (NOW() - es.last_event_at))::integer
      ELSE NULL
    END AS days_since_last_event,
    COALESCE(es.events_last_180d, 0) AS events_last_180d,
    CASE
      WHEN ps.entity_quarantined = TRUE THEN 'quarantined'
      WHEN ps.status <> 'active' THEN 'exited'
      WHEN (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0)) <= -5 THEN 'review'
      WHEN sr.sector_god_percentile < 20 THEN 'review'
      WHEN es.last_event_at IS NULL AND ps.entry_date < NOW() - INTERVAL '180 days' THEN 'review'
      WHEN es.last_event_at IS NOT NULL AND es.last_event_at < NOW() - INTERVAL '365 days' THEN 'review'
      WHEN COALESCE(p.pillar_spread, 0) >= 38
           AND COALESCE(p.pillar_min, 0) < 35
           AND COALESCE(es.verified_funding_last_90d, 0) = 0 THEN 'review'
      WHEN (COALESCE(ps.current_god_score, 0) - COALESCE(ps.entry_god_score, 0)) < 0 THEN 'watch'
      WHEN sr.sector_god_percentile < 40 THEN 'watch'
      WHEN es.last_event_at IS NOT NULL AND es.last_event_at < NOW() - INTERVAL '180 days' THEN 'watch'
      WHEN es.last_event_at IS NULL AND ps.entry_date < NOW() - INTERVAL '120 days' THEN 'watch'
      ELSE 'core'
    END AS health_tier
  FROM portfolio_summary ps
  LEFT JOIN sector_rank sr ON sr.id = ps.startup_id
  LEFT JOIN event_stats es ON es.startup_id = ps.startup_id
  LEFT JOIN pillar p ON p.id = ps.startup_id
)
SELECT
  base.*,
  CASE base.health_tier
    WHEN 'quarantined' THEN -1
    WHEN 'review' THEN 0
    WHEN 'watch' THEN 1
    WHEN 'core' THEN 2
    WHEN 'exited' THEN 3
    ELSE 2
  END AS health_tier_rank
FROM base;

COMMENT ON VIEW portfolio_health IS
  'Virtual portfolio health tiers (quarantined|core|watch|review|exited). Pillar review skipped when verified funding in 90d.';

-- Headline metrics exclude quarantined + entered-late MOIC inflation
DROP VIEW IF EXISTS portfolio_metrics;

CREATE VIEW portfolio_metrics AS
SELECT
  COUNT(*)                                                           AS total_picks,
  COUNT(*) FILTER (WHERE status = 'active')                         AS active_picks,
  COUNT(*) FILTER (WHERE status IN ('exited','acquired','ipo'))      AS successful_exits,
  COUNT(*) FILTER (WHERE status = 'acquired')                       AS acquisitions,
  COUNT(*) FILTER (WHERE status = 'ipo')                            AS ipos,
  COUNT(*) FILTER (WHERE entity_quarantined = TRUE)               AS quarantined_picks,
  COUNT(*) FILTER (WHERE entered_late = TRUE)                     AS entered_late_picks,
  COUNT(*) FILTER (
    WHERE id IN (
      SELECT DISTINCT portfolio_id FROM portfolio_events
      WHERE event_type = 'funding_round' AND portfolio_id IS NOT NULL
    )
  )                                                                  AS funded_picks,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE id IN (
      SELECT DISTINCT portfolio_id FROM portfolio_events
      WHERE event_type = 'funding_round' AND portfolio_id IS NOT NULL
    )
  ) / NULLIF(COUNT(*), 0), 1)                                       AS funded_rate_pct,
  COUNT(*) FILTER (
    WHERE id IN (
      SELECT DISTINCT portfolio_id FROM portfolio_events
      WHERE event_type = 'funding_round'
        AND portfolio_id IS NOT NULL
        AND verified = TRUE
    )
  )                                                                  AS verified_funded_picks,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE id IN (
      SELECT DISTINCT portfolio_id FROM portfolio_events
      WHERE event_type = 'funding_round'
        AND portfolio_id IS NOT NULL
        AND verified = TRUE
    )
  ) / NULLIF(COUNT(*), 0), 1)                                       AS verified_funded_rate_pct,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE status IN ('exited','acquired','ipo')
    OR id IN (
      SELECT DISTINCT portfolio_id FROM portfolio_events
      WHERE event_type = 'funding_round' AND portfolio_id IS NOT NULL
    )
  ) / NULLIF(COUNT(*), 0), 1)                                       AS win_rate_pct,
  ROUND(
    CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY holding_days)
         FILTER (WHERE status IN ('exited','acquired','ipo')) AS NUMERIC)
  , 0)                                                               AS median_holding_days,
  ROUND(AVG(moic) FILTER (
    WHERE moic IS NOT NULL
      AND entity_quarantined = FALSE
      AND entered_late = FALSE
  ), 2)                                                              AS avg_moic,
  ROUND(MAX(moic) FILTER (
    WHERE moic IS NOT NULL
      AND entity_quarantined = FALSE
      AND entered_late = FALSE
  ), 2)                                                              AS best_moic,
  ROUND(AVG(entry_god_score) FILTER (
    WHERE status IN ('exited','acquired','ipo')
  ), 1)                                                              AS avg_exit_entry_god_score,
  SUM(virtual_check_usd)                                            AS total_virtual_deployed_usd,
  NOW()                                                              AS computed_at
FROM virtual_portfolio;
