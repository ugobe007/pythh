-- ============================================================================
-- TEMPORARY MATCH SESSIONS
-- ============================================================================
-- Purpose: Store matches for anonymous users so they can recover them
-- when they sign up within 30 days.
--
-- Flow:
-- 1. User enters URL on homepage
-- 2. System generates matches, stores in this table with session_id
-- 3. User can return with same session_id to see their matches
-- 4. If user signs up within 30 days, matches are transferred
--
-- Retention: 30 days (cleaned up by scheduled job)
-- ============================================================================

-- Session matches table
CREATE TABLE IF NOT EXISTS public.temp_match_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session identification (stored in localStorage on frontend)
  session_id text NOT NULL,
  
  -- The startup they queried
  startup_id uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  startup_name text,
  startup_website text,
  
  -- Query context
  input_url text NOT NULL,
  
  -- Match results (stored as JSONB for flexibility)
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_count int NOT NULL DEFAULT 0,
  
  -- Top 5 investors (denormalized for quick access)
  top_5_investor_ids uuid[] DEFAULT '{}',
  top_5_investor_names text[] DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  
  -- If user signs up, link their account
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_temp_sessions_session_id 
  ON public.temp_match_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_startup_id 
  ON public.temp_match_sessions(startup_id);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_expires 
  ON public.temp_match_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_unclaimed 
  ON public.temp_match_sessions(claimed_by_user_id) 
  WHERE claimed_by_user_id IS NULL;

-- RLS: Allow anonymous reads by session_id
ALTER TABLE public.temp_match_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read their session"
  ON public.temp_match_sessions FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert"
  ON public.temp_match_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update"
  ON public.temp_match_sessions FOR UPDATE
  USING (true);

-- Grant access
GRANT SELECT ON public.temp_match_sessions TO anon, authenticated;
GRANT INSERT, UPDATE ON public.temp_match_sessions TO service_role;

-- ============================================================================
-- CLEANUP FUNCTION (run daily via cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_match_sessions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.temp_match_sessions
  WHERE expires_at < now()
    AND claimed_by_user_id IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % expired match sessions', deleted_count;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- CLAIM SESSION FUNCTION (called when user signs up)
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_match_session(
  p_session_id text,
  p_user_id uuid
)
RETURNS TABLE (
  success boolean,
  sessions_claimed int,
  startup_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_startup_ids uuid[];
BEGIN
  -- Update all unclaimed sessions for this session_id
  UPDATE public.temp_match_sessions
  SET 
    claimed_by_user_id = p_user_id,
    claimed_at = now()
  WHERE session_id = p_session_id
    AND claimed_by_user_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Get the startup IDs that were claimed
  SELECT array_agg(DISTINCT startup_id)
  INTO v_startup_ids
  FROM public.temp_match_sessions
  WHERE session_id = p_session_id
    AND claimed_by_user_id = p_user_id;
  
  RETURN QUERY SELECT 
    v_count > 0 AS success,
    v_count AS sessions_claimed,
    COALESCE(v_startup_ids, '{}'::uuid[]) AS startup_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_match_session(text, uuid) TO authenticated;

-- ============================================================================
-- GET SESSION MATCHES (for returning users)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_session_matches(p_session_id text)
RETURNS TABLE (
  session_id text,
  startup_id uuid,
  startup_name text,
  startup_website text,
  input_url text,
  matches jsonb,
  match_count int,
  top_5_investor_ids uuid[],
  top_5_investor_names text[],
  created_at timestamptz,
  expires_at timestamptz,
  is_claimed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    t.session_id,
    t.startup_id,
    t.startup_name,
    t.startup_website,
    t.input_url,
    t.matches,
    t.match_count,
    t.top_5_investor_ids,
    t.top_5_investor_names,
    t.created_at,
    t.expires_at,
    t.claimed_by_user_id IS NOT NULL AS is_claimed
  FROM public.temp_match_sessions t
  WHERE t.session_id = p_session_id
    AND t.expires_at > now()
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_session_matches(text) TO anon, authenticated;

COMMENT ON TABLE public.temp_match_sessions IS 
  'Stores match results for anonymous users. Retained for 30 days. 
   Can be claimed when user signs up to preserve their match history.';
