const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  console.log('\n=== STARTUP DATA DIAGNOSTIC ===\n');
  
  // Total count
  const { count: total } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true });
  console.log('Total startups:', total);
  
  // Status breakdown
  const { data: allStatuses } = await supabase
    .from('startup_uploads')
    .select('status')
    .limit(2000);
  
  const statusCounts = {};
  allStatuses.forEach(s => {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  });
  console.log('\nStatus breakdown:', statusCounts);
  
  // Sample startup
  const { data: sample } = await supabase
    .from('startup_uploads')
    .select('id, name, status, total_god_score')
    .limit(5);
  console.log('\nSample startups:', sample);
  
  process.exit(0);
})();
