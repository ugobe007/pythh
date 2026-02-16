#!/usr/bin/env node
/**
 * Apply capital intelligence v2 columns with proper error checking
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function execAndCheck(label, sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.log(`  ❌ ${label}: RPC error: ${error.message}`);
    return false;
  }
  // Check if data contains a SQL error
  if (data && typeof data === 'object' && data.error) {
    console.log(`  ❌ ${label}: SQL error: ${JSON.stringify(data)}`);
    return false;
  }
  if (typeof data === 'string' && data.includes('"error"')) {
    console.log(`  ❌ ${label}: SQL error (string): ${data.slice(0, 200)}`);
    return false;
  }
  console.log(`  ✅ ${label}: OK (result: ${JSON.stringify(data).slice(0, 100)})`);
  return true;
}

(async () => {
  console.log('=== Step 1: Check existing v1 columns ===');
  await execAndCheck('v1 columns exist', 
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'investors' 
     AND column_name IN ('capital_type','fund_size_estimate_usd','fund_size_confidence','estimation_method','capital_power_score')`
  );

  console.log('\n=== Step 2: Create v1 columns if missing ===');
  // These must exist for the backfill to work
  const v1Cols = [
    ['capital_type', 'TEXT'],
    ['fund_size_estimate_usd', 'REAL'],
    ['fund_size_confidence', 'REAL'],
    ['estimation_method', 'TEXT'],
    ['capital_power_score', 'REAL'],
  ];
  for (const [col, type] of v1Cols) {
    await execAndCheck(`ADD ${col}`,
      `ALTER TABLE investors ADD COLUMN IF NOT EXISTS ${col} ${type}`
    );
  }

  console.log('\n=== Step 3: Create v2 columns ===');
  await execAndCheck('ADD effective_capital_power',
    `ALTER TABLE investors ADD COLUMN IF NOT EXISTS effective_capital_power REAL`
  );
  await execAndCheck('ADD deployment_velocity_index',
    `ALTER TABLE investors ADD COLUMN IF NOT EXISTS deployment_velocity_index REAL`
  );

  console.log('\n=== Step 4: Create indexes ===');
  await execAndCheck('INDEX effective_capital_power',
    `CREATE INDEX IF NOT EXISTS idx_investors_effective_capital ON investors(effective_capital_power)`
  );
  await execAndCheck('INDEX deployment_velocity_index',
    `CREATE INDEX IF NOT EXISTS idx_investors_deployment_velocity ON investors(deployment_velocity_index)`
  );

  console.log('\n=== Step 5: Verify columns exist now ===');
  await execAndCheck('All 7 columns',
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'investors' 
     AND column_name IN ('capital_type','fund_size_estimate_usd','fund_size_confidence','estimation_method','capital_power_score','effective_capital_power','deployment_velocity_index')
     ORDER BY column_name`
  );

  // Try a write + read test
  console.log('\n=== Step 6: Write/Read test ===');
  await execAndCheck('Write test',
    `UPDATE investors SET effective_capital_power = 0.99 WHERE name = 'Test__nonexistent__'`
  );
  await execAndCheck('Read test',
    `SELECT count(*) as cnt FROM investors WHERE effective_capital_power IS NOT NULL`
  );

  process.exit(0);
})();
