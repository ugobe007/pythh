require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  // Get table columns by querying a single row
  const { data, error } = await supabase
    .from('discovered_startups')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ discovered_startups columns:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('⚠️ Table is empty, checking via info_schema...');
  }
  
  // Get row count
  const { count } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total rows: ${count || 0}`);
}

checkSchema().then(() => process.exit(0));
