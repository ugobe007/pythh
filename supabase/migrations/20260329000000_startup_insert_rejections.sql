-- Rejection monitoring for startup insert gate
-- Logs names rejected by validation for tuning and analysis

CREATE TABLE IF NOT EXISTS public.startup_insert_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL CHECK (source IN ('discovered', 'startup_uploads')),
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_insert_rejections_created_at
  ON public.startup_insert_rejections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_startup_insert_rejections_reason
  ON public.startup_insert_rejections(reason);

COMMENT ON TABLE public.startup_insert_rejections IS 'Logs startup names rejected by insert gate validation for monitoring and tuning';
