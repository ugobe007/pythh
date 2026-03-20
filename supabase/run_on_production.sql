-- =============================================================================
-- RUN IN SUPABASE DASHBOARD → SQL EDITOR (Production)
-- =============================================================================
-- Apply these changes manually when db push fails due to migration history mismatch.
-- 1) resolve_startup_by_url optimization (faster URL lookup)
-- 2) stage_estimate column (if missing)
-- =============================================================================

-- 1. FAST URL LOOKUP - Optimized resolve_startup_by_url
DROP FUNCTION IF EXISTS public.resolve_startup_by_url(text);

CREATE OR REPLACE FUNCTION public.resolve_startup_by_url(p_url text)
RETURNS TABLE (
  startup_id uuid,
  canonical_url text,
  startup_name text,
  resolved boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_norm text;
  v_row record;
BEGIN
  IF p_url IS NULL OR length(trim(p_url)) = 0 THEN
    RETURN QUERY SELECT null::uuid, null::text, null::text, false, 'empty_url';
    RETURN;
  END IF;

  v_norm := lower(trim(p_url));
  v_norm := regexp_replace(v_norm, '^https?://', '');
  v_norm := regexp_replace(v_norm, '^www\.', '');
  v_norm := split_part(v_norm, '/', 1);
  v_norm := regexp_replace(v_norm, '/+$', '');

  SELECT su.id, su.website, su.name INTO v_row
  FROM public.startup_uploads su
  WHERE su.status = 'approved'
    AND (
      su.website = 'https://' || v_norm
      OR su.website = 'https://' || v_norm || '/'
      OR su.website = 'https://www.' || v_norm
      OR su.website = 'https://www.' || v_norm || '/'
    )
  ORDER BY (su.reviewed_at IS NOT NULL) DESC, su.reviewed_at DESC NULLS LAST, su.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_row.id, v_row.website, v_row.name, true, null::text;
    RETURN;
  END IF;

  SELECT su.id, su.website, su.name INTO v_row
  FROM public.startup_uploads su
  WHERE su.status = 'approved'
    AND su.company_domain IS NOT NULL
    AND lower(trim(su.company_domain)) = v_norm
  ORDER BY (su.reviewed_at IS NOT NULL) DESC, su.reviewed_at DESC NULLS LAST, su.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_row.id, v_row.website, v_row.name, true, null::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT su.id, su.website, su.name, true, null::text
  FROM public.startup_uploads su
  WHERE su.status = 'approved'
    AND (
      split_part(lower(regexp_replace(regexp_replace(coalesce(su.website,''), '^https?://', ''), '^www\.', '')), '/', 1) = v_norm
      OR split_part(lower(regexp_replace(regexp_replace(coalesce(su.source_url,''), '^https?://', ''), '^www\.', '')), '/', 1) = v_norm
    )
  ORDER BY (su.reviewed_at IS NOT NULL) DESC, su.reviewed_at DESC NULLS LAST, su.created_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT null::uuid, v_norm::text, null::text, false, 'not_found';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.resolve_startup_by_url(text) IS 'Resolve URL to startup_id. Fast path: exact website match.';

-- 2. STAGE ESTIMATE COLUMN
ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS stage_estimate TEXT;
CREATE INDEX IF NOT EXISTS idx_startup_uploads_stage_estimate ON startup_uploads(stage_estimate) WHERE stage_estimate IS NOT NULL;
