-- Newsletter signup stores the startup URL so the daily brief can attach matches.
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS startup_url text,
  ADD COLUMN IF NOT EXISTS startup_id uuid;

CREATE INDEX IF NOT EXISTS idx_newsletter_subs_startup_url
  ON newsletter_subscribers (startup_url)
  WHERE startup_url IS NOT NULL;
