-- Enable public read access to startup_investor_matches for high-quality matches
-- This allows the LiveMatchingStrip component to fetch matches client-side

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public read access to matches" ON startup_investor_matches;

-- Create policy: Allow anyone to read matches (no auth required)
CREATE POLICY "Allow public read access to matches"
ON startup_investor_matches
FOR SELECT
TO anon, authenticated
USING (true);

-- Verify RLS is enabled
ALTER TABLE startup_investor_matches ENABLE ROW LEVEL SECURITY;
