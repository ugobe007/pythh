CREATE OR REPLACE FUNCTION public.seed_funding_evidence_search_queue()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  DELETE FROM public.funding_evidence_search_queue q USING public.startup_uploads s
  WHERE q.startup_id=s.id AND q.status IN ('pending','error')
    AND (s.status IS DISTINCT FROM 'approved' OR s.entity_gate='junk');

  INSERT INTO public.funding_evidence_search_queue(startup_id,priority,earliest_match_at)
  SELECT m.startup_id,least(count(*)::integer,100000),min(m.created_at)
  FROM public.startup_investor_matches m JOIN public.startup_uploads s ON s.id=m.startup_id
  WHERE s.status='approved' AND s.entity_gate IS DISTINCT FROM 'junk'
  GROUP BY m.startup_id
  ON CONFLICT(startup_id) DO UPDATE SET priority=excluded.priority,
    earliest_match_at=least(funding_evidence_search_queue.earliest_match_at,excluded.earliest_match_at);
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.seed_funding_evidence_search_queue() FROM PUBLIC,anon,authenticated;
