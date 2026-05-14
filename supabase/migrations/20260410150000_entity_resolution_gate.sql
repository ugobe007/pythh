-- Entity resolution gate — classify startups/investors before heavy RSS & enrichment.
-- Values (application-enforced): junk | needs_url | qualified

ALTER TABLE public.startup_uploads
  ADD COLUMN IF NOT EXISTS entity_gate text,
  ADD COLUMN IF NOT EXISTS entity_gate_reason text,
  ADD COLUMN IF NOT EXISTS entity_gate_at timestamptz;

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS entity_gate text,
  ADD COLUMN IF NOT EXISTS entity_gate_reason text,
  ADD COLUMN IF NOT EXISTS entity_gate_at timestamptz;

COMMENT ON COLUMN public.startup_uploads.entity_gate IS 'junk | needs_url | qualified — scripts/entity-resolution-gate.js';
COMMENT ON COLUMN public.investors.entity_gate IS 'junk | needs_url | qualified — scripts/entity-resolution-gate.js';

CREATE INDEX IF NOT EXISTS idx_startup_uploads_approved_entity_gate
  ON public.startup_uploads (status, entity_gate)
  WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_investors_entity_gate
  ON public.investors (entity_gate);
