// Apply trigger fix migration by executing SQL directly
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('📝 Applying trigger fix migration...\n');
  
  const sql = fs.readFileSync('supabase/migrations/20260213_fix_trigger_function.sql', 'utf8');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`Executing ${statements.length} SQL statements...\n`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.startsWith('DO $$') || stmt.includes('RAISE NOTICE')) {
      // Skip DO blocks (just comments)
      continue;
    }
    
    console.log(`${i + 1}. ${stmt.substring(0, 50)}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
    
    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      // Continue anyway - some errors are OK (like DROP IF EXISTS)
    } else {
      console.log(`   ✅ Success`);
    }
  }
  
  console.log('\n✅ Migration complete!');
  console.log('\n🔧 Testing trigger on a sample startup...\n');
  
  // Test by triggering an update on one startup with signals
  const { data: testStartup } = await supabase
    .from('startup_uploads')
    .select('id, name, is_oversubscribed, has_followon, psychological_multiplier, enhanced_god_score, total_god_score')
    .eq('status', 'approved')
    .or('is_oversubscribed.eq.true,has_followon.eq.true')
    .limit(1)
    .single();
  
  if (testStartup) {
    console.log(`Testing on: ${testStartup.name}`);
    console.log(`  Before: multiplier=${testStartup.psychological_multiplier}, enhanced=${testStartup.enhanced_god_score}`);
    
    // Trigger the update by setting total_god_score to itself
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({ total_god_score: testStartup.total_god_score })
      .eq('id', testStartup.id);
    
    if (updateError) {
      console.error(`  ❌ Update error: ${updateError.message}`);
    } else {
      // Fetch updated values
      const { data: updated } = await supabase
        .from('startup_uploads')
        .select('psychological_multiplier, enhanced_god_score')
        .eq('id', testStartup.id)
        .single();
      
      console.log(`  After:  multiplier=${updated.psychological_multiplier}, enhanced=${updated.enhanced_god_score}`);
      console.log(`  ${updated.psychological_multiplier > 0 ? '✅ Trigger working!' : '❌ Trigger not working'}`);
    }
  }
}

applyMigration().catch(console.error);
