const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  // Check for new discoveries in last hour
  const { data, error } = await supabase
    .from('discovered_startups')
    .select('name, created_at')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`\n📊 Discoveries in last hour: ${data.length}\n`);
  data.forEach(row => {
    const time = new Date(row.created_at).toLocaleTimeString();
    console.log(`${time} - ${row.name}`);
  });
  
  // Check total count
  const { count } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal discovered_startups: ${count}`);
})();
