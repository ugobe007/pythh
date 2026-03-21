-- =============================================================================
-- DECK UPLOAD: Add deck_url column and Supabase Storage bucket
-- =============================================================================
-- Founders can upload pitch decks to be scored and saved to their startup profile.
-- deck_url stores the Supabase Storage path for the uploaded PDF.

ALTER TABLE startup_uploads
  ADD COLUMN IF NOT EXISTS deck_url TEXT;

COMMENT ON COLUMN startup_uploads.deck_url IS 'Supabase Storage path for uploaded pitch deck PDF';

-- Create decks storage bucket (private; backend uploads via service role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('decks', 'decks', false)
ON CONFLICT (id) DO NOTHING;

-- Backend uploads via service role (bypasses RLS). Bucket is private.
