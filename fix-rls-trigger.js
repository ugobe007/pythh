const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🔧 Fixing RLS issue on match_generation_queue trigger\n');
  
  // Drop existing function
  const { error: dropError } = await supabase.rpc('exec_sql', {
    sql_query: 'DROP FUNCTION IF EXISTS queue_startup_for_matching() CASCADE;'
  });
  
  if (dropError) {
    console.log('⚠️  Drop warning:', dropError.message);
  }
  
  // Create function with SECURITY DEFINER
  const createFunctionSQL = `
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
`;

  const { error: funcError } = await supabase.rpc('exec_sql', {
    sql_query: createFunctionSQL
  });
  
  if (funcError) {
    console.log('❌ Function creation failed:', funcError.message);
    console.log('\n📋 Manual fix - Run this in Supabase SQL Editor:\n');
    console.log(createFunctionSQL);
    process.exit(1);
  }
  
  // Recreate trigger
  const createTriggerSQL = `
DROP TRIGGER IF EXISTS trigger_queue_matches ON startup_uploads;
CREATE TRIGGER trigger_queue_matches
  AFTER INSERT OR UPDATE ON startup_uploads
  FOR EACH ROW
  EXECUTE FUNCTION queue_startup_for_matching();
`;

  const { error: trigError } = await supabase.rpc('exec_sql', {
    sql_query: createTriggerSQL
  });
  
  if (trigError) {
    console.log('❌ Trigger creation failed:', trigError.message);
    process.exit(1);
  }
  
  console.log('✅ Trigger function updated with SECURITY DEFINER');
  console.log('✅ RLS will no longer block trigger inserts');
  console.log('\n🎯 Now refresh your browser and try submitting a URL again!\n');
})();
