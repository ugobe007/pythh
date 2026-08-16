-- External outcomes are retrospective validation for a timestamped Pythh match.
-- Never infer a positive without canonical pair identity, provenance, and strict
-- temporal ordering (event_at > match_created_at).

ALTER TABLE public.investor_investments
  ADD COLUMN IF NOT EXISTS startup_resolution_method text,
  ADD COLUMN IF NOT EXISTS startup_resolution_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS startup_resolved_at timestamptz;

CREATE TABLE IF NOT EXISTS public.match_validation_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.startup_investor_matches(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE RESTRICT,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL CHECK (evidence_type IN ('meeting', 'diligence', 'term_sheet', 'investment', 'funding')),
  event_at timestamptz NOT NULL,
  source_url text NOT NULL CHECK (length(btrim(source_url)) > 0),
  source_provider text NOT NULL,
  source_record_type text,
  source_record_id text,
  resolution_method text NOT NULL CHECK (resolution_method IN ('canonical_id', 'domain_exact', 'name_exact_unique', 'manual_review')),
  resolution_confidence numeric(5,4) NOT NULL CHECK (resolution_confidence >= 0 AND resolution_confidence <= 1),
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, evidence_type, source_url, event_at),
  CHECK (NOT verified OR (verified_at IS NOT NULL AND verified_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_match_validation_evidence_pair_event
  ON public.match_validation_evidence(startup_id, investor_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_validation_evidence_match_verified
  ON public.match_validation_evidence(match_id) WHERE verified;

CREATE TABLE IF NOT EXISTS public.investment_identity_resolution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_investment_id uuid NOT NULL UNIQUE REFERENCES public.investor_investments(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  raw_company_name text NOT NULL,
  raw_company_url text,
  candidate_startup_ids uuid[] NOT NULL DEFAULT '{}',
  resolution_status text NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'rejected')),
  resolved_startup_id uuid REFERENCES public.startup_uploads(id),
  resolution_method text,
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((resolution_status = 'resolved') = (resolved_startup_id IS NOT NULL))
);

CREATE OR REPLACE VIEW public.historical_match_validation_dataset AS
WITH positives AS (
  SELECT e.match_id, count(*)::integer AS positive_evidence_count,
         min(e.event_at) AS first_positive_at,
         array_agg(DISTINCT e.evidence_type) AS evidence_types
  FROM public.match_validation_evidence e
  JOIN public.startup_investor_matches m ON m.id = e.match_id
  WHERE e.verified
    AND e.startup_id = m.startup_id
    AND e.investor_id = m.investor_id
    AND e.event_at > m.created_at
  GROUP BY e.match_id
)
SELECT m.id AS match_id, m.startup_id, m.investor_id, m.created_at AS prediction_at,
       m.algorithm_version, m.match_score, m.feature_snapshot,
       COALESCE(p.positive_evidence_count, 0) AS positive_evidence_count,
       p.first_positive_at, COALESCE(p.evidence_types, '{}'::text[]) AS evidence_types,
       CASE
         WHEN p.match_id IS NOT NULL THEN 1
         WHEN m.created_at <= now() - interval '180 days' THEN 0
         ELSE NULL
       END AS outcome_label,
       CASE
         WHEN p.match_id IS NOT NULL THEN 'verified_post_prediction_event'
         WHEN m.created_at <= now() - interval '180 days' THEN 'exposed_no_verified_event'
         ELSE 'insufficient_observation_window'
       END AS label_reason
FROM public.startup_investor_matches m
LEFT JOIN positives p ON p.match_id = m.id;

ALTER TABLE public.match_validation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_identity_resolution_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_validation_evidence FROM anon, authenticated;
REVOKE ALL ON public.investment_identity_resolution_queue FROM anon, authenticated;
REVOKE ALL ON public.historical_match_validation_dataset FROM anon, authenticated;

COMMENT ON VIEW public.historical_match_validation_dataset IS
  'Leakage-safe offline cohort: verified events after prediction are positive; sufficiently observed unmatched predictions are exposure-aware negatives.';

-- Promote only complete, independently sourced investment rows. The match join
-- uses both canonical IDs and strict time ordering, preventing name-only credit
-- and pre-existing portfolio companies from validating later predictions.
CREATE OR REPLACE FUNCTION public.ingest_canonical_investment_evidence(p_limit integer DEFAULT 10000)
RETURNS TABLE(inserted_count bigint, skipped_incomplete bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted bigint := 0;
  v_skipped bigint := 0;
BEGIN
  SELECT count(*) INTO v_skipped
  FROM public.investor_investments ii
  WHERE ii.startup_id IS NULL OR ii.investment_date IS NULL OR nullif(btrim(ii.source_url), '') IS NULL;

  INSERT INTO public.match_validation_evidence (
    match_id, startup_id, investor_id, evidence_type, event_at, source_url,
    source_provider, source_record_type, source_record_id,
    resolution_method, resolution_confidence, raw_payload
  )
  SELECT m.id, ii.startup_id, ii.investor_id, 'investment', ii.investment_date::timestamptz,
         ii.source_url, 'investor_investments', 'investor_investment', ii.id::text,
         COALESCE(ii.startup_resolution_method, 'canonical_id'),
         COALESCE(ii.startup_resolution_confidence, 1.0),
         jsonb_build_object('company_name', ii.company_name, 'round_type', ii.round_type,
                            'amount', ii.amount, 'scraped_date', ii.scraped_date)
  FROM public.investor_investments ii
  JOIN LATERAL (
    SELECT sim.id
    FROM public.startup_investor_matches sim
    WHERE sim.startup_id = ii.startup_id
      AND sim.investor_id = ii.investor_id
      AND sim.created_at < ii.investment_date::timestamptz
    ORDER BY sim.created_at DESC
    LIMIT 1
  ) m ON true
  WHERE ii.startup_id IS NOT NULL
    AND ii.investment_date IS NOT NULL
    AND nullif(btrim(ii.source_url), '') IS NOT NULL
  ORDER BY ii.investment_date DESC
  LIMIT greatest(p_limit, 0)
  ON CONFLICT (match_id, evidence_type, source_url, event_at) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_canonical_investment_evidence(integer) FROM PUBLIC, anon, authenticated;

-- Resolve legacy portfolio rows conservatively: unique exact website host first,
-- then a unique exact normalized company name. No fuzzy matching is permitted.
CREATE OR REPLACE FUNCTION public.resolve_investment_startup_ids(p_limit integer DEFAULT 10000)
RETURNS TABLE(domain_resolved bigint, name_resolved bigint, queued bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain bigint := 0;
  v_name bigint := 0;
  v_queued bigint := 0;
BEGIN
  DROP TABLE IF EXISTS _resolution_targets;
  CREATE TEMP TABLE _resolution_targets ON COMMIT DROP AS
    SELECT id FROM public.investor_investments
    WHERE startup_id IS NULL ORDER BY id LIMIT greatest(p_limit, 0);

  WITH startup_domains AS (
    SELECT split_part(regexp_replace(regexp_replace(lower(website), '^https?://', ''), '^www\.', ''), '/', 1) AS key,
           (array_agg(id))[1] AS startup_id
    FROM public.startup_uploads WHERE nullif(btrim(website), '') IS NOT NULL
    GROUP BY 1 HAVING count(*) = 1
  ), candidates AS (
    SELECT ii.id, sd.startup_id
    FROM public.investor_investments ii JOIN _resolution_targets t USING (id)
    JOIN startup_domains sd ON sd.key = split_part(regexp_replace(regexp_replace(lower(ii.company_url), '^https?://', ''), '^www\.', ''), '/', 1)
    WHERE nullif(btrim(ii.company_url), '') IS NOT NULL
  )
  UPDATE public.investor_investments ii
  SET startup_id = c.startup_id, startup_resolution_method = 'domain_exact',
      startup_resolution_confidence = 1.0, startup_resolved_at = now(), updated_at = now()
  FROM candidates c WHERE ii.id = c.id AND ii.startup_id IS NULL;
  GET DIAGNOSTICS v_domain = ROW_COUNT;

  WITH startup_names AS (
    SELECT regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') AS key,
           (array_agg(id))[1] AS startup_id
    FROM public.startup_uploads WHERE nullif(btrim(name), '') IS NOT NULL
    GROUP BY 1 HAVING count(*) = 1
  ), candidates AS (
    SELECT ii.id, sn.startup_id
    FROM public.investor_investments ii JOIN _resolution_targets t USING (id)
    JOIN startup_names sn ON sn.key = regexp_replace(lower(ii.company_name), '[^a-z0-9]+', '', 'g')
    WHERE ii.startup_id IS NULL AND nullif(btrim(ii.company_name), '') IS NOT NULL
  )
  UPDATE public.investor_investments ii
  SET startup_id = c.startup_id, startup_resolution_method = 'name_exact_unique',
      startup_resolution_confidence = 0.95, startup_resolved_at = now(), updated_at = now()
  FROM candidates c WHERE ii.id = c.id AND ii.startup_id IS NULL;
  GET DIAGNOSTICS v_name = ROW_COUNT;

  INSERT INTO public.investment_identity_resolution_queue (
    investor_investment_id, investor_id, raw_company_name, raw_company_url
  )
  SELECT ii.id, ii.investor_id, ii.company_name, ii.company_url
  FROM public.investor_investments ii JOIN _resolution_targets t USING (id)
  WHERE ii.startup_id IS NULL
  ON CONFLICT (investor_investment_id) DO NOTHING;
  GET DIAGNOSTICS v_queued = ROW_COUNT;

  RETURN QUERY SELECT v_domain, v_name, v_queued;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_investment_startup_ids(integer) FROM PUBLIC, anon, authenticated;
