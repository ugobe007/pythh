/**
 * DB migration: creates virtual_portfolio + portfolio_events tables,
 * the portfolio_summary view, and the portfolio_metrics view.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const steps = [
  {
    name: 'virtual_portfolio table',
    sql: `
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
    `,
  },
  {
    name: 'virtual_portfolio indexes',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS vp_startup_active_idx ON virtual_portfolio(startup_id) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS vp_status_idx ON virtual_portfolio(status);
      CREATE INDEX IF NOT EXISTS vp_entry_date_idx ON virtual_portfolio(entry_date DESC);
      CREATE INDEX IF NOT EXISTS vp_god_score_idx ON virtual_portfolio(entry_god_score DESC);
    `,
  },
  {
    name: 'portfolio_events table',
    sql: `
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
    `,
  },
  {
    name: 'portfolio_events indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS pe_startup_idx    ON portfolio_events(startup_id);
      CREATE INDEX IF NOT EXISTS pe_type_idx       ON portfolio_events(event_type);
      CREATE INDEX IF NOT EXISTS pe_date_idx       ON portfolio_events(event_date DESC);
      CREATE INDEX IF NOT EXISTS pe_portfolio_idx  ON portfolio_events(portfolio_id);
    `,
  },
  {
    name: 'portfolio_summary view',
    sql: `
      CREATE OR REPLACE VIEW portfolio_summary AS
      SELECT
        vp.id,
        vp.startup_id,
        su.name                            AS startup_name,
        su.tagline,
        su.website,
        su.sectors,
        su.stage                           AS current_stage,
        vp.entry_date,
        vp.entry_stage,
        vp.entry_god_score,
        su.total_god_score                 AS current_god_score,
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
        (SELECT pe.round_type    FROM portfolio_events pe WHERE pe.startup_id = vp.startup_id AND pe.event_type = 'funding_round' ORDER BY pe.event_date DESC LIMIT 1) AS latest_round_type,
        (SELECT pe.post_money_usd FROM portfolio_events pe WHERE pe.startup_id = vp.startup_id AND pe.event_type = 'funding_round' ORDER BY pe.event_date DESC LIMIT 1) AS latest_round_post_money,
        (SELECT pe.lead_investor  FROM portfolio_events pe WHERE pe.startup_id = vp.startup_id AND pe.event_type = 'funding_round' ORDER BY pe.event_date DESC LIMIT 1) AS latest_lead_investor,
        (SELECT COUNT(*)           FROM portfolio_events pe WHERE pe.startup_id = vp.startup_id AND pe.event_type = 'funding_round') AS total_rounds_tracked,
        vp.added_by,
        vp.created_at
      FROM virtual_portfolio vp
      JOIN startup_uploads su ON su.id = vp.startup_id;
    `,
  },
  {
    name: 'portfolio_metrics view',
    sql: `
      CREATE OR REPLACE VIEW portfolio_metrics AS
      SELECT
        COUNT(*)                                                                      AS total_picks,
        COUNT(*) FILTER (WHERE status = 'active')                                     AS active_picks,
        COUNT(*) FILTER (WHERE status IN ('exited','acquired','ipo'))                  AS successful_exits,
        COUNT(*) FILTER (WHERE status = 'acquired')                                   AS acquisitions,
        COUNT(*) FILTER (WHERE status = 'ipo')                                        AS ipos,
        ROUND(
          100.0 * COUNT(*) FILTER (
            WHERE status IN ('exited','acquired','ipo')
               OR id IN (
                 SELECT DISTINCT portfolio_id FROM portfolio_events
                 WHERE event_type = 'funding_round' AND portfolio_id IS NOT NULL
               )
          ) / NULLIF(COUNT(*), 0)
        , 1)                                                                          AS win_rate_pct,
        ROUND(CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY holding_days)
          FILTER (WHERE status IN ('exited','acquired','ipo')) AS NUMERIC), 0)        AS median_holding_days,
        ROUND(AVG(moic)  FILTER (WHERE moic IS NOT NULL), 2)                          AS avg_moic,
        ROUND(MAX(moic)  FILTER (WHERE moic IS NOT NULL), 2)                          AS best_moic,
        ROUND(AVG(entry_god_score) FILTER (WHERE status IN ('exited','acquired','ipo')), 1) AS avg_exit_entry_god_score,
        SUM(virtual_check_usd)                                                        AS total_virtual_deployed_usd,
        NOW()                                                                         AS computed_at
      FROM virtual_portfolio;
    `,
  },
  {
    name: 'RLS policies',
    sql: `
      ALTER TABLE virtual_portfolio ENABLE ROW LEVEL SECURITY;
      ALTER TABLE portfolio_events  ENABLE ROW LEVEL SECURITY;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='virtual_portfolio' AND policyname='public_read_portfolio') THEN
          CREATE POLICY public_read_portfolio ON virtual_portfolio FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portfolio_events' AND policyname='public_read_events') THEN
          CREATE POLICY public_read_events ON portfolio_events FOR SELECT USING (true);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='virtual_portfolio' AND policyname='service_write_portfolio') THEN
          CREATE POLICY service_write_portfolio ON virtual_portfolio FOR ALL
            USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='portfolio_events' AND policyname='service_write_events') THEN
          CREATE POLICY service_write_events ON portfolio_events FOR ALL
            USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
        END IF;
      END $$;
    `,
  },
  {
    name: 'updated_at trigger',
    sql: `
      CREATE OR REPLACE FUNCTION update_vp_updated_at()
      RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_vp_updated_at ON virtual_portfolio;
      CREATE TRIGGER trg_vp_updated_at BEFORE UPDATE ON virtual_portfolio
        FOR EACH ROW EXECUTE FUNCTION update_vp_updated_at();
    `,
  },
];

let ok = 0;
for (const step of steps) {
  const { error } = await supabase.rpc('exec_sql', { sql: step.sql }).catch(() => ({ error: { message: 'rpc not available' } }));
  if (error?.message === 'rpc not available' || error?.code === '42883') {
    // Fallback: use REST API directly via raw SQL
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: step.sql }),
    });
    if (!res.ok) {
      // Try Supabase admin REST
      const adminRes = await fetch(`${process.env.VITE_SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY || '',
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: step.sql }),
      });
      if (!adminRes.ok) {
        console.error(`❌ ${step.name}: HTTP ${adminRes.status}`);
        continue;
      }
    }
  } else if (error) {
    console.error(`❌ ${step.name}:`, error.message);
    continue;
  }
  console.log(`✅ ${step.name}`);
  ok++;
}
console.log(`\nDone: ${ok}/${steps.length} steps`);
