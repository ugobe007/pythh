-- Honest historical timeline: use observed creation time when present. Only fall
-- back to updated_at as a low-confidence estimate for legacy/null records.
-- Reconstructed snapshots contain persisted match outputs, not invented startup
-- or investor inputs, and are labeled accordingly.

CREATE OR REPLACE VIEW public.historical_match_timeline AS
SELECT
  m.id AS match_id,
  m.startup_id,
  m.investor_id,
  COALESCE(m.created_at, m.updated_at) AS prediction_at,
  CASE WHEN m.created_at IS NOT NULL THEN 'observed_created_at' ELSE 'estimated_updated_at' END AS prediction_at_method,
  CASE WHEN m.created_at IS NOT NULL THEN 1.00::numeric ELSE 0.35::numeric END AS prediction_at_confidence,
  m.algorithm_version,
  m.match_score,
  m.confidence_level,
  m.similarity_score,
  m.success_score,
  COALESCE(
    m.feature_snapshot,
    jsonb_build_object(
      'v', 'reconstructed-match-output-v1',
      'reconstructed', true,
      'reconstruction_basis', 'persisted_match_record',
      'captured_at', COALESCE(m.created_at, m.updated_at),
      'engine', m.algorithm_version,
      'outputs', jsonb_strip_nulls(jsonb_build_object(
        'match_score', m.match_score,
        'confidence_level', m.confidence_level,
        'similarity_score', m.similarity_score,
        'success_score', m.success_score
      ))
    )
  ) AS effective_feature_snapshot,
  CASE WHEN m.feature_snapshot IS NOT NULL THEN 'observed' ELSE 'reconstructed_match_outputs_only' END AS snapshot_method,
  CASE WHEN m.feature_snapshot IS NOT NULL THEN 1.00::numeric ELSE 0.60::numeric END AS snapshot_confidence,
  (m.feature_snapshot IS NOT NULL) AS has_observed_feature_snapshot
FROM public.startup_investor_matches m;

REVOKE ALL ON public.historical_match_timeline FROM anon, authenticated;
COMMENT ON VIEW public.historical_match_timeline IS
  'Historical match chronology with explicit observed/estimated time provenance and honest output-only reconstruction when original feature inputs are unavailable.';

ALTER TABLE public.match_validation_evidence
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.review_match_validation_evidence(
  p_evidence_id uuid, p_decision text, p_reviewer uuid, p_note text DEFAULT NULL
) RETURNS public.match_validation_evidence
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.match_validation_evidence;
BEGIN
  IF p_decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  UPDATE public.match_validation_evidence SET
    review_status=p_decision, review_note=nullif(btrim(p_note),''), reviewed_at=now(), reviewed_by=p_reviewer,
    verified=(p_decision='verified'),
    verified_at=CASE WHEN p_decision='verified' THEN now() ELSE NULL END,
    verified_by=CASE WHEN p_decision='verified' THEN p_reviewer ELSE NULL END
  WHERE id=p_evidence_id AND review_status='pending' RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'evidence not found or already reviewed'; END IF;
  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.review_match_validation_evidence(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;

-- Speculation and publisher-attribution headlines remain candidates for manual
-- review, but must not enter the evidence ledger as completed investments.
CREATE OR REPLACE FUNCTION public.correlate_structured_investment_events(p_limit integer DEFAULT 10000)
RETURNS TABLE(inserted_count bigint, candidate_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted bigint := 0; v_candidates bigint := 0;
BEGIN
  WITH unique_investors AS (
    SELECT lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) key, (array_agg(id))[1] investor_id
    FROM public.investors WHERE nullif(btrim(name), '') IS NOT NULL GROUP BY 1 HAVING count(*)=1
  ), unique_startups AS (
    SELECT lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) key, (array_agg(id))[1] startup_id
    FROM public.startup_uploads WHERE nullif(btrim(name), '') IS NOT NULL GROUP BY 1 HAVING count(*)=1
  ), resolved AS (
    SELECT e.*,i.investor_id,s.startup_id FROM public.startup_events e
    JOIN unique_investors i ON i.key=lower(regexp_replace(e.subject, '[^a-z0-9]+', '', 'g'))
    JOIN unique_startups s ON s.key=lower(regexp_replace(e.object, '[^a-z0-9]+', '', 'g'))
    WHERE e.event_type='INVESTMENT' AND e.source_url IS NOT NULL AND e.occurred_at IS NOT NULL
      AND e.source_title !~* '\m(in talks|plans? to|may invest|considering|could invest|reportedly|rumou?r)\M'
  ) SELECT count(*) INTO v_candidates FROM resolved;

  INSERT INTO public.match_validation_evidence(match_id,startup_id,investor_id,evidence_type,event_at,
    source_url,source_provider,source_record_type,source_record_id,resolution_method,resolution_confidence,raw_payload)
  WITH unique_investors AS (
    SELECT lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) key, (array_agg(id))[1] investor_id
    FROM public.investors WHERE nullif(btrim(name), '') IS NOT NULL GROUP BY 1 HAVING count(*)=1
  ), unique_startups AS (
    SELECT lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) key, (array_agg(id))[1] startup_id
    FROM public.startup_uploads WHERE nullif(btrim(name), '') IS NOT NULL GROUP BY 1 HAVING count(*)=1
  ), resolved AS (
    SELECT e.*,i.investor_id,s.startup_id FROM public.startup_events e
    JOIN unique_investors i ON i.key=lower(regexp_replace(e.subject, '[^a-z0-9]+', '', 'g'))
    JOIN unique_startups s ON s.key=lower(regexp_replace(e.object, '[^a-z0-9]+', '', 'g'))
    WHERE e.event_type='INVESTMENT' AND e.source_url IS NOT NULL AND e.occurred_at IS NOT NULL
      AND e.source_title !~* '\m(in talks|plans? to|may invest|considering|could invest|reportedly|rumou?r)\M'
    ORDER BY e.occurred_at DESC LIMIT greatest(p_limit,0)
  )
  SELECT m.id,r.startup_id,r.investor_id,'investment',r.occurred_at,r.source_url,
    COALESCE(r.source_publisher,'startup_events'),'startup_event',r.id::text,'name_exact_unique',.95,
    jsonb_build_object('event_id',r.event_id,'title',r.source_title,'subject',r.subject,'object',r.object,'entities',r.entities)
  FROM resolved r JOIN LATERAL (
    SELECT sim.id FROM public.startup_investor_matches sim
    WHERE sim.startup_id=r.startup_id AND sim.investor_id=r.investor_id AND sim.created_at<r.occurred_at
    ORDER BY sim.created_at DESC LIMIT 1
  ) m ON true ON CONFLICT(match_id,evidence_type,source_url,event_at) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN QUERY SELECT v_inserted,v_candidates;
END; $$;
REVOKE ALL ON FUNCTION public.correlate_structured_investment_events(integer) FROM PUBLIC, anon, authenticated;
