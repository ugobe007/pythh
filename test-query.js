require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('Testing Supabase connection...\n');
  
  // Try to query without count first
  const { data, error } = await s
    .from('startup_investor_matches')
    .select('id, match_score, status')
    .limit(5);
  
  if (error) {
    console.log('❌ ERROR:', error.message);
    console.log('Code:', error.code);
    console.log('Details:', error.details);
  } else {
    console.log('✅ Query succeeded');
    console.log('Rows returned:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('Sample:', data[0]);
    }
  }
})();
