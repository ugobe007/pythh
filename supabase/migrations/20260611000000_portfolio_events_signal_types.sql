-- Daily portfolio signal tracker records broader material signals than the original
-- funding/exit set. Extend the event_type allow-list with partnership, customer win,
-- and key hire so portfolio-daily-signals.mjs can persist them.
ALTER TABLE portfolio_events DROP CONSTRAINT IF EXISTS portfolio_events_event_type_check;
ALTER TABLE portfolio_events ADD CONSTRAINT portfolio_events_event_type_check CHECK (
  event_type IN (
    'funding_round','acquisition','ipo',
    'revenue_milestone','team_milestone','product_launch',
    'god_score_change','prediction_hit',
    'partnership','customer_win','key_hire'
  )
);
