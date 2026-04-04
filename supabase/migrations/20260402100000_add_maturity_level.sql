-- Add maturity_level (degree classification) to startup_uploads
-- Possible values: 'freshman' | 'sophomore' | 'junior' | 'senior' | 'graduate' | 'phd'

ALTER TABLE public.startup_uploads
  ADD COLUMN IF NOT EXISTS maturity_level   TEXT,
  ADD COLUMN IF NOT EXISTS maturity_score   INTEGER,
  ADD COLUMN IF NOT EXISTS maturity_gaps    JSONB DEFAULT '[]'::jsonb;

-- Constrain to valid degree values (NULL allowed for unclassified)
ALTER TABLE public.startup_uploads
  DROP CONSTRAINT IF EXISTS startup_uploads_maturity_level_check;

ALTER TABLE public.startup_uploads
  ADD CONSTRAINT startup_uploads_maturity_level_check
  CHECK (maturity_level IN ('freshman','sophomore','junior','senior','graduate','phd') OR maturity_level IS NULL);

-- Index for Goldilocks filter queries (e.g. "give me all Senior startups")
CREATE INDEX IF NOT EXISTS idx_startup_uploads_maturity_level
  ON public.startup_uploads (maturity_level)
  WHERE maturity_level IS NOT NULL;

-- Composite index for the most common matching query pattern:
-- "Seniors with high GOD score looking for Series A"
CREATE INDEX IF NOT EXISTS idx_startup_uploads_maturity_god
  ON public.startup_uploads (maturity_level, total_god_score DESC)
  WHERE maturity_level IS NOT NULL AND total_god_score IS NOT NULL;

NOTIFY pgrst, 'reload schema';
