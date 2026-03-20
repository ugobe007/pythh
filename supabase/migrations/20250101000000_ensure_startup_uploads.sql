-- Ensure startup_uploads exists before any migration references it.
-- Supabase skips step2_create_uploads.sql (wrong naming), so this runs early.
CREATE TABLE IF NOT EXISTS startup_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pitch TEXT,
  description TEXT,
  tagline TEXT,
  website TEXT,
  linkedin TEXT,
  raise_amount TEXT,
  raise_type TEXT,
  stage INTEGER,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('url', 'deck', 'manual')),
  source_url TEXT,
  deck_filename TEXT,
  extracted_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'published')),
  admin_notes TEXT,
  submitted_by UUID,
  submitted_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);
