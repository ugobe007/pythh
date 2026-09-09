-- Stamp when the same-day welcome (first shortlist) was sent so resubscribes do not spam.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;
