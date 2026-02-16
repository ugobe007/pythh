#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function q(label, sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) { console.log(`  ❌ ${label}: ${error.message}`); return null; }
  if (data && typeof data === 'object' && data.error) { console.log(`  ❌ ${label}: ${data.error}`); return null; }
  return data;
}

(async () => {
  console.log('=== Capital Intelligence v2 — DB Verification ===\n');

  // Count populated rows
  const populated = await q('populated count',
    `SELECT json_build_object(
      'total', (SELECT count(*) FROM investors),
      'has_capital_type', (SELECT count(*) FROM investors WHERE capital_type IS NOT NULL),
      'has_fund_size', (SELECT count(*) FROM investors WHERE fund_size_estimate_usd IS NOT NULL),
      'has_confidence', (SELECT count(*) FROM investors WHERE fund_size_confidence IS NOT NULL),
      'has_power', (SELECT count(*) FROM investors WHERE capital_power_score IS NOT NULL),
      'has_eff_power', (SELECT count(*) FROM investors WHERE effective_capital_power IS NOT NULL),
      'has_velocity', (SELECT count(*) FROM investors WHERE deployment_velocity_index IS NOT NULL)
    )`
  );
  console.log('Column Population:');
  if (populated) {
    const p = typeof populated === 'string' ? JSON.parse(populated) : populated;
    console.log(`  Total investors: ${p.total}`);
    console.log(`  capital_type: ${p.has_capital_type} populated`);
    console.log(`  fund_size_estimate_usd: ${p.has_fund_size} populated`);
    console.log(`  fund_size_confidence: ${p.has_confidence} populated`);
    console.log(`  capital_power_score: ${p.has_power} populated`);
    console.log(`  effective_capital_power: ${p.has_eff_power} populated`);
    console.log(`  deployment_velocity_index: ${p.has_velocity} populated`);
  }

  // Top 10 by effective power
  const top = await q('top 10',
    `SELECT json_agg(t) FROM (
      SELECT name, capital_type, estimation_method, 
             round(capital_power_score::numeric, 2) as power,
             round(effective_capital_power::numeric, 2) as eff_pwr,
             round(fund_size_confidence::numeric, 2) as conf,
             round(fund_size_estimate_usd::numeric, 0) as fund_est,
             deployment_velocity_index as vel
      FROM investors 
      WHERE effective_capital_power IS NOT NULL 
      ORDER BY effective_capital_power DESC 
      LIMIT 10
    ) t`
  );
  console.log('\nTop 10 by Effective Capital Power:');
  if (Array.isArray(top)) {
    top.forEach((r, i) => console.log(`  ${i+1}. ${r.name} — eff=${r.eff_pwr} pwr=${r.power} conf=${r.conf} est=$${(r.fund_est/1e6).toFixed(0)}M vel=${r.vel} [${r.estimation_method}]`));
  } else if (top) {
    const arr = typeof top === 'string' ? JSON.parse(top) : top;
    if (Array.isArray(arr)) arr.forEach((r, i) => console.log(`  ${i+1}. ${r.name} — eff=${r.eff_pwr} pwr=${r.power} conf=${r.conf} [${r.estimation_method}]`));
    else console.log('  ', JSON.stringify(arr).slice(0, 500));
  }

  // Method distribution
  const methods = await q('methods',
    `SELECT json_agg(t) FROM (
      SELECT estimation_method, count(*) as cnt, 
             round(avg(fund_size_confidence)::numeric, 3) as avg_conf,
             round(avg(effective_capital_power)::numeric, 3) as avg_eff
      FROM investors WHERE estimation_method IS NOT NULL 
      GROUP BY estimation_method ORDER BY cnt DESC
    ) t`
  );
  console.log('\nMethod Distribution:');
  if (Array.isArray(methods)) {
    methods.forEach(r => console.log(`  ${r.estimation_method}: ${r.cnt} investors, avg_conf=${r.avg_conf}, avg_eff=${r.avg_eff}`));
  } else if (methods) {
    const arr = typeof methods === 'string' ? JSON.parse(methods) : methods;
    if (Array.isArray(arr)) arr.forEach(r => console.log(`  ${r.estimation_method}: ${r.cnt} investors, avg_conf=${r.avg_conf}, avg_eff=${r.avg_eff}`));
    else console.log('  ', JSON.stringify(arr).slice(0, 500));
  }

  process.exit(0);
})();
