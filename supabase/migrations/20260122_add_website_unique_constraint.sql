-- Migration: Add unique constraint on startup_uploads.website
-- Description: Makes website the primary identity key (prevents duplicate startups for same domain)
-- Created: 2026-01-22
-- Run in: Supabase SQL Editor

-- Add unique constraint on website column
-- This allows upsert with onConflict: "website" to work correctly

-- Step 1: Remove duplicate websites (keep the oldest one)
DELETE FROM startup_uploads a
USING startup_uploads b
WHERE a.id > b.id 
  AND a.website = b.website
  AND a.website IS NOT NULL;

-- Step 2: Add unique constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'startup_uploads_website_unique'
  ) THEN
    ALTER TABLE startup_uploads
    ADD CONSTRAINT startup_uploads_website_unique UNIQUE (website);
  END IF;
END $$;

-- Success
SELECT 'startup_uploads.website unique constraint added successfully!' as status;

-- Note: If this fails because duplicate websites already exist, run this first:
-- DELETE FROM startup_uploads a USING startup_uploads b
-- WHERE a.id < b.id AND a.website = b.website;
