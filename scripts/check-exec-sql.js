#!/usr/bin/env node
/**
 * Check the exec_sql function definition and try alternatives
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Get exec_sql function definition
  const { data: funcDef } = await sb.rpc('exec_sql', { 
    sql_query: `SELECT prosrc FROM pg_proc WHERE proname = 'exec_sql'`
  });
  console.log('=== exec_sql function ===');
  console.log(JSON.stringify(funcDef, null, 2));

  // Check if v1 columns actually exist by listing ALL investor columns
  const { data: cols } = await sb.rpc('exec_sql', { 
    sql_query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'investors' ORDER BY ordinal_position`
  });
  console.log('\n=== All investor columns ===');
  if (Array.isArray(cols)) {
    cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    console.log(`  Total: ${cols.length}`);
  } else {
    console.log(JSON.stringify(cols).slice(0, 500));
  }

  process.exit(0);
})();
