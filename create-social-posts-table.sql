-- Social Posts table — tracks all automated social media posts
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform      TEXT NOT NULL CHECK (platform IN ('twitter', 'linkedin', 'instagram', 'threads')),
  post_type     TEXT NOT NULL CHECK (post_type IN ('hot_match', 'startup_spotlight', 'weekly_stats', 'sector_insight', 'vc_signal')),
  content       TEXT NOT NULL,           -- the actual post text
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'skipped')),
  post_id       TEXT,                    -- platform-returned post/tweet ID
  error         TEXT,                    -- error message if status=failed
  metadata      JSONB DEFAULT '{}',      -- extra data (startup_id, match_id, etc.)
  scheduled_for TIMESTAMPTZ,            -- when it was scheduled to post
  posted_at     TIMESTAMPTZ             -- when it actually posted
);

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS social_posts_created_at_idx ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_platform_idx ON social_posts(platform);
CREATE INDEX IF NOT EXISTS social_posts_status_idx ON social_posts(status);

-- Enable RLS (admin only — no public access needed)
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON social_posts USING (true) WITH CHECK (true);
