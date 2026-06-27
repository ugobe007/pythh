-- Daily Pythh Signal Art editions (generative SVG + PYTHIA copy)

CREATE TABLE IF NOT EXISTS public.pythh_art_editions (
  edition_date date PRIMARY KEY,
  seed bigint NOT NULL,
  svg text NOT NULL,
  signal_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pythh_art_editions_generated
  ON public.pythh_art_editions (generated_at DESC);

ALTER TABLE public.pythh_art_editions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pythh_art_editions_public_read ON public.pythh_art_editions;
CREATE POLICY pythh_art_editions_public_read ON public.pythh_art_editions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS pythh_art_editions_service ON public.pythh_art_editions;
CREATE POLICY pythh_art_editions_service ON public.pythh_art_editions
  FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT ON public.pythh_art_editions TO anon, authenticated;
GRANT ALL ON public.pythh_art_editions TO service_role;
