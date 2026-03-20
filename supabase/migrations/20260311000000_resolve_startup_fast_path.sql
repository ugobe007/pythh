-- ============================================================================
-- OPTIMIZE resolve_startup_by_url — Fast indexed lookup
-- ============================================================================
-- The original used regex on columns (full table scan). This version tries
-- exact website match first (uses unique index), then falls back to the
-- slower host extraction only when needed.
-- ============================================================================

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

  -- Normalize input to host (strip protocol, www, path)
  v_norm := lower(trim(p_url));
  v_norm := regexp_replace(v_norm, '^https?://', '');
  v_norm := regexp_replace(v_norm, '^www\.', '');
  v_norm := split_part(v_norm, '/', 1);
  v_norm := regexp_replace(v_norm, '/+$', '');

  -- FAST PATH: exact website match (uses startup_uploads_website_unique index)
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

  -- FALLBACK: company_domain if populated (uses idx_startup_uploads_company_domain)
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

  -- SLOW PATH: host extraction (full scan, only when fast paths miss)
  RETURN QUERY
  SELECT
    su.id AS startup_id,
    su.website AS canonical_url,
    su.name AS startup_name,
    true AS resolved,
    null::text AS reason
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

COMMENT ON FUNCTION public.resolve_startup_by_url(text) IS 'Resolve URL to startup_id. Fast path: exact website match. Fallback: company_domain, then host extraction.';
