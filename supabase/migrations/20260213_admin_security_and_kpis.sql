-- ===========================================================================
-- ADMIN SECURITY & KPI HARDENING
-- ===========================================================================
-- Feb 2026: Audit logging + centralized RPC layer
-- Fixes: OpenAI key exposure, 11,556-row load, no audit trail

-- 1) Admin audit log table
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result TEXT NOT NULL DEFAULT 'ok',
  error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_log_created_at
  ON public.admin_actions_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_log_action
  ON public.admin_actions_log (action);

COMMENT ON TABLE public.admin_actions_log IS 
'Audit log for all admin mutations (approve, reject, import, force regen)';

-- 2) Dashboard KPIs RPC (single call replaces 4+ queries)
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_kpis()
RETURNS TABLE (
  startups_approved BIGINT,
  startups_pending BIGINT,
  investors_total BIGINT,
  matches_total BIGINT,
  avg_god_score NUMERIC
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.startup_uploads WHERE status = 'approved') AS startups_approved,
    (SELECT COUNT(*) FROM public.startup_uploads WHERE status = 'pending')  AS startups_pending,
    (SELECT COUNT(*) FROM public.investors)                                 AS investors_total,
    (SELECT COUNT(*) FROM public.startup_investor_matches)                  AS matches_total,
    (SELECT COALESCE(AVG(total_god_score), 0) 
     FROM public.startup_uploads 
     WHERE status='approved' AND total_god_score IS NOT NULL) AS avg_god_score;
$$;

COMMENT ON FUNCTION public.admin_get_dashboard_kpis IS 
'Centralized KPI query - replaces 4 separate client queries + client-side avg calculation';

-- 3) Bulk status update with audit
CREATE OR REPLACE FUNCTION public.admin_set_startup_status(
  p_startup_ids UUID[],
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor UUID;
  v_updated INT;
BEGIN
  -- Best-effort actor id from auth (works when called with user token)
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  -- Update status
  UPDATE public.startup_uploads
  SET status = p_status
  WHERE id = ANY(p_startup_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Write audit log
  INSERT INTO public.admin_actions_log(actor_user_id, action, target_type, payload, result)
  VALUES (
    v_actor,
    'set_startup_status',
    'startup',
    jsonb_build_object('startup_ids', p_startup_ids, 'status', p_status, 'updated', v_updated),
    'ok'
  );

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

COMMENT ON FUNCTION public.admin_set_startup_status IS 
'Bulk approve/reject/pending with audit logging - replaces unaudited loops in EditStartups.tsx';

-- Validation
DO $$
BEGIN
  RAISE NOTICE '✅ Admin security migration applied:';
  RAISE NOTICE '   - admin_actions_log table (audit trail)';
  RAISE NOTICE '   - admin_get_dashboard_kpis() RPC (single KPI query)';
  RAISE NOTICE '   - admin_set_startup_status() RPC (audited bulk ops)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Next steps:';
  RAISE NOTICE '   1. Deploy server endpoint: /api/admin/import-discovered';
  RAISE NOTICE '   2. ROTATE OpenAI API key (assume compromised)';
  RAISE NOTICE '   3. Remove VITE_OPENAI_API_KEY from .env';
  RAISE NOTICE '   4. Add process.env.OPENAI_API_KEY to server .env';
END $$;
