-- Strategic exit / M&A propensity (heuristic score for portfolio + ranking — not securities advice)
-- Populated by: npx tsx scripts/compute-exit-propensity.ts --apply

ALTER TABLE public.startup_uploads
  ADD COLUMN IF NOT EXISTS exit_propensity_score integer,
  ADD COLUMN IF NOT EXISTS exit_propensity_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS exit_propensity_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS exit_propensity_tier text,
  ADD COLUMN IF NOT EXISTS exit_propensity_at timestamptz;

COMMENT ON COLUMN public.startup_uploads.exit_propensity_score IS '0-100 heuristic: acquisition/strategic exit propensity';
COMMENT ON COLUMN public.startup_uploads.exit_propensity_confidence IS '0-1 data-confidence (entity gate, URL, GOD depth)';
COMMENT ON COLUMN public.startup_uploads.exit_propensity_breakdown IS 'Four-factor breakdown + labels (server/services/exitPropensityService.ts)';

CREATE INDEX IF NOT EXISTS idx_startup_uploads_exit_propensity
  ON public.startup_uploads (exit_propensity_score DESC NULLS LAST)
  WHERE status = 'approved' AND exit_propensity_score IS NOT NULL;

-- portfolio_summary / portfolio_health: API merges exit_propensity_* from startup_uploads (avoids CASCADE view rebuilds)
