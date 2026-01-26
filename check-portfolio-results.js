require('dotenv').config();
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
    .like('rss_source', 'vc-portfolio:%');
  
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  console.log(`\n📊 Portfolio Scraper Results:`);
  console.log(`Total companies: ${count || 0}`);
  
  if (data && data.length > 0) {
    console.log(`\n✅ Sample companies (first 5):`);
    data.slice(0, 5).forEach(c => {
      console.log(`  - ${c.name}`);
      console.log(`    Website: ${c.website || 'N/A'}`);
      console.log(`    VC: ${c.lead_investor || c.rss_source || 'N/A'}`);
      console.log('');
    });
  }
}

checkResults().catch(console.error);
