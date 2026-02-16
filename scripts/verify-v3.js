#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function q(label, sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) console.log(`${label}: ERR ${error.message}`);
  else console.log(`${label}: ${JSON.stringify(data)}`);
}

(async () => {
  console.log('=== v3 Column Verification ===\n');

  await q('reported_usd populated', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_reported_usd IS NOT NULL");
  await q('reported_status populated', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_reported_status IS NOT NULL");
  await q('reported_date populated', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_reported_date IS NOT NULL");
  await q('raw_mentions populated', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_raw_mentions IS NOT NULL");
  await q('evidence_text populated', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_evidence_text IS NOT NULL");

  await q('estimation_method dist', "SELECT json_agg(r) FROM (SELECT estimation_method, count(*) as cnt FROM investors WHERE estimation_method IS NOT NULL GROUP BY estimation_method ORDER BY cnt DESC) r");

  await q('capital_type dist', "SELECT json_agg(r) FROM (SELECT capital_type, count(*) as cnt FROM investors WHERE capital_type IS NOT NULL GROUP BY capital_type ORDER BY cnt DESC) r");

  // Sample reported_usd entries
  await q('sample reported', "SELECT json_agg(r) FROM (SELECT name, fund_size_reported_usd, fund_size_reported_status, estimation_method FROM investors WHERE fund_size_reported_usd IS NOT NULL ORDER BY fund_size_reported_usd DESC LIMIT 10) r");

  // Check total with any inference data
  await q('total with inference', "SELECT json_build_object('cnt', count(*)) FROM investors WHERE fund_size_estimate_usd IS NOT NULL");

  console.log('\nDone.');
})();
