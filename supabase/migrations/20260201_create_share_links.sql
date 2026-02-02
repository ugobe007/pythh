-- ═══════════════════════════════════════════════════════════════════════════
-- SHARE LINKS TABLE — PYTHH canonical share system (v1)
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- A share link is a snapshot surface, not "access."
-- It renders: score_snapshot, investor_brief, or market_slice
-- 
-- Defaults:
-- - expires_at = NULL (never expires)
-- - visibility = 'public' (only option for v1)
-- - Every link is revocable via revoked_at
-- 
-- Security: No public RLS access. Public route uses server API with service role.
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns to existing share_links table (if they don't exist)
DO $$ 
BEGIN
  -- Add share_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'share_links' AND column_name = 'share_type') THEN
    ALTER TABLE public.share_links 
      ADD COLUMN share_type text NOT NULL DEFAULT 'score_snapshot' 
      CHECK (share_type IN ('score_snapshot', 'investor_brief', 'market_slice'));
  END IF;
  
  -- Add visibility column (only 'public' for v1)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'share_links' AND column_name = 'visibility') THEN
    ALTER TABLE public.share_links 
      ADD COLUMN visibility text NOT NULL DEFAULT 'public' 
      CHECK (visibility IN ('public'));
  END IF;
  
  -- Add revoked_at column (for revocation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'share_links' AND column_name = 'revoked_at') THEN
    ALTER TABLE public.share_links 
      ADD COLUMN revoked_at timestamptz NULL;
  END IF;
  
  -- Add view_count column (optional but useful)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'share_links' AND column_name = 'view_count') THEN
    ALTER TABLE public.share_links 
      ADD COLUMN view_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_share_links_share_type ON public.share_links (share_type);
CREATE INDEX IF NOT EXISTS idx_share_links_revoked_at ON public.share_links (revoked_at) WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON public.share_links (expires_at) WHERE expires_at IS NOT NULL;

-- Index for user lookup (created_by or user_id depending on schema version)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'share_links' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_share_links_user_created ON public.share_links (user_id, created_at DESC);
  END IF;
END $$;

-- Update RLS policy for updates (revoke)
DO $$
BEGIN
  -- Drop old policy if exists
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own share links' AND tablename = 'share_links') THEN
    DROP POLICY "Users can update own share links" ON public.share_links;
  END IF;
END $$;

-- Create policy that works with either user_id or created_by
CREATE POLICY "Users can update own share links" ON public.share_links
  FOR UPDATE 
  TO authenticated
  USING (
    auth.uid() = COALESCE(
      (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'share_links' AND column_name = 'user_id') THEN user_id END),
      NULL::uuid
    )
  );

-- Comment for documentation
COMMENT ON TABLE public.share_links IS 'Public share links for score snapshots, investor briefs, and market slices. Defaults: expires_at=NULL (never), visibility=public. Revocable via revoked_at. Server resolves via service role.';
