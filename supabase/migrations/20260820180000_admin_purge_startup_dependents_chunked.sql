-- Chunked admin purge to avoid statement_timeout when deleting junk startups
-- that each have hundreds of startup_investor_matches / evidence rows.
-- Safe to re-run; replaces admin_purge_startup_dependents.

CREATE OR REPLACE FUNCTION public.admin_purge_startup_dependents(p_startup_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  n bigint;
  sid uuid;
  out jsonb := '{}'::jsonb;
  total_matches bigint := 0;
  total_evidence bigint := 0;
BEGIN
  IF p_startup_ids IS NULL OR cardinality(p_startup_ids) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'deleted', out);
  END IF;

  -- RESTRICT FK: clear evidence before matches / startups
  FOREACH sid IN ARRAY p_startup_ids LOOP
    LOOP
      DELETE FROM public.match_validation_evidence
      WHERE id IN (
        SELECT id FROM public.match_validation_evidence
        WHERE startup_id = sid
        LIMIT 100
      );
      GET DIAGNOSTICS n = ROW_COUNT;
      total_evidence := total_evidence + n;
      EXIT WHEN n = 0;
    END LOOP;

    LOOP
      DELETE FROM public.startup_investor_matches
      WHERE id IN (
        SELECT id FROM public.startup_investor_matches
        WHERE startup_id = sid
        LIMIT 100
      );
      GET DIAGNOSTICS n = ROW_COUNT;
      total_matches := total_matches + n;
      EXIT WHEN n = 0;
    END LOOP;
  END LOOP;
  out := out || jsonb_build_object(
    'match_validation_evidence', total_evidence,
    'startup_investor_matches', total_matches
  );

  DELETE FROM public.social_signals WHERE startup_id = ANY (p_startup_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  out := out || jsonb_build_object('social_signals', n);

  BEGIN
    DELETE FROM public.funding_evidence_search_results WHERE startup_id = ANY (p_startup_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || jsonb_build_object('funding_evidence_search_results', n);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

  BEGIN
    DELETE FROM public.funding_evidence_search_queue WHERE startup_id = ANY (p_startup_ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    out := out || jsonb_build_object('funding_evidence_search_queue', n);
  EXCEPTION WHEN undefined_table THEN NULL;
  END;

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
  'Chunked delete of child rows before admin hard-delete. Avoids statement_timeout on large match cascades.';
