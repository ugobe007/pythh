-- Check ai_logs table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_logs' 
ORDER BY ordinal_position;

-- Get recent logs (using correct columns)
SELECT id, action, status, output, created_at
FROM ai_logs
WHERE created_at > NOW() - INTERVAL '3 hours'
ORDER BY created_at DESC
LIMIT 20;
