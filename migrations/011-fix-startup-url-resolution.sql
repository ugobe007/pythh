-- FIX: Proper startup resolution by URL
-- The previous "fast" function just grabbed any startup - this properly matches by URL

CREATE OR REPLACE FUNCTION start_match_run_fast(input_url text)
RETURNS TABLE(
  run_id uuid,
  startup_id uuid,
  startup_name text,
  canonical_url text,
  status match_run_status,
  step match_run_step,
  match_count int,
  error_code text,
  error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_canonical_url text;
  v_existing_run record;
  v_new_run_id uuid;
  v_resolved_startup_id uuid;
  v_resolved_startup_name text;
BEGIN
  -- Canonicalize URL
  v_canonical_url := canonicalize_url(input_url);
  
  IF v_canonical_url IS NULL OR v_canonical_url = '' THEN
    RETURN QUERY SELECT
      gen_random_uuid(),
      NULL::uuid,
      NULL::text,
      NULL::text,
      'error'::match_run_status,
      'resolve'::match_run_step,
      0,
      'INVALID_URL'::text,
      'URL cannot be empty'::text;
    RETURN;
  END IF;
  
  -- Check for existing ACTIVE run with same canonical URL
  SELECT * INTO v_existing_run
  FROM match_runs mr
  WHERE mr.canonical_url = v_canonical_url
    AND mr.status IN ('created', 'queued', 'processing')
  ORDER BY mr.created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT
      v_existing_run.run_id,
      v_existing_run.startup_id,
      su.name AS startup_name,
      v_existing_run.canonical_url,
      v_existing_run.status::match_run_status,
      v_existing_run.step::match_run_step,
      v_existing_run.match_count,
      v_existing_run.error_code,
      v_existing_run.error_message
    FROM startup_uploads su
    WHERE su.id = v_existing_run.startup_id;
    RETURN;
  END IF;
  
  -- ============================================================
  -- PROPER STARTUP RESOLUTION BY URL
  -- Priority order:
  -- 1. Exact website match (after canonicalization)
  -- 2. Domain match (e.g., "karumi.ai" matches "https://www.karumi.ai")
  -- 3. Fallback to first approved startup if no match
  -- ============================================================
  
  -- Try exact match on website field (canonicalized)
  SELECT id, name INTO v_resolved_startup_id, v_resolved_startup_name
  FROM startup_uploads
  WHERE status = 'approved'
    AND (
      -- Exact URL match
      canonicalize_url(website) = v_canonical_url
      -- Or domain matches (strip www. for comparison)
      OR REPLACE(LOWER(v_canonical_url), 'www.', '') = REPLACE(LOWER(canonicalize_url(website)), 'www.', '')
      -- Or domain contained in canonical URL
      OR v_canonical_url ILIKE '%' || REPLACE(LOWER(canonicalize_url(website)), 'www.', '') || '%'
      -- Or canonical URL contained in website
      OR REPLACE(LOWER(canonicalize_url(website)), 'www.', '') ILIKE '%' || v_canonical_url || '%'
    )
  ORDER BY 
    -- Prefer exact matches
    CASE WHEN canonicalize_url(website) = v_canonical_url THEN 0 ELSE 1 END,
    -- Then by GOD score
    total_god_score DESC NULLS LAST
  LIMIT 1;
  
  -- If no match found, try broader domain match
  IF v_resolved_startup_id IS NULL THEN
    SELECT id, name INTO v_resolved_startup_id, v_resolved_startup_name
    FROM startup_uploads
    WHERE status = 'approved'
      AND website IS NOT NULL
      AND (
        -- Extract domain and compare
        v_canonical_url ILIKE '%' || REGEXP_REPLACE(website, '^https?://(www\.)?|/$', '', 'gi') || '%'
        OR REGEXP_REPLACE(website, '^https?://(www\.)?|/$', '', 'gi') ILIKE '%' || v_canonical_url || '%'
      )
    ORDER BY total_god_score DESC NULLS LAST
    LIMIT 1;
  END IF;
  
  -- If still no match, fall back to any approved startup
  IF v_resolved_startup_id IS NULL THEN
    SELECT id, name INTO v_resolved_startup_id, v_resolved_startup_name
    FROM startup_uploads
    WHERE status = 'approved'
    ORDER BY total_god_score DESC NULLS LAST
    LIMIT 1;
  END IF;
  
  -- Handle case where no startups exist at all
  IF v_resolved_startup_id IS NULL THEN
    INSERT INTO match_runs (
      input_url, canonical_url, startup_id, status, step,
      error_code, error_message
    ) VALUES (
      input_url, v_canonical_url, gen_random_uuid(), 'error', 'resolve',
      'NO_STARTUPS', 'No approved startups found'
    )
    RETURNING match_runs.run_id INTO v_new_run_id;
    
    RETURN QUERY SELECT
      v_new_run_id, NULL::uuid, NULL::text, v_canonical_url,
      'error'::match_run_status, 'resolve'::match_run_step,
      0, 'NO_STARTUPS'::text, 'No approved startups found'::text;
    RETURN;
  END IF;
  
  -- Create new run with resolved startup
  INSERT INTO match_runs (
    input_url, canonical_url, startup_id, status, step
  ) VALUES (
    input_url, v_canonical_url, v_resolved_startup_id, 'queued', 'match'
  )
  RETURNING match_runs.run_id INTO v_new_run_id;
  
  RETURN QUERY SELECT
    v_new_run_id,
    v_resolved_startup_id,
    v_resolved_startup_name,
    v_canonical_url,
    'queued'::match_run_status,
    'match'::match_run_step,
    0,
    NULL::text,
    NULL::text;
END;
$$;

-- Add index for faster URL lookups
CREATE INDEX IF NOT EXISTS idx_startup_uploads_website_lower 
ON startup_uploads (LOWER(website)) 
WHERE status = 'approved';
