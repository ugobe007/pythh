-- Daily snapshots of startup_signal_scores.signals_total so true signal-SCORE slope velocity
-- becomes computable over time. startup_signal_scores holds only the current row (one per
-- startup, upserted in place), so there is no history to differentiate. This table records a
-- daily point so signalVelocity can move from event-rate velocity to real score-slope velocity.

CREATE TABLE IF NOT EXISTS startup_signal_score_history (
  id BIGSERIAL PRIMARY KEY,
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  signals_total NUMERIC(4,1),
  founder_language_shift NUMERIC,
  investor_receptivity NUMERIC,
  news_momentum NUMERIC,
  capital_convergence NUMERIC,
  execution_velocity NUMERIC,
  captured_on DATE NOT NULL DEFAULT CURRENT_DATE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One snapshot per startup per day (idempotent daily cron).
CREATE UNIQUE INDEX IF NOT EXISTS uq_signal_score_history_startup_day
  ON startup_signal_score_history (startup_id, captured_on);

CREATE INDEX IF NOT EXISTS idx_signal_score_history_startup_time
  ON startup_signal_score_history (startup_id, captured_at DESC);

NOTIFY pgrst, 'reload schema';
