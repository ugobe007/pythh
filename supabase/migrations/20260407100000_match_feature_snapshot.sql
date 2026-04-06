-- Point-in-time structured features for ML / drift analysis (paired with match_feedback).
-- Populated by match generation paths; older rows remain NULL until backfill.

ALTER TABLE public.startup_investor_matches
  ADD COLUMN IF NOT EXISTS feature_snapshot jsonb;

COMMENT ON COLUMN public.startup_investor_matches.feature_snapshot IS
  'Startup + investor feature snapshot at match generation (v1 JSON: v, captured_at, engine, startup, investor). For training and aging analysis.';
