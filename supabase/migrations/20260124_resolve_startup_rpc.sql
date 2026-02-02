-- ============================================================================
-- RESOLVE STARTUP BY URL (Bulletproof Resolution)
-- ============================================================================
-- Resolves URLs to startup_id from the canonical startup_uploads table.
-- Matches on website host OR source_url host (for article submissions).
-- Returns startup_id (or id if startup_id is null) for existing startups.
--
-- Usage:
--   SELECT * FROM resolve_startup_by_url('nucleoresearch.com');
--   SELECT * FROM resolve_startup_by_url('https://www.example.com/blog');
--
-- Returns:
--   - startup_id: UUID of startup (or NULL if not found)
--   - canonical_url: The website field from startup_uploads
--   - startup_name: Name of the startup
--   - resolved: true if found, false if not_found
--   - reason: null on success, 'not_found' or 'empty_url' on failure
-- ============================================================================

drop function if exists public.resolve_startup_by_url(text);

create function public.resolve_startup_by_url(p_url text)
returns table (
  startup_id uuid,
  canonical_url text,
  startup_name text,
  resolved boolean,
  reason text
)
language plpgsql
stable
as $$
declare
  v_norm text;
begin
  if p_url is null or length(trim(p_url)) = 0 then
    return query
    select null::uuid, null::text, null::text, false, 'empty_url';
    return;
  end if;

  -- Normalize input to host (strip protocol, www, path)
  v_norm := lower(trim(p_url));
  v_norm := regexp_replace(v_norm, '^https?://', '');
  v_norm := regexp_replace(v_norm, '^www\.', '');
  v_norm := split_part(v_norm, '/', 1);
  v_norm := regexp_replace(v_norm, '/+$', '');

  return query
  select
    su.id as startup_id,
    su.website as canonical_url,
    su.name as startup_name,
    true as resolved,
    null::text as reason
  from public.startup_uploads su
  where
    -- match on website host
    split_part(lower(regexp_replace(regexp_replace(coalesce(su.website,''), '^https?://', ''), '^www\.', '')), '/', 1) = v_norm
    or
    -- match on source_url host (if someone submits an article link)
    split_part(lower(regexp_replace(regexp_replace(coalesce(su.source_url,''), '^https?://', ''), '^www\.', '')), '/', 1) = v_norm
  order by
    -- prefer reviewed/approved rows if present, then newest
    (su.reviewed_at is not null) desc,
    su.reviewed_at desc nulls last,
    su.created_at desc nulls last
  limit 1;

  if not found then
    return query
    select null::uuid, v_norm::text, null::text, false, 'not_found';
  end if;
end;
$$;

grant execute on function public.resolve_startup_by_url(text) to anon, authenticated;

-- ============================================================================
-- COUNT MATCHES (Fast Threshold Check)
-- ============================================================================
-- Returns match counts without fetching full data.
-- Used for "ready vs matching" UI decisions.
--
-- Usage:
--   SELECT * FROM count_matches('a77fa91a-8b14-4fa6-9c3c-b2d7589a8bc4');
-- ============================================================================

-- Drop existing function if signature changed
DROP FUNCTION IF EXISTS count_matches(uuid);

CREATE OR REPLACE FUNCTION count_matches(p_startup_id uuid)
RETURNS TABLE(
  startup_id uuid,
  total bigint,
  active bigint,
  is_ready boolean,
  last_match_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_total bigint;
  v_active bigint;
  v_last_match_at timestamptz;
BEGIN
  -- Get total matches
  SELECT 
    COUNT(*),
    MAX(created_at)
  INTO 
    v_total,
    v_last_match_at
  FROM public.startup_investor_matches
  WHERE startup_investor_matches.startup_id = p_startup_id;
  
  -- Get active investor matches
  SELECT COUNT(*)
  INTO v_active
  FROM public.startup_investor_matches m
  JOIN public.investors i ON i.id = m.investor_id
  WHERE m.startup_id = p_startup_id
    AND i.status = 'active';
  
  -- Return results
  RETURN QUERY SELECT
    p_startup_id,
    COALESCE(v_total, 0),
    COALESCE(v_active, 0),
    COALESCE(v_total, 0) >= 1000,
    v_last_match_at;
END;
$$;

-- Grant execute to anon/authenticated
GRANT EXECUTE ON FUNCTION count_matches(uuid) TO anon, authenticated;

COMMENT ON FUNCTION count_matches IS 'Fast match count check for ready vs matching decision';
