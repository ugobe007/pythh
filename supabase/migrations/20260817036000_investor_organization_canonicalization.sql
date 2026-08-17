-- Organization-level investor identity for funding-outcome measurement.
-- Investor/person rows remain untouched so historical matches keep their original IDs.

CREATE TABLE IF NOT EXISTS public.investor_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  website_domain TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'acquired', 'unknown')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investor_organization_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.investor_organizations(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual_evidence',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.investor_organization_memberships (
  investor_id UUID PRIMARY KEY REFERENCES public.investors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.investor_organizations(id) ON DELETE CASCADE,
  resolution_method TEXT NOT NULL,
  resolution_confidence NUMERIC(5,4) NOT NULL CHECK (resolution_confidence BETWEEN 0 AND 1),
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.funding_evidence_participants
  ADD COLUMN IF NOT EXISTS investor_organization_id UUID
  REFERENCES public.investor_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_investor_org_memberships_org
  ON public.investor_organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_funding_participants_org
  ON public.funding_evidence_participants(investor_organization_id, funding_event_id);

CREATE OR REPLACE VIEW public.funding_evidence_organization_participants AS
SELECT
  p.id AS participant_id,
  p.funding_event_id,
  p.investor_name_raw,
  p.participant_role,
  p.resolution_status,
  p.resolution_confidence,
  p.investor_id,
  p.investor_organization_id,
  o.canonical_name AS investor_organization_name,
  o.normalized_name AS investor_organization_normalized_name
FROM public.funding_evidence_participants p
LEFT JOIN public.investor_organizations o ON o.id = p.investor_organization_id;

ALTER TABLE public.investor_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_organization_memberships ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.investor_organizations,
  public.investor_organization_aliases,
  public.investor_organization_memberships
TO service_role;
GRANT SELECT ON public.funding_evidence_organization_participants TO service_role;

REVOKE ALL ON public.investor_organizations FROM anon, authenticated;
REVOKE ALL ON public.investor_organization_aliases FROM anon, authenticated;
REVOKE ALL ON public.investor_organization_memberships FROM anon, authenticated;
REVOKE ALL ON public.funding_evidence_organization_participants FROM anon, authenticated;

COMMENT ON TABLE public.investor_organizations IS
  'Canonical investment firms used for organization-level outcome evaluation; separate from partner/person investor rows.';
COMMENT ON TABLE public.investor_organization_memberships IS
  'Non-destructive mapping from historical investor/person rows to their canonical investment organization.';
COMMENT ON COLUMN public.funding_evidence_participants.investor_organization_id IS
  'Canonical firm that participated in the funding event, independent of any partner/person match row.';

NOTIFY pgrst, 'reload schema';
