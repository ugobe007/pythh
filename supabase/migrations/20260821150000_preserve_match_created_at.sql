-- Seal Hit@5 prediction clocks: match created_at is immutable after insert.
-- Live rematch/rescore may update scores but must not rewrite when the prediction was made.

CREATE OR REPLACE FUNCTION public.preserve_startup_investor_match_created_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_startup_investor_match_created_at
  ON public.startup_investor_matches;

CREATE TRIGGER trg_preserve_startup_investor_match_created_at
  BEFORE UPDATE ON public.startup_investor_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_startup_investor_match_created_at();

COMMENT ON FUNCTION public.preserve_startup_investor_match_created_at() IS
  'Keeps startup_investor_matches.created_at immutable so Hit@5 prediction clocks survive upsert/rescore.';

NOTIFY pgrst, 'reload schema';
