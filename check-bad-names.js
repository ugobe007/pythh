const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const badNames = [
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'Please Fund', 
  'Pur', 'American', 'Researchers', 'Everything'
];

const goodNames = ['OpenAI', 'Railway', 'MemRL', 'LinkedIn'];

(async () => {
  console.log('\n🔍 Checking for bad extractions in discovered_startups:\n');
  
  const { data, error } = await supabase
    .from('discovered_startups')
    .select('name, created_at')
    .in('name', [...badNames, ...goodNames])
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.log('Error:', error);
    return;
  }
  
  console.log(`Found ${data.length} matches:`);
  data.forEach(row => {
    const isBad = badNames.includes(row.name);
    console.log(`${isBad ? '❌' : '✅'} ${row.name.padEnd(20)} (${new Date(row.created_at).toLocaleDateString()})`);
  });
  
  console.log('\n📊 Checking startup_uploads too:\n');
  
  const { data: uploads } = await supabase
    .from('startup_uploads')
    .select('name, status')
    .in('name', badNames)
    .limit(10);
  
  if (uploads && uploads.length > 0) {
    console.log(`Found ${uploads.length} bad names in startup_uploads:`);
    uploads.forEach(row => {
      console.log(`❌ ${row.name.padEnd(20)} (${row.status})`);
    });
  } else {
    console.log('✅ No bad names in startup_uploads');
  }
})();
