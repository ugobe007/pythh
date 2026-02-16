#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Check top effective_capital_power values
  const { data: top } = await sb.rpc('exec_sql', { 
    sql_query: `SELECT name, capital_power_score, effective_capital_power, fund_size_confidence, 
                       deployment_velocity_index, estimation_method 
                FROM investors 
                WHERE effective_capital_power IS NOT NULL 
                ORDER BY effective_capital_power DESC LIMIT 10`
  });
  console.log('=== Top 10 by Effective Capital Power ===');
  if (Array.isArray(top)) {
    top.forEach(r => console.log(`  ${r.name}: pwr=${r.capital_power_score} eff=${r.effective_capital_power} conf=${r.fund_size_confidence} vel=${r.deployment_velocity_index} [${r.estimation_method}]`));
  } else {
    console.log('  Raw:', JSON.stringify(top).slice(0, 300));
  }

  // Distribution summary
  const { data: dist } = await sb.rpc('exec_sql', {
    sql_query: `SELECT 
      count(*) as total,
      count(effective_capital_power) as has_eff_pwr,
      count(deployment_velocity_index) as has_velocity,
      round(avg(effective_capital_power)::numeric, 3) as avg_eff_pwr,
      round(avg(fund_size_confidence)::numeric, 3) as avg_conf,
      round(avg(deployment_velocity_index)::numeric, 3) as avg_vel
    FROM investors`
  });
  console.log('\n=== Distribution Summary ===');
  console.log('  ', JSON.stringify(dist));

  // Method breakdown
  const { data: methods } = await sb.rpc('exec_sql', {
    sql_query: `SELECT estimation_method, count(*), round(avg(fund_size_confidence)::numeric, 3) as avg_conf
                FROM investors WHERE estimation_method IS NOT NULL 
                GROUP BY estimation_method ORDER BY count DESC`
  });
  console.log('\n=== Method → Avg Confidence ===');
  if (Array.isArray(methods)) methods.forEach(r => console.log(`  ${r.estimation_method}: ${r.count} investors, avg_conf=${r.avg_conf}`));

  process.exit(0);
})();
