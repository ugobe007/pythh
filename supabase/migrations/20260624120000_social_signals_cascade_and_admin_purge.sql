-- social_signals FK blocks hard-delete of junk startups from admin tools.
-- 1) CASCADE on delete
-- 2) SECURITY DEFINER purge RPC (works even when PostgREST client lacks row delete on children)

ALTER TABLE public.social_signals
  DROP CONSTRAINT IF EXISTS social_signals_startup_id_fkey;

ALTER TABLE public.social_signals
  ADD CONSTRAINT social_signals_startup_id_fkey
  FOREIGN KEY (startup_id) REFERENCES public.startup_uploads(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.admin_purge_startup_dependents(p_startup_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  out jsonb := '{}'::jsonb;
BEGIN
  IF p_startup_ids IS NULL OR cardinality(p_startup_ids) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'deleted', out);
  END IF;

  DELETE FROM public.social_signals WHERE startup_id = ANY (p_startup_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  out := out || jsonb_build_object('social_signals', n);

  DELETE FROM public.startup_investor_matches WHERE startup_id = ANY (p_startup_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  out := out || jsonb_build_object('startup_investor_matches', n);

  BEGIN
    DELETE FROM public.score_history WHERE startup_id = ANY (p_startup_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || jsonb_build_object('score_history', n);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.match_gen_logs WHERE startup_id = ANY (p_startup_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || jsonb_build_object('match_gen_logs', n);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.startup_signal_history WHERE startup_id = ANY (p_startup_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || jsonb_build_object('startup_signal_history', n);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'deleted', out);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_startup_dependents(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_startup_dependents(uuid[]) TO service_role;

COMMENT ON FUNCTION public.admin_purge_startup_dependents(uuid[]) IS
  'Delete child rows referencing startup_uploads before admin hard-delete. SECURITY DEFINER bypasses RLS.';
