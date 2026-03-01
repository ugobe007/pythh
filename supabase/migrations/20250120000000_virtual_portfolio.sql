-- =============================================================================
-- VIRTUAL PORTFOLIO (Pythh YC-style pick tracking)
-- Apply in: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql
-- =============================================================================

-- TABLE: virtual_portfolio
CREATE TABLE IF NOT EXISTS virtual_portfolio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id            UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  entry_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_stage           TEXT,
  entry_god_score       INTEGER,
  entry_valuation_usd   BIGINT,
  entry_rationale       TEXT,
  virtual_check_usd     BIGINT NOT NULL DEFAULT 100000,
  status                TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','exited','acquired','ipo','written_off')),
  exit_date             TIMESTAMPTZ,
  exit_type             TEXT CHECK (exit_type IN ('acquisition','ipo','secondary','unknown')),
  exit_valuation_usd    BIGINT,
  exit_acquirer         TEXT,
  exit_source_url       TEXT,
  current_valuation_usd BIGINT,
  moic                  NUMERIC(8,2),
  irr_annualized        NUMERIC(8,4),
  holding_days          INTEGER,
  added_by              TEXT DEFAULT 'auto',
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vp_startup_active_idx
  ON virtual_portfolio(startup_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS vp_status_idx      ON virtual_portfolio(status);
CREATE INDEX IF NOT EXISTS vp_entry_date_idx  ON virtual_portfolio(entry_date DESC);
CREATE INDEX IF NOT EXISTS vp_god_score_idx   ON virtual_portfolio(entry_god_score DESC);

-- TABLE: portfolio_events
CREATE TABLE IF NOT EXISTS portfolio_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id     UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  portfolio_id   UUID REFERENCES virtual_portfolio(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL CHECK (event_type IN (
                   'funding_round','acquisition','ipo',
                   'revenue_milestone','team_milestone','product_launch',
                   'god_score_change','prediction_hit'
                 )),
  event_date     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_usd     BIGINT,
  pre_money_usd  BIGINT,
  post_money_usd BIGINT,
  round_type     TEXT,
  lead_investor  TEXT,
  investors_list TEXT[],
  headline       TEXT,
  source_url     TEXT,
  source_name    TEXT,
  verified       BOOLEAN DEFAULT FALSE,
  god_score_before INTEGER,
  god_score_after  INTEGER,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pe_startup_idx    ON portfolio_events(startup_id);
CREATE INDEX IF NOT EXISTS pe_type_idx       ON portfolio_events(event_type);
CREATE INDEX IF NOT EXISTS pe_date_idx       ON portfolio_events(event_date DESC);
CREATE INDEX IF NOT EXISTS pe_portfolio_idx  ON portfolio_events(portfolio_id);

-- VIEW: portfolio_summary
CREATE OR REPLACE VIEW portfolio_summary AS
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

-- VIEW: portfolio_metrics
CREATE OR REPLACE VIEW portfolio_metrics AS
SELECT
  COUNT(*)                                                           AS total_picks,
  COUNT(*) FILTER (WHERE status = 'active')                         AS active_picks,
  COUNT(*) FILTER (WHERE status IN ('exited','acquired','ipo'))      AS successful_exits,
  COUNT(*) FILTER (WHERE status = 'acquired')                       AS acquisitions,
  COUNT(*) FILTER (WHERE status = 'ipo')                            AS ipos,
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

-- RLS
ALTER TABLE virtual_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read_portfolio ON virtual_portfolio
  FOR SELECT USING (true);

CREATE POLICY public_read_events ON portfolio_events
  FOR SELECT USING (true);

CREATE POLICY service_write_portfolio ON virtual_portfolio
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY service_write_events ON portfolio_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_vp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vp_updated_at ON virtual_portfolio;
CREATE TRIGGER trg_vp_updated_at
  BEFORE UPDATE ON virtual_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_vp_updated_at();
