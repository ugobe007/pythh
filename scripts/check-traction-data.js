const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data, error } = await sb
    .from('startup_uploads')
    .select('arr_usd, revenue_usd, parsed_customers, parsed_users, traction_confidence, funding_confidence, has_revenue, has_customers, extracted_data')
    .eq('status', 'approved')
    .limit(5000);

  if (error) { console.error(error); return; }

  const total = data.length;
  const hasArr     = data.filter(r => r.arr_usd > 0).length;
  const hasRev     = data.filter(r => r.revenue_usd > 0).length;
  const hasCust    = data.filter(r => r.parsed_customers > 0).length;
  const hasUsers   = data.filter(r => r.parsed_users > 0).length;
  const hasTrConf  = data.filter(r => r.traction_confidence > 0).length;
  const hasFundConf= data.filter(r => r.funding_confidence > 0).length;
  const hasBoolRev = data.filter(r => r.has_revenue === true).length;
  const hasBoolCust= data.filter(r => r.has_customers === true).length;

  // Check extracted_data for revenue/customer signals
  const hasExtRev   = data.filter(r => r.extracted_data && (r.extracted_data.revenue || r.extracted_data.arr || r.extracted_data.mrr || r.extracted_data.has_revenue)).length;
  const hasExtCust  = data.filter(r => r.extracted_data && (r.extracted_data.customers || r.extracted_data.customer_count || r.extracted_data.has_customers)).length;
  const hasExtUsers = data.filter(r => r.extracted_data && (r.extracted_data.active_users || r.extracted_data.users)).length;

  console.log('\n========== TRACTION DATA COVERAGE ==========');
  console.log(`Total approved:           ${total}`);
  console.log('');
  console.log('--- Parsed Metric Columns (backfill) ---');
  console.log(`arr_usd > 0:              ${hasArr}  (${((hasArr/total)*100).toFixed(1)}%)`);
  console.log(`revenue_usd > 0:          ${hasRev}  (${((hasRev/total)*100).toFixed(1)}%)`);
  console.log(`parsed_customers > 0:     ${hasCust}  (${((hasCust/total)*100).toFixed(1)}%)`);
  console.log(`parsed_users > 0:         ${hasUsers}  (${((hasUsers/total)*100).toFixed(1)}%)`);
  console.log(`traction_confidence > 0:  ${hasTrConf}  (${((hasTrConf/total)*100).toFixed(1)}%)`);
  console.log(`funding_confidence > 0:   ${hasFundConf}  (${((hasFundConf/total)*100).toFixed(1)}%)`);
  console.log('');
  console.log('--- Boolean DB Columns ---');
  console.log(`has_revenue = true:       ${hasBoolRev}  (${((hasBoolRev/total)*100).toFixed(1)}%)`);
  console.log(`has_customers = true:     ${hasBoolCust}  (${((hasBoolCust/total)*100).toFixed(1)}%)`);
  console.log('');
  console.log('--- extracted_data JSONB signals ---');
  console.log(`has revenue in extracted: ${hasExtRev}  (${((hasExtRev/total)*100).toFixed(1)}%)`);
  console.log(`has customers in extracted:${hasExtCust}  (${((hasExtCust/total)*100).toFixed(1)}%)`);
  console.log(`has users in extracted:   ${hasExtUsers}  (${((hasExtUsers/total)*100).toFixed(1)}%)`);

  // Show sample extracted_data for one startup that has revenue
  const sampleWithRev = data.find(r => r.extracted_data && r.extracted_data.has_revenue);
  if (sampleWithRev) {
    console.log('\n--- Sample extracted_data with has_revenue ---');
    console.log(JSON.stringify(sampleWithRev.extracted_data, null, 2).substring(0, 800));
  }
  console.log('=============================================\n');
}

check();
