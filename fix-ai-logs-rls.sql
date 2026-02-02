-- Fix RLS policy for ai_logs table to allow frontend reads
-- This fixes the 400 error on discovery page

-- Enable RLS if not already enabled
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to ai_logs" ON ai_logs;
DROP POLICY IF EXISTS "Allow anon read access to ai_logs" ON ai_logs;

-- Create policy to allow anonymous reads (for monitoring dashboards)
CREATE POLICY "Allow anon read access to ai_logs"
ON ai_logs
FOR SELECT
TO anon
USING (true);

-- Create policy to allow authenticated reads
CREATE POLICY "Allow authenticated read access to ai_logs"
ON ai_logs
FOR SELECT
TO authenticated
USING (true);

-- Create policy to allow service role full access
CREATE POLICY "Allow service role full access to ai_logs"
ON ai_logs
FOR ALL
TO service_role
USING (true);

-- Verify
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'ai_logs';
