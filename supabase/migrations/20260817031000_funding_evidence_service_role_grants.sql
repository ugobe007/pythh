-- Expose the private funding-evidence ledger to backend service-role clients.
-- Browser roles remain revoked and RLS remains enabled.

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
