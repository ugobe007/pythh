-- Add missing metadata column for rescue agent
ALTER TABLE discovered_startups 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for JSONB querying
CREATE INDEX IF NOT EXISTS idx_discovered_startups_metadata 
ON discovered_startups USING GIN (metadata);

-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'discovered_startups' 
AND column_name = 'metadata';
