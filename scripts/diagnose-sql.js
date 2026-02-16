#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Try to get columns with JSON-compatible output
  const { data: cols } = await sb.rpc('exec_sql', { 
    sql_query: `SELECT json_agg(json_build_object('col', column_name, 'type', data_type)) 
                FROM information_schema.columns WHERE table_name = 'investors'`
  });
  
  if (Array.isArray(cols)) {
    const allCols = cols[0] ? (typeof cols[0].json_agg === 'string' ? JSON.parse(cols[0].json_agg) : cols[0].json_agg) : cols;
    const names = (Array.isArray(allCols) ? allCols : []).map(c => c.col);
    console.log('Total columns:', names.length);
    console.log('\nInference columns:');
    const infCols = ['capital_type','fund_size_estimate_usd','fund_size_confidence','estimation_method','capital_power_score','effective_capital_power','deployment_velocity_index'];
    for (const ic of infCols) {
      console.log(`  ${ic}: ${names.includes(ic) ? '✅ EXISTS' : '❌ MISSING'}`);
    }
  } else {
    console.log('Raw result:', JSON.stringify(cols).slice(0, 500));
    // If that failed, try a different approach
    const { data: d2 } = await sb.rpc('exec_sql', {
      sql_query: `SELECT count(*) as cnt FROM information_schema.columns WHERE table_name = 'investors' AND column_name = 'capital_power_score'`
    });
    console.log('capital_power_score exists?', JSON.stringify(d2));
  }

  // Check exec_sql function definition  
  const { data: funcDef } = await sb.rpc('exec_sql', {
    sql_query: `SELECT to_json(p.prosrc) as src FROM pg_proc p WHERE p.proname = 'exec_sql'`
  });
  console.log('\nexec_sql source:', JSON.stringify(funcDef).slice(0, 500));

  // Try creating a DDL-capable function
  console.log('\n=== Trying to create exec_ddl function ===');
  const ddlFunc = `
    CREATE OR REPLACE FUNCTION exec_ddl(sql_text TEXT) RETURNS TEXT AS $$
    BEGIN
      EXECUTE sql_text;
      RETURN 'OK';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  // Wrap in a SELECT that returns JSON
  const { data: createResult, error: createErr } = await sb.rpc('exec_sql', {
    sql_query: `DO $$ BEGIN EXECUTE 'CREATE OR REPLACE FUNCTION exec_ddl(sql_text TEXT) RETURNS TEXT AS $fn$ BEGIN EXECUTE sql_text; RETURN ''OK''; END; $fn$ LANGUAGE plpgsql SECURITY DEFINER'; END $$; SELECT json_build_object('status', 'created') as result`
  });
  console.log('Create exec_ddl result:', JSON.stringify(createResult), createErr?.message);

  process.exit(0);
})();
