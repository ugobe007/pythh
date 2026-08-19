-- Preserve distinct investor participation semantics in the evidence ledger.

ALTER TABLE public.funding_evidence_participants
  DROP CONSTRAINT IF EXISTS funding_evidence_participants_participant_role_check;

ALTER TABLE public.funding_evidence_participants
  ADD CONSTRAINT funding_evidence_participants_participant_role_check
  CHECK (participant_role IN (
    'lead', 'co_lead', 'participant', 'syndicate_member',
    'existing_investor', 'unknown'
  ));

COMMENT ON COLUMN public.funding_evidence_participants.participant_role IS
  'Source-grounded role in one canonical financing: lead, co-lead, participant, syndicate member, existing investor, or unknown. CO_INVESTED_WITH is derived only from verified participants sharing that round.';

NOTIFY pgrst, 'reload schema';
