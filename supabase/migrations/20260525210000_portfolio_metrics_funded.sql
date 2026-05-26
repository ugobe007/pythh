-- Split portfolio headline metrics: funded picks vs formal exits (clearer than win_rate alone).

DROP VIEW IF EXISTS portfolio_metrics;

CREATE VIEW portfolio_metrics AS
SELECT
  COUNT(*)                                                           AS total_picks,
  COUNT(*) FILTER (WHERE status = 'active')                         AS active_picks,
  COUNT(*) FILTER (WHERE status IN ('exited','acquired','ipo'))      AS successful_exits,
  COUNT(*) FILTER (WHERE status = 'acquired')                       AS acquisitions,
  COUNT(*) FILTER (WHERE status = 'ipo')                            AS ipos,
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
  ROUND(AVG(moic) FILTER (WHERE moic IS NOT NULL), 2)               AS avg_moic,
  ROUND(MAX(moic) FILTER (WHERE moic IS NOT NULL), 2)               AS best_moic,
  ROUND(AVG(entry_god_score) FILTER (
    WHERE status IN ('exited','acquired','ipo')
  ), 1)                                                              AS avg_exit_entry_god_score,
  SUM(virtual_check_usd)                                            AS total_virtual_deployed_usd,
  NOW()                                                              AS computed_at
FROM virtual_portfolio;
