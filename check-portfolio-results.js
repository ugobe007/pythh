require('dotenv').config({ path: '.env.bak' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkResults() {
  // Check portfolio scraper results
  const { data, error, count } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact' })
    .eq('source', 'vc-portfolio');
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('Note: discovered_startups may need vc_name, logo_url columns');
    return;
  }
  
  console.log(`\n📊 Portfolio Scraper Results:`);
  console.log(`Total companies: ${count || 0}`);
  
  if (data && data.length > 0) {
    console.log(`\n✅ Sample companies (first 5):`);
    data.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}`);
      console.log(`    Website: ${c.website || 'N/A'}`);
      console.log(`    VC: ${c.vc_name || 'N/A'}`);
      console.log('');
    });
  }
}

checkResults().catch(console.error);
