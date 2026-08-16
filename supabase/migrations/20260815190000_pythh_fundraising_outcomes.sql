-- Append-only evidence for the founder fundraising funnel.
-- This ledger is intentionally independent of match ranking and graph scoring.
CREATE TABLE IF NOT EXISTS public.pythh_fundraising_outcomes (
  id bigserial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.pythh_users(id) ON DELETE CASCADE,
  run_id varchar(64) NOT NULL,
  outreach_email_id integer REFERENCES public.pythh_outreach_emails(id) ON DELETE SET NULL,
  meeting_id integer REFERENCES public.pythh_meetings(id) ON DELETE SET NULL,
  event_type varchar(32) NOT NULL CHECK (event_type IN (
    'outreach_sent', 'reply_received', 'meeting_proposed', 'meeting_confirmed',
    'meeting_declined', 'diligence_started', 'term_sheet_received', 'capital_committed'
  )),
  source varchar(32) NOT NULL CHECK (source IN ('founder_action', 'pythia', 'resend', 'calendar', 'system')),
  verified integer NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  idempotency_key varchar(240) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pythh_fundraising_outcomes_idempotency
  ON public.pythh_fundraising_outcomes(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_pythh_fundraising_outcomes_run
  ON public.pythh_fundraising_outcomes(user_id, run_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pythh_fundraising_outcomes_event
  ON public.pythh_fundraising_outcomes(event_type, occurred_at DESC);

ALTER TABLE public.pythh_fundraising_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pythh_fundraising_outcomes FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.pythh_fundraising_outcomes_id_seq FROM anon, authenticated;
