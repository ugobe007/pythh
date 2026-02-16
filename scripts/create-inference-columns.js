#!/usr/bin/env node
/**
 * Create all inference columns using exec_ddl + verify, then re-backfill
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function execDDL(label, sql) {
  const { data, error } = await sb.rpc('exec_ddl', { sql_text: sql });
  if (error) {
    console.log(`  ❌ ${label}: RPC error: ${error.message}`);
    return false;
  }
  if (data === 'OK') {
    console.log(`  ✅ ${label}`);
    return true;
  }
  console.log(`  ⚠️  ${label}: ${JSON.stringify(data)}`);
  return true;
}

async function execSQL(label, sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log(`  ❌ ${label}: ${error.message}`);
    return null;
  }
  if (data && typeof data === 'object' && data.error) {
    console.log(`  ❌ ${label}: ${data.error}`);
    return null;
  }
  return data;
}

(async () => {
  console.log('=== Creating All Inference Columns ===\n');

  // v1 columns
  const allCols = [
    ['capital_type', 'TEXT'],
    ['fund_size_estimate_usd', 'REAL'],
    ['fund_size_confidence', 'REAL'],
    ['estimation_method', 'TEXT'],
    ['capital_power_score', 'REAL'],
    // v2 columns
    ['effective_capital_power', 'REAL'],
    ['deployment_velocity_index', 'REAL'],
  ];

  for (const [col, type] of allCols) {
    await execDDL(`ADD ${col}`, `ALTER TABLE investors ADD COLUMN IF NOT EXISTS ${col} ${type}`);
  }

  // Indexes
  console.log('\n=== Creating Indexes ===');
  await execDDL('idx capital_power', `CREATE INDEX IF NOT EXISTS idx_investors_capital_power ON investors(capital_power_score)`);
  await execDDL('idx effective_capital', `CREATE INDEX IF NOT EXISTS idx_investors_effective_capital ON investors(effective_capital_power)`);
  await execDDL('idx velocity', `CREATE INDEX IF NOT EXISTS idx_investors_deployment_velocity ON investors(deployment_velocity_index)`);

  // Verify
  console.log('\n=== Verifying Columns ===');
  const check = await execSQL('verify',
    `SELECT json_agg(column_name) FROM information_schema.columns 
     WHERE table_name = 'investors' 
     AND column_name IN ('capital_type','fund_size_estimate_usd','fund_size_confidence','estimation_method','capital_power_score','effective_capital_power','deployment_velocity_index')`
  );
  console.log('  Found:', JSON.stringify(check));

  // Test write + read using exec_ddl for UPDATE (no return data)
  console.log('\n=== Write Test ===');
  await execDDL('write test', `UPDATE investors SET capital_power_score = NULL WHERE capital_power_score IS NULL LIMIT 0`);
  
  // Read test  
  const readTest = await execSQL('read test',
    `SELECT count(*) as cnt FROM investors WHERE capital_power_score IS NOT NULL`
  );
  console.log('  Rows with capital_power_score:', JSON.stringify(readTest));

  console.log('\nDone. Columns ready for backfill.');
  process.exit(0);
})();
