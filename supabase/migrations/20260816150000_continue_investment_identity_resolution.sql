-- Continue through the unresolved corpus instead of repeatedly selecting rows
-- already placed in the manual review queue by an earlier batch.
CREATE OR REPLACE FUNCTION public.resolve_investment_startup_ids(p_limit integer DEFAULT 10000)
RETURNS TABLE(domain_resolved bigint, name_resolved bigint, queued bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_domain bigint := 0; v_name bigint := 0; v_queued bigint := 0;
BEGIN
  CREATE TEMP TABLE _resolution_targets ON COMMIT DROP AS
    SELECT ii.id FROM public.investor_investments ii
    WHERE ii.startup_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.investment_identity_resolution_queue q WHERE q.investor_investment_id = ii.id)
    ORDER BY ii.id LIMIT greatest(p_limit, 0);

  WITH unique_domains AS (
    SELECT split_part(lower(regexp_replace(regexp_replace(website, '^https?://', ''), '^www\.', '')), '/', 1) key,
           (array_agg(id))[1] startup_id
    FROM public.startup_uploads WHERE nullif(btrim(website), '') IS NOT NULL GROUP BY 1 HAVING count(*) = 1
  ), candidates AS (
    SELECT ii.id, u.startup_id FROM public.investor_investments ii JOIN _resolution_targets t USING(id)
    JOIN unique_domains u ON u.key = split_part(lower(regexp_replace(regexp_replace(ii.company_url, '^https?://', ''), '^www\.', '')), '/', 1)
    WHERE nullif(btrim(ii.company_url), '') IS NOT NULL
  )
  UPDATE public.investor_investments ii SET startup_id=c.startup_id, startup_resolution_method='domain_exact',
    startup_resolution_confidence=1, startup_resolved_at=now(), updated_at=now()
  FROM candidates c WHERE ii.id=c.id AND ii.startup_id IS NULL;
  GET DIAGNOSTICS v_domain = ROW_COUNT;

  WITH unique_names AS (
    SELECT lower(regexp_replace(name, '[^a-z0-9]+', '', 'g')) key, (array_agg(id))[1] startup_id
    FROM public.startup_uploads WHERE nullif(btrim(name), '') IS NOT NULL GROUP BY 1 HAVING count(*) = 1
  ), candidates AS (
    SELECT ii.id, u.startup_id FROM public.investor_investments ii JOIN _resolution_targets t USING(id)
    JOIN unique_names u ON u.key=lower(regexp_replace(ii.company_name, '[^a-z0-9]+', '', 'g'))
    WHERE ii.startup_id IS NULL
  )
  UPDATE public.investor_investments ii SET startup_id=c.startup_id, startup_resolution_method='name_exact_unique',
    startup_resolution_confidence=.95, startup_resolved_at=now(), updated_at=now()
  FROM candidates c WHERE ii.id=c.id AND ii.startup_id IS NULL;
  GET DIAGNOSTICS v_name = ROW_COUNT;

  INSERT INTO public.investment_identity_resolution_queue(investor_investment_id,investor_id,raw_company_name,raw_company_url)
  SELECT ii.id,ii.investor_id,ii.company_name,ii.company_url FROM public.investor_investments ii
  JOIN _resolution_targets t USING(id) WHERE ii.startup_id IS NULL ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_queued = ROW_COUNT;
  RETURN QUERY SELECT v_domain,v_name,v_queued;
END; $$;
REVOKE ALL ON FUNCTION public.resolve_investment_startup_ids(integer) FROM PUBLIC, anon, authenticated;

-- Structured INVESTMENT events encode investor as SUBJECT and startup as OBJECT.
-- Correlate only globally unique exact names and only to a match predating the event.
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
  )
  SELECT count(*) INTO v_candidates FROM public.startup_events e
  JOIN unique_investors i ON i.key=lower(regexp_replace(e.subject, '[^a-z0-9]+', '', 'g'))
  JOIN unique_startups s ON s.key=lower(regexp_replace(e.object, '[^a-z0-9]+', '', 'g'))
  WHERE e.event_type='INVESTMENT' AND e.source_url IS NOT NULL AND e.occurred_at IS NOT NULL;

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
    WHERE e.event_type='INVESTMENT' AND nullif(btrim(e.source_url), '') IS NOT NULL AND e.occurred_at IS NOT NULL
    ORDER BY e.occurred_at DESC
  ), matched AS (
    SELECT r.*, m.id match_id FROM resolved r JOIN LATERAL (
      SELECT sim.id FROM public.startup_investor_matches sim
      WHERE sim.startup_id=r.startup_id AND sim.investor_id=r.investor_id AND sim.created_at<r.occurred_at
      ORDER BY sim.created_at DESC LIMIT 1
    ) m ON true
    ORDER BY r.occurred_at DESC
    LIMIT greatest(p_limit,0)
  )
  SELECT match_id,startup_id,investor_id,'investment',occurred_at,source_url,
    COALESCE(source_publisher,'startup_events'),'startup_event',id::text,'name_exact_unique',.95,
    jsonb_build_object('event_id',event_id,'title',source_title,'subject',subject,'object',object,'entities',entities)
  FROM matched
  ON CONFLICT(match_id,evidence_type,source_url,event_at) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN QUERY SELECT v_inserted,v_candidates;
END; $$;
REVOKE ALL ON FUNCTION public.correlate_structured_investment_events(integer) FROM PUBLIC, anon, authenticated;
