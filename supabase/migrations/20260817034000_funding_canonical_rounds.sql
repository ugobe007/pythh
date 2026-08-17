-- Canonical round identity and source-grounded participation semantics.
-- Additive and shadow-only; no live matching or ranking reads these columns.

ALTER TABLE public.funding_evidence_events
  ADD COLUMN IF NOT EXISTS canonical_round_key TEXT;

ALTER TABLE public.funding_evidence_participants
  ADD COLUMN IF NOT EXISTS participation_relation TEXT,
  ADD COLUMN IF NOT EXISTS evidence_phrase TEXT;

ALTER TABLE public.funding_evidence_participants
  DROP CONSTRAINT IF EXISTS funding_evidence_participants_relation_check;

ALTER TABLE public.funding_evidence_participants
  ADD CONSTRAINT funding_evidence_participants_relation_check CHECK (
    participation_relation IS NULL OR participation_relation IN (
      'INVESTED_IN',
      'LED_ROUND',
      'CO_LED_ROUND',
      'PARTICIPATED_IN_ROUND',
      'PARTICIPATED_IN_SYNDICATE'
    )
  );

CREATE INDEX IF NOT EXISTS idx_funding_evidence_canonical_round
  ON public.funding_evidence_events(canonical_round_key)
  WHERE canonical_round_key IS NOT NULL;

COMMENT ON COLUMN public.funding_evidence_events.canonical_round_key IS
  'Deterministic candidate-round cluster key. Multiple source articles may share this key; each source remains a separate evidence row.';
COMMENT ON COLUMN public.funding_evidence_participants.evidence_phrase IS
  'Exact source text supporting this participant and role; never inferred from another investor in the round.';

NOTIFY pgrst, 'reload schema';
