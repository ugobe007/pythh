-- Portfolio–candidate sector fit + user-scoped deal assumptions (Growthsphere-style).

-- ---------------------------------------------------------------------------
-- User investment assumptions (JSONB; shape documented in docs/ONTOLOGY_REASONING_ROADMAP.md)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_deal_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  investment_assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_deal_preferences IS
  'Per-user thesis / check-size / stage prefs for scoring and copy; app merges with defaults.';

CREATE INDEX IF NOT EXISTS idx_user_deal_preferences_updated
  ON public.user_deal_preferences (updated_at DESC);

ALTER TABLE public.user_deal_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own deal preferences" ON public.user_deal_preferences;
CREATE POLICY "Users manage own deal preferences"
  ON public.user_deal_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_deal_preferences TO authenticated;
GRANT ALL ON public.user_deal_preferences TO service_role;

-- ---------------------------------------------------------------------------
-- Compare a candidate startup to active virtual_portfolio holdings by sector
-- Primary = sectors[1] (matches portfolio_health). Overlap: same_primary > shared (&&) > new.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.candidate_portfolio_sector_overlap(p_candidate_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH cand AS (
    SELECT id, name, sectors
    FROM startup_uploads
    WHERE id = p_candidate_id
  ),
  holds AS (
    SELECT
      vp.id AS vp_id,
      su.id AS startup_id,
      su.name AS startup_name,
      su.sectors
    FROM virtual_portfolio vp
    JOIN startup_uploads su ON su.id = vp.startup_id
    WHERE vp.status = 'active'
  ),
  classified AS (
    SELECT
      h.startup_id,
      h.startup_name,
      CASE
        WHEN c.sectors IS NULL OR array_length(c.sectors, 1) IS NULL THEN 'unknown'
        WHEN h.sectors IS NULL OR array_length(h.sectors, 1) IS NULL THEN 'unknown'
        WHEN lower(trim(c.sectors[1])) = lower(trim(h.sectors[1])) THEN 'same_primary'
        WHEN c.sectors && h.sectors THEN 'shared_sector'
        ELSE 'new_sector'
      END AS overlap_kind
    FROM holds h
    CROSS JOIN cand c
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM cand) THEN
      jsonb_build_object(
        'error', 'candidate_not_found',
        'candidate_id', p_candidate_id::text
      )
    ELSE jsonb_build_object(
      'candidate_id', (SELECT id FROM cand),
      'candidate_name', (SELECT name FROM cand),
      'candidate_primary', (SELECT sectors[1] FROM cand),
      'active_holdings', (SELECT COUNT(*)::integer FROM holds),
      'counts', COALESCE(
        (
          SELECT jsonb_build_object(
            'same_primary', COUNT(*) FILTER (WHERE overlap_kind = 'same_primary'),
            'shared_sector', COUNT(*) FILTER (WHERE overlap_kind = 'shared_sector'),
            'new_sector', COUNT(*) FILTER (WHERE overlap_kind = 'new_sector'),
            'unknown', COUNT(*) FILTER (WHERE overlap_kind = 'unknown')
          )
          FROM classified
        ),
        jsonb_build_object(
          'same_primary', 0,
          'shared_sector', 0,
          'new_sector', 0,
          'unknown', 0
        )
      ),
      'holdings', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'startup_id', startup_id,
              'startup_name', startup_name,
              'overlap', overlap_kind
            )
            ORDER BY startup_name
          )
          FROM classified
        ),
        '[]'::jsonb
      )
    )
  END;
$$;

COMMENT ON FUNCTION public.candidate_portfolio_sector_overlap(uuid) IS
  'Per-holding overlap vs candidate: same_primary (sectors[1]), shared_sector (array &&), new_sector.';

GRANT EXECUTE ON FUNCTION public.candidate_portfolio_sector_overlap(uuid) TO authenticated, service_role;
