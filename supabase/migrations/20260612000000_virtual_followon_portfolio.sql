-- VIRTUAL FOLLOW-ON FUND
-- ======================
-- A second virtual fund that doubles down on Pythia's seed winners. When a company
-- already in the seed portfolio (virtual_portfolio) closes a LATER-STAGE round GOING
-- FORWARD, the Oracle records a $500K follow-on at that round's REAL post-money. MOIC
-- is then tracked from that honest entry point — a secondary, late-stage performance
-- variable that proves Pythia can press her bets, not just spot them early.
--
-- Kept in a separate table (not virtual_portfolio) so: (a) a company can be in both
-- the seed fund and the follow-on fund at once (the seed fund has a unique active
-- index on startup_id), and (b) the locked seed-fund MOIC is never affected.

CREATE TABLE IF NOT EXISTS virtual_followon_portfolio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id            UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  -- Link back to the seed position we are following on from (if any).
  seed_portfolio_id     UUID REFERENCES virtual_portfolio(id) ON DELETE SET NULL,
  -- The funding round event that triggered this follow-on (forward-only).
  entry_event_id        UUID REFERENCES portfolio_events(id) ON DELETE SET NULL,
  entry_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_round_type      TEXT,                      -- e.g. 'Series C'
  entry_valuation_usd   BIGINT NOT NULL,           -- REAL post-money at follow-on (honest entry)
  entry_god_score       INTEGER,
  entry_rationale       TEXT,
  check_usd             BIGINT NOT NULL DEFAULT 500000,
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','exited','acquired','ipo','written_off')),
  current_valuation_usd BIGINT,
  moic                  NUMERIC(8,2) DEFAULT 1.0,
  exit_date             TIMESTAMPTZ,
  exit_type             TEXT CHECK (exit_type IN ('acquisition','ipo','secondary','unknown')),
  exit_valuation_usd    BIGINT,
  source_url            TEXT,
  added_by              TEXT DEFAULT 'followon-fund',
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- One follow-on per triggering round event (natural idempotency; a company can still
-- have multiple follow-ons across multiple future rounds).
CREATE UNIQUE INDEX IF NOT EXISTS uq_followon_entry_event
  ON virtual_followon_portfolio (entry_event_id)
  WHERE entry_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_followon_startup ON virtual_followon_portfolio (startup_id);
CREATE INDEX IF NOT EXISTS idx_followon_status ON virtual_followon_portfolio (status);
CREATE INDEX IF NOT EXISTS idx_followon_entry_date ON virtual_followon_portfolio (entry_date DESC);

-- Reuse the seed fund's updated_at trigger function.
DROP TRIGGER IF EXISTS trg_followon_updated_at ON virtual_followon_portfolio;
CREATE TRIGGER trg_followon_updated_at
  BEFORE UPDATE ON virtual_followon_portfolio
  FOR EACH ROW EXECUTE FUNCTION update_vp_updated_at();
