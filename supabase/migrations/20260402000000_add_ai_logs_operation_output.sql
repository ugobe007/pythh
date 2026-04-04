-- Add missing columns to ai_logs required by the analytics flush endpoint.
-- The table was created with (log_type, action_type, input_data, output_data, status).
-- The /api/analytics/flush route inserts (operation, status, output, created_at).
-- Adding the two missing columns so both paths work without touching existing data.

ALTER TABLE ai_logs
  ADD COLUMN IF NOT EXISTS operation TEXT,
  ADD COLUMN IF NOT EXISTS output    JSONB DEFAULT '{}'::jsonb;

-- Index for querying by operation (useful for analytics dashboards)
CREATE INDEX IF NOT EXISTS idx_ai_logs_operation ON ai_logs (operation);

-- Reload the schema cache so PostgREST picks up the new columns immediately
NOTIFY pgrst, 'reload schema';
