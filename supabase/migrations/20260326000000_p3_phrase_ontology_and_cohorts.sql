-- ============================================================================
-- P3: Ontological Parsing + Cohort Scraping
-- ============================================================================
-- phrase_ontology: Founder/investor language extraction
-- accelerator_cohorts + cohort_companies: YC batches, Techstars, etc.
-- ============================================================================

-- 1. PHRASE ONTOLOGY — Extract and cluster language founders/investors use
CREATE TABLE IF NOT EXISTS public.phrase_ontology (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase text NOT NULL,
  context text NOT NULL CHECK (context IN ('founder', 'investor', 'shared')),
  entity_type text CHECK (entity_type IN ('startup', 'investor', null)),
  sector text,
  stage text,
  frequency int NOT NULL DEFAULT 1,
  source text DEFAULT 'extraction' CHECK (source IN ('extraction', 'manual', 'import')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_phrase_ontology_phrase_context
  ON public.phrase_ontology(phrase, context);
CREATE INDEX IF NOT EXISTS idx_phrase_ontology_context ON public.phrase_ontology(context);
CREATE INDEX IF NOT EXISTS idx_phrase_ontology_sector ON public.phrase_ontology(sector);
CREATE INDEX IF NOT EXISTS idx_phrase_ontology_frequency ON public.phrase_ontology(frequency DESC);

COMMENT ON TABLE public.phrase_ontology IS 'P3: Extracted phrases from pitch/description/thesis. Used for matching, clustering, trend detection.';

-- 2. ACCELERATOR COHORTS — YC W25, S25, Techstars batches, etc.
CREATE TABLE IF NOT EXISTS public.accelerator_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program text NOT NULL,
  batch text NOT NULL,
  display_name text,
  start_date date,
  end_date date,
  company_count int DEFAULT 0,
  source_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program, batch)
);

CREATE INDEX IF NOT EXISTS idx_accelerator_cohorts_program ON public.accelerator_cohorts(program);
CREATE INDEX IF NOT EXISTS idx_accelerator_cohorts_start ON public.accelerator_cohorts(start_date DESC);

COMMENT ON TABLE public.accelerator_cohorts IS 'P3: YC batches, Techstars, 500 Global, etc.';

-- 3. COHORT COMPANIES — Link startups to accelerator cohorts
CREATE TABLE IF NOT EXISTS public.cohort_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.accelerator_cohorts(id) ON DELETE CASCADE,
  startup_id uuid REFERENCES public.startup_uploads(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  company_url text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, company_name)
);

CREATE INDEX IF NOT EXISTS idx_cohort_companies_cohort ON public.cohort_companies(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_companies_startup ON public.cohort_companies(startup_id) WHERE startup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cohort_companies_name ON public.cohort_companies(LOWER(company_name));

COMMENT ON TABLE public.cohort_companies IS 'P3: Companies in accelerator batches. startup_id linked when matched to startup_uploads.';
