-- Ensure foreign keys exist for startup_investor_matches
-- This enables PostgREST relationship embedding and prevents orphaned records

-- Add FK from matches to startup_uploads (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'startup_investor_matches_startup_id_fkey'
  ) THEN
    ALTER TABLE public.startup_investor_matches
      ADD CONSTRAINT startup_investor_matches_startup_id_fkey
      FOREIGN KEY (startup_id) 
      REFERENCES public.startup_uploads(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added FK: startup_investor_matches.startup_id -> startup_uploads.id';
  ELSE
    RAISE NOTICE 'FK startup_investor_matches_startup_id_fkey already exists';
  END IF;
END $$;

-- Add FK from matches to investors (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'startup_investor_matches_investor_id_fkey'
  ) THEN
    ALTER TABLE public.startup_investor_matches
      ADD CONSTRAINT startup_investor_matches_investor_id_fkey
      FOREIGN KEY (investor_id) 
      REFERENCES public.investors(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added FK: startup_investor_matches.investor_id -> investors.id';
  ELSE
    RAISE NOTICE 'FK startup_investor_matches_investor_id_fkey already exists';
  END IF;
END $$;

-- Force PostgREST to reload schema cache
-- This makes embedded relationships (.select('*, investors(*)')) work
NOTIFY pgrst, 'reload schema';

SELECT 'Foreign keys verified and PostgREST schema reloaded successfully!' AS status;
