// Check if triggers exist on startup_uploads table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTriggers() {
  console.log('🔍 Checking database triggers...\n');

  // Check if update_enhanced_god_score trigger exists
  const { data: triggers, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT 
          tgname AS trigger_name,
          tgenabled AS is_enabled,
          proname AS function_name
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'startup_uploads'
        AND tgname LIKE '%psych%' OR tgname LIKE '%enhanced%';
      `
    });

  if (error) {
    // Try direct query instead
    const { data: pgTriggers, error: pgError } = await supabase
      .from('pg_trigger')
      .select('*');
    
    console.log('❌ Could not query triggers directly');
    console.log('💡 Need to manually verify trigger exists in Supabase SQL Editor\n');
    
    // Try to manually trigger an update
    console.log('🔄 Attempting to manually trigger an update...');
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('id, name, psychological_multiplier')
      .eq('name', 'Helia Care')
      .single();
    
    if (!startupError && startup) {
      console.log(`\nFound startup: ${startup.name}`);
      console.log(`Current psychological_multiplier: ${startup.psychological_multiplier}`);
      
      // Force an update to trigger the trigger
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update({ total_god_score: startup.total_god_score || 86 })
        .eq('id', startup.id);
      
      if (updateError) {
        console.error('❌ Update failed:', updateError);
        return;
      }
      
      console.log('✅ Forced update to trigger trigger...');
      
      // Check if psychological_multiplier changed
      const { data: updated } = await supabase
        .from('startup_uploads')
        .select('psychological_multiplier')
        .eq('id', startup.id)
        .single();
      
      console.log(`After update: ${updated.psychological_multiplier}`);
      
      if (updated.psychological_multiplier === startup.psychological_multiplier) {
        console.log('\n⚠️  Trigger did NOT fire!');
        console.log('💡 Need to reapply the trigger migration');
      } else {
        console.log('\n✅ Trigger fired successfully!');
      }
    }
  }
}

checkTriggers().catch(console.error);
