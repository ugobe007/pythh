-- Ensure PostgREST can expose the private ledger to service-role requests.
-- Does not grant browser access or change data.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.funding_evidence_events,
  public.funding_evidence_participants,
  public.funding_prediction_evaluations,
  public.funding_prediction_misses
TO service_role;

GRANT SELECT ON TABLE public.funding_prediction_metrics TO service_role;

REVOKE ALL ON TABLE
  public.funding_evidence_events,
  public.funding_evidence_participants,
  public.funding_prediction_evaluations,
  public.funding_prediction_misses,
  public.funding_prediction_metrics
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

SELECT
  has_schema_privilege('service_role', 'public', 'USAGE') AS service_role_schema_usage,
  has_table_privilege('service_role', 'public.funding_evidence_events', 'SELECT') AS service_role_can_select,
  has_table_privilege('service_role', 'public.funding_evidence_events', 'INSERT') AS service_role_can_insert,
  has_table_privilege('anon', 'public.funding_evidence_events', 'SELECT') AS anon_can_select,
  has_table_privilege('authenticated', 'public.funding_evidence_events', 'SELECT') AS authenticated_can_select;
