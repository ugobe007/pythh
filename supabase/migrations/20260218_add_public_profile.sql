-- Add public_profile column for Hot Matches anonymization control
-- Allows startups/investors to opt into showing real names in public feeds

-- Add to startup_uploads
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS public_profile BOOLEAN DEFAULT false;

COMMENT ON COLUMN startup_uploads.public_profile IS 
'If true, startup name appears in Hot Matches feed. If false (default), shows anonymized name like "Seed AI Startup"';

-- Add to investors
ALTER TABLE investors 
ADD COLUMN IF NOT EXISTS public_profile BOOLEAN DEFAULT false;

COMMENT ON COLUMN investors.public_profile IS 
'If true, investor/firm name appears in Hot Matches feed. If false (default), Tier 1/2 show as "Tier 1 VC"';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_startup_uploads_public_profile ON startup_uploads(public_profile);
CREATE INDEX IF NOT EXISTS idx_investors_public_profile ON investors(public_profile);
