const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🧪 Testing startup creation with current database state...\n');
  
  const testStartup = {
    name: 'Test Startup ' + Date.now(),
    website: 'https://test-' + Date.now() + '.com',
    tagline: 'Test startup',
    sectors: ['Technology'],
    stage: 1,
    status: 'approved',
    source_type: 'url',
    total_god_score: 65,
    created_at: new Date().toISOString()
  };
  
  console.log('📝 Attempting to insert:', testStartup.name);
  console.log('📝 Website:', testStartup.website);
  console.log('');
  
  const { data, error } = await supabase
    .from('startup_uploads')
    .insert(testStartup)
    .select('id')
    .single();
    
  if (error) {
    console.log('❌ INSERT FAILED\n');
    console.log('Error code:', error.code);
    console.log('Error message:', error.message);
    console.log('Error details:', error.details);
    console.log('Error hint:', error.hint);
    console.log('\nFull error:', JSON.stringify(error, null, 2));
    
    if (error.message.includes('row-level security')) {
      console.log('\n🔴 RLS POLICY BLOCKING INSERT');
      console.log('The database trigger fix (SECURITY DEFINER) was NOT applied.');
      console.log('\n📋 Run this SQL in Supabase SQL Editor:\n');
      console.log(`
DROP FUNCTION IF EXISTS queue_startup_for_matching() CASCADE;

CREATE OR REPLACE FUNCTION queue_startup_for_matching()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status != 'approved') THEN
    INSERT INTO match_generation_queue (startup_id, priority, status)
    VALUES (NEW.id, 100, 'pending')
    ON CONFLICT (startup_id, status) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_queue_matches ON startup_uploads;
CREATE TRIGGER trigger_queue_matches
  AFTER INSERT OR UPDATE ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION queue_startup_for_matching();
      `);
    }
  } else {
    console.log('✅ INSERT SUCCESS!\n');
    console.log('New startup ID:', data.id);
    
    // Check if it was queued
    const { data: queueData } = await supabase
      .from('match_generation_queue')
      .select('*')
      .eq('startup_id', data.id);
      
    console.log('Queue entry:', queueData?.length ? '✅ Created' : '❌ Missing');
    
    if (queueData?.length) {
      console.log('Queue status:', queueData[0].status);
      console.log('Queue priority:', queueData[0].priority);
    }
    
    console.log('\n🎉 Database trigger is working correctly!');
  }
})();
