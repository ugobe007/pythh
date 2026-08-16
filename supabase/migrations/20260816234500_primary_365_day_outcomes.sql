-- Primary venture outcome window is 365 days. 180-day observations remain
-- useful interim telemetry but are not definitive negative labels.
ALTER TABLE public.match_outcome_classifications
  ALTER COLUMN observation_window_days SET DEFAULT 365;
UPDATE public.match_outcome_classifications SET observation_window_days=365 WHERE observation_window_days<>365;

CREATE OR REPLACE VIEW public.historical_match_validation_dataset AS
WITH positives AS (
  SELECT e.match_id,count(*)::integer positive_evidence_count,min(e.event_at) first_positive_at,
         array_agg(DISTINCT e.evidence_type) evidence_types
  FROM public.match_validation_evidence e JOIN public.startup_investor_matches m ON m.id=e.match_id
  WHERE e.verified AND e.startup_id=m.startup_id AND e.investor_id=m.investor_id AND e.event_at>m.created_at
  GROUP BY e.match_id
)
SELECT m.id match_id,m.startup_id,m.investor_id,m.created_at prediction_at,m.algorithm_version,m.match_score,m.feature_snapshot,
  COALESCE(p.positive_evidence_count,0) positive_evidence_count,p.first_positive_at,
  COALESCE(p.evidence_types,'{}'::text[]) evidence_types,
  CASE WHEN p.match_id IS NOT NULL THEN 1 WHEN m.created_at<=now()-interval '365 days' THEN 0 ELSE NULL END outcome_label,
  CASE WHEN p.match_id IS NOT NULL THEN 'verified_post_prediction_event'
       WHEN m.created_at<=now()-interval '365 days' THEN 'exposed_no_verified_event'
       ELSE 'insufficient_observation_window' END label_reason
FROM public.startup_investor_matches m LEFT JOIN positives p ON p.match_id=m.id;
REVOKE ALL ON public.historical_match_validation_dataset FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.refresh_startup_match_outcome_classifications(p_startup_id uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  INSERT INTO public.match_outcome_classifications(match_id,classification,evidence_id,observation_window_days,classification_reason,observed_through,classified_at)
  SELECT m.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified_funding' WHEN pending.id IS NOT NULL THEN 'unresolved'
         WHEN q.status='complete' AND m.created_at<=now()-interval '365 days' THEN 'no_observed_funding' ELSE 'censored' END,
    verified.id,365,
    CASE WHEN verified.id IS NOT NULL THEN 'verified post-prediction funding evidence'
         WHEN pending.id IS NOT NULL THEN 'candidate evidence requires review'
         WHEN q.status='complete' AND m.created_at<=now()-interval '365 days' THEN 'completed web search; no verified event observed in 365-day window'
         ELSE '365-day observation window incomplete' END,now(),now()
  FROM public.startup_investor_matches m LEFT JOIN public.funding_evidence_search_queue q ON q.startup_id=m.startup_id
  LEFT JOIN LATERAL(SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.verified ORDER BY e.event_at LIMIT 1) verified ON true
  LEFT JOIN LATERAL(SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.review_status='pending' ORDER BY e.event_at LIMIT 1) pending ON true
  WHERE m.startup_id=p_startup_id
  ON CONFLICT(match_id) DO UPDATE SET classification=excluded.classification,evidence_id=excluded.evidence_id,
    observation_window_days=365,classification_reason=excluded.classification_reason,observed_through=excluded.observed_through,classified_at=excluded.classified_at;
  GET DIAGNOSTICS v_count=ROW_COUNT;RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_startup_match_outcome_classifications(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.refresh_match_outcome_classifications(p_limit integer DEFAULT 50000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  INSERT INTO public.match_outcome_classifications(match_id,classification,evidence_id,observation_window_days,classification_reason)
  SELECT m.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified_funding' WHEN pending.id IS NOT NULL THEN 'unresolved'
         WHEN q.status='complete' AND m.created_at<=now()-interval '365 days' THEN 'no_observed_funding' ELSE 'censored' END,
    verified.id,365,
    CASE WHEN verified.id IS NOT NULL THEN 'verified post-prediction funding evidence'
         WHEN pending.id IS NOT NULL THEN 'candidate evidence requires review'
         WHEN q.status='complete' AND m.created_at<=now()-interval '365 days' THEN 'completed web search; no verified event observed in 365-day window'
         ELSE '365-day observation window incomplete' END
  FROM public.startup_investor_matches m LEFT JOIN public.funding_evidence_search_queue q ON q.startup_id=m.startup_id
  LEFT JOIN LATERAL(SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.verified ORDER BY e.event_at LIMIT 1) verified ON true
  LEFT JOIN LATERAL(SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.review_status='pending' ORDER BY e.event_at LIMIT 1) pending ON true
  WHERE NOT EXISTS(SELECT 1 FROM public.match_outcome_classifications c WHERE c.match_id=m.id)
  ORDER BY m.created_at,m.id LIMIT greatest(p_limit,0) ON CONFLICT(match_id) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT;RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_match_outcome_classifications(integer) FROM PUBLIC,anon,authenticated;

-- Reclassify every already-searched startup. Since production matching began in
-- January 2026, all non-positive rows currently become window-incomplete.
SELECT public.refresh_startup_match_outcome_classifications(startup_id)
FROM public.funding_evidence_search_queue WHERE status='complete';
