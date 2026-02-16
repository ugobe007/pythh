const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
  const { data } = await sb.rpc('exec_sql', { sql_query: `
    SELECT json_build_object(
      'arr_or_rev_conf_04', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND (arr_usd > 0 OR revenue_usd > 0) AND traction_confidence >= 0.4),
      'funding_conf_05', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND (last_round_amount_usd > 0 OR total_funding_usd > 0) AND funding_confidence >= 0.5),
      'customers_gt0', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND parsed_customers > 0),
      'users_gt0', (SELECT count(*) FROM startup_uploads WHERE status='approved' AND parsed_users > 0),
      'total', (SELECT count(*) FROM startup_uploads WHERE status='approved')
    ) as result
  ` });
  console.log(JSON.stringify(data, null, 2));
}
check();
