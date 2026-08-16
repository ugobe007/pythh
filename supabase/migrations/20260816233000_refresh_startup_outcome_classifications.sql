CREATE OR REPLACE FUNCTION public.refresh_startup_match_outcome_classifications(p_startup_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  INSERT INTO public.match_outcome_classifications(match_id,classification,evidence_id,classification_reason,observed_through,classified_at)
  SELECT m.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified_funding'
         WHEN pending.id IS NOT NULL THEN 'unresolved'
         WHEN q.status='complete' AND m.created_at<=now()-interval '180 days' THEN 'no_observed_funding'
         ELSE 'censored' END,
    verified.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified post-prediction funding evidence'
         WHEN pending.id IS NOT NULL THEN 'candidate evidence requires review'
         WHEN q.status='complete' AND m.created_at<=now()-interval '180 days' THEN 'completed web search; no verified event observed in window'
         ELSE 'search incomplete or observation window immature' END,
    now(),now()
  FROM public.startup_investor_matches m
  LEFT JOIN public.funding_evidence_search_queue q ON q.startup_id=m.startup_id
  LEFT JOIN LATERAL (SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.verified ORDER BY e.event_at LIMIT 1) verified ON true
  LEFT JOIN LATERAL (SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.review_status='pending' ORDER BY e.event_at LIMIT 1) pending ON true
  WHERE m.startup_id=p_startup_id
  ON CONFLICT(match_id) DO UPDATE SET classification=excluded.classification,evidence_id=excluded.evidence_id,
    classification_reason=excluded.classification_reason,observed_through=excluded.observed_through,classified_at=excluded.classified_at;
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_startup_match_outcome_classifications(uuid) FROM PUBLIC,anon,authenticated;
