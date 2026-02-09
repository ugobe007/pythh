-- Migration: Add founder_dashboard and investor_pipeline share types
-- For shareable profile dashboard links

-- Drop and re-add CHECK constraint to include new share types
DO $$
BEGIN
  -- Drop existing constraint (name may vary)
  ALTER TABLE public.share_links DROP CONSTRAINT IF EXISTS share_links_share_type_check;
  
  -- Add updated constraint with new types
  ALTER TABLE public.share_links 
    ADD CONSTRAINT share_links_share_type_check 
    CHECK (share_type IN (
      'score_snapshot', 
      'investor_brief', 
      'market_slice',
      'founder_dashboard',
      'investor_pipeline'
    ));
END $$;

COMMENT ON CONSTRAINT share_links_share_type_check ON public.share_links 
  IS 'Valid share types: score_snapshot, investor_brief, market_slice, founder_dashboard, investor_pipeline';
