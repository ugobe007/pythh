-- ============================================================================
-- MATCH GENERATION QUEUE SYSTEM
-- ============================================================================
-- This creates an automatic trigger that queues new startups for matching
-- when they are approved. The match-regenerator.js script will process the queue.
-- ============================================================================

-- Create queue table
CREATE TABLE IF NOT EXISTS match_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INT DEFAULT 100, -- Higher = process first (manual submissions get 200)
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(startup_id, status) -- Prevent duplicate pending entries
);

-- Index for fast queue processing
CREATE INDEX IF NOT EXISTS idx_match_queue_status_priority ON match_generation_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_match_queue_startup ON match_generation_queue(startup_id);

-- Function to queue startup for matching
CREATE OR REPLACE FUNCTION queue_startup_for_matching()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if status is 'approved' and not already queued
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Insert into queue with low priority (100) for automatic discoveries
    INSERT INTO match_generation_queue (startup_id, priority, status)
    VALUES (NEW.id, 100, 'pending')
    ON CONFLICT (startup_id, status) DO NOTHING;
    
    -- Log the action
    INSERT INTO ai_logs (log_type, action_type, input_data, output_data, status)
    VALUES (
      'match_queue',
      'auto_queue',
      jsonb_build_object('startup_id', NEW.id, 'name', NEW.name),
      jsonb_build_object('priority', 100, 'source', 'auto_approval'),
      'success'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on startup_uploads
DROP TRIGGER IF EXISTS trigger_queue_matches ON startup_uploads;
CREATE TRIGGER trigger_queue_matches
  AFTER INSERT OR UPDATE ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION queue_startup_for_matching();

-- Function to manually queue a startup (high priority for user submissions)
CREATE OR REPLACE FUNCTION manually_queue_startup(
  p_startup_id UUID,
  p_priority INT DEFAULT 200
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if startup exists
  SELECT EXISTS(SELECT 1 FROM startup_uploads WHERE id = p_startup_id) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Startup not found: %', p_startup_id;
  END IF;
  
  -- Insert with high priority
  INSERT INTO match_generation_queue (startup_id, priority, status)
  VALUES (p_startup_id, p_priority, 'pending')
  ON CONFLICT (startup_id, status) 
  DO UPDATE SET 
    priority = GREATEST(match_generation_queue.priority, p_priority),
    updated_at = NOW();
  
  -- Log the action
  INSERT INTO ai_logs (log_type, action_type, input_data, output_data, status)
  VALUES (
    'match_queue',
    'manual_queue',
    jsonb_build_object('startup_id', p_startup_id),
    jsonb_build_object('priority', p_priority, 'source', 'user_submission'),
    'success'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get next startup from queue
CREATE OR REPLACE FUNCTION get_next_from_queue()
RETURNS TABLE (
  id UUID,
  startup_id UUID,
  priority INT,
  attempts INT
) AS $$
BEGIN
  RETURN QUERY
  UPDATE match_generation_queue q
  SET 
    status = 'processing',
    updated_at = NOW(),
    attempts = q.attempts + 1
  WHERE q.id = (
    SELECT q2.id
    FROM match_generation_queue q2
    WHERE q2.status = 'pending'
    ORDER BY q2.priority DESC, q2.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id, q.startup_id, q.priority, q.attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to mark queue item as completed
CREATE OR REPLACE FUNCTION complete_queue_item(
  p_queue_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  IF p_success THEN
    UPDATE match_generation_queue
    SET 
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_queue_id;
  ELSE
    UPDATE match_generation_queue
    SET 
      status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
      last_error = p_error,
      updated_at = NOW()
    WHERE id = p_queue_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE match_generation_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything
CREATE POLICY "Service role full access" ON match_generation_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view queue items (read-only)
CREATE POLICY "Users can view queue items" ON match_generation_queue
  FOR SELECT
  TO authenticated
  USING (true);

-- Backfill existing approved startups into queue
INSERT INTO match_generation_queue (startup_id, priority, status)
SELECT 
  id,
  100, -- Normal priority for backfill
  'pending'
FROM startup_uploads
WHERE status = 'approved'
  AND id NOT IN (
    -- Only queue if they have no matches or very few matches
    SELECT DISTINCT startup_id 
    FROM startup_investor_matches 
    GROUP BY startup_id 
    HAVING COUNT(*) >= 10
  )
ON CONFLICT (startup_id, status) DO NOTHING;

-- Create a view for queue status
CREATE OR REPLACE VIEW queue_status AS
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM match_generation_queue
GROUP BY status;

COMMENT ON TABLE match_generation_queue IS 'Queue for generating startup-investor matches. Processed by match-regenerator.js';
COMMENT ON FUNCTION queue_startup_for_matching() IS 'Auto-trigger: Queues approved startups for matching';
COMMENT ON FUNCTION manually_queue_startup(UUID, INT) IS 'Manually queue a startup with custom priority (200=urgent, 100=normal)';
COMMENT ON FUNCTION get_next_from_queue() IS 'Get next pending item and mark as processing';
COMMENT ON FUNCTION complete_queue_item(UUID, BOOLEAN, TEXT) IS 'Mark queue item as completed or failed';
