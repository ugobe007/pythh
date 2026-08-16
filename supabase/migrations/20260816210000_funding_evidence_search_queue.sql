CREATE TABLE IF NOT EXISTS public.funding_evidence_search_queue (
  startup_id uuid PRIMARY KEY REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','error')),
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  earliest_match_at timestamptz NOT NULL,
  last_searched_at timestamptz,
  search_provider text,
  result_count integer NOT NULL DEFAULT 0,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funding_search_queue_work ON public.funding_evidence_search_queue(status,priority DESC,updated_at);

CREATE TABLE IF NOT EXISTS public.funding_evidence_search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES public.investors(id),
  investor_name_raw text,
  event_date date,
  event_type text NOT NULL DEFAULT 'funding',
  round_type text,
  amount_raw text,
  source_url text NOT NULL,
  source_title text,
  source_provider text NOT NULL,
  resolution_status text NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending','resolved','rejected')),
  resolution_method text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(startup_id,source_url,investor_name_raw,event_date)
);
CREATE INDEX IF NOT EXISTS idx_funding_search_results_pair ON public.funding_evidence_search_results(startup_id,investor_id,event_date);

CREATE TABLE IF NOT EXISTS public.match_outcome_classifications (
  match_id uuid PRIMARY KEY REFERENCES public.startup_investor_matches(id) ON DELETE CASCADE,
  classification text NOT NULL CHECK (classification IN ('verified_funding','no_observed_funding','censored','unresolved')),
  evidence_id uuid REFERENCES public.match_validation_evidence(id),
  observation_window_days integer NOT NULL DEFAULT 180,
  observed_through timestamptz NOT NULL DEFAULT now(),
  classification_reason text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_match_outcome_classification ON public.match_outcome_classifications(classification);

ALTER TABLE public.funding_evidence_search_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_evidence_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_outcome_classifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.funding_evidence_search_queue,public.funding_evidence_search_results,public.match_outcome_classifications FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.seed_funding_evidence_search_queue()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  INSERT INTO public.funding_evidence_search_queue(startup_id,priority,earliest_match_at)
  SELECT startup_id, least(count(*)::integer,100000), min(created_at)
  FROM public.startup_investor_matches GROUP BY startup_id
  ON CONFLICT(startup_id) DO UPDATE SET
    priority=excluded.priority, earliest_match_at=least(funding_evidence_search_queue.earliest_match_at,excluded.earliest_match_at);
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.seed_funding_evidence_search_queue() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.refresh_match_outcome_classifications(p_limit integer DEFAULT 50000)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count bigint;
BEGIN
  INSERT INTO public.match_outcome_classifications(match_id,classification,evidence_id,classification_reason)
  SELECT m.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified_funding'
         WHEN pending.id IS NOT NULL THEN 'unresolved'
         WHEN q.status='complete' AND m.created_at<=now()-interval '180 days' THEN 'no_observed_funding'
         ELSE 'censored' END,
    verified.id,
    CASE WHEN verified.id IS NOT NULL THEN 'verified post-prediction funding evidence'
         WHEN pending.id IS NOT NULL THEN 'candidate evidence requires review'
         WHEN q.status='complete' AND m.created_at<=now()-interval '180 days' THEN 'completed web search; no verified event observed in window'
         ELSE 'search incomplete or observation window immature' END
  FROM public.startup_investor_matches m
  LEFT JOIN public.funding_evidence_search_queue q ON q.startup_id=m.startup_id
  LEFT JOIN LATERAL (SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.verified ORDER BY e.event_at LIMIT 1) verified ON true
  LEFT JOIN LATERAL (SELECT e.id FROM public.match_validation_evidence e WHERE e.match_id=m.id AND e.review_status='pending' ORDER BY e.event_at LIMIT 1) pending ON true
  WHERE NOT EXISTS (SELECT 1 FROM public.match_outcome_classifications c WHERE c.match_id=m.id)
  ORDER BY m.created_at,m.id LIMIT greatest(p_limit,0)
  ON CONFLICT(match_id) DO NOTHING;
  GET DIAGNOSTICS v_count=ROW_COUNT; RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.refresh_match_outcome_classifications(integer) FROM PUBLIC,anon,authenticated;
