#!/usr/bin/env node
/**
 * Create v3 inference columns: fund_size_reported_usd, fund_size_reported_status,
 * fund_size_reported_date, fund_size_raw_mentions (JSONB), fund_size_evidence_text
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
  console.log('=== Creating v3 Inference Columns ===\n');

  const v3Cols = [
    ['fund_size_reported_usd', 'REAL'],
    ['fund_size_reported_status', 'TEXT'],
    ['fund_size_reported_date', 'TEXT'],
    ['fund_size_raw_mentions', 'JSONB'],
    ['fund_size_evidence_text', 'TEXT'],
  ];

  for (const [col, type] of v3Cols) {
    await execDDL(`ADD ${col}`, `ALTER TABLE investors ADD COLUMN IF NOT EXISTS ${col} ${type}`);
  }

  // Verify all v3 columns exist
  console.log('\n=== Verifying v3 Columns ===');
  const check = await execSQL('verify',
    `SELECT json_agg(column_name ORDER BY column_name) FROM information_schema.columns 
     WHERE table_name = 'investors' 
     AND column_name IN ('fund_size_reported_usd','fund_size_reported_status','fund_size_reported_date','fund_size_raw_mentions','fund_size_evidence_text')`
  );
  console.log('  Found:', JSON.stringify(check));

  console.log('\nDone. v3 columns ready for backfill.');
})();
