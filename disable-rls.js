require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🔓 Disabling RLS on startup_investor_matches...\n');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE startup_investor_matches DISABLE ROW LEVEL SECURITY;'
  });
  
  if (error) {
    console.error('❌ Failed:', error.message);
  } else {
    console.log('✅ RLS disabled successfully!');
    console.log('\nNow test in browser - component should load matches.');
  }
})();
