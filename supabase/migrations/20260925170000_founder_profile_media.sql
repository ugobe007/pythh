-- Private pitch decks and videos uploaded from the founder account profile.
-- Bytes live in the founder-media bucket. This table stores ownership only.

CREATE TABLE IF NOT EXISTS public.pythh_founder_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES public.pythh_users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('deck', 'video')),
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_pythh_founder_media_user_kind
  ON public.pythh_founder_media (user_id, kind, created_at DESC);

ALTER TABLE public.pythh_founder_media ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.pythh_founder_media IS
  'Founder-owned pitch decks and videos on the account profile. Service role writes; signed URLs are issued by the API.';

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('founder-media', 'founder-media', false, 104857600)
ON CONFLICT (id) DO NOTHING;
