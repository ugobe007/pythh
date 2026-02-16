#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Check if columns exist
  const { data, error } = await sb.rpc('exec_sql', { 
    sql_query: `SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'investors' 
                AND column_name IN ('capital_power_score', 'effective_capital_power', 'deployment_velocity_index', 'fund_size_confidence', 'estimation_method', 'capital_type', 'fund_size_estimate_usd')
                ORDER BY column_name`
  });
  console.log('Columns found:', JSON.stringify(data));
  if (error) console.log('Error:', error.message);

  // Try a simple query
  const { data: d2, error: e2 } = await sb.rpc('exec_sql', {
    sql_query: `SELECT name FROM investors LIMIT 1`
  });
  console.log('Simple query:', JSON.stringify(d2));
  if (e2) console.log('Error2:', e2.message);

  // Try just the new columns
  const { data: d3, error: e3 } = await sb.rpc('exec_sql', {
    sql_query: `SELECT effective_capital_power FROM investors WHERE effective_capital_power IS NOT NULL LIMIT 1`
  });
  console.log('New col query:', JSON.stringify(d3));
  if (e3) console.log('Error3:', e3.message);

  process.exit(0);
})();
