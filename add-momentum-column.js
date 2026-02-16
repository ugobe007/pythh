#!/usr/bin/env node
/**
 * Add momentum_score column to startup_uploads table
 * Fixes: "⚠️ momentum_score column not found" warning in recalculate-scores.ts
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('Adding momentum_score column to startup_uploads...');
  
  // Check if column exists first
  const { error: checkErr } = await supabase
    .from('startup_uploads')
    .select('momentum_score')
    .limit(1);
  
  if (!checkErr || !checkErr.message?.includes('momentum_score')) {
    console.log('✅ Column already exists!');
    return;
  }
  
  console.log('Column does not exist, adding via SQL...');
  
  // Use the exec_sql RPC (correct parameter name: sql_query)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('exec_sql', {
    sql_query: 'ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS momentum_score NUMERIC DEFAULT 0;'
  });
  
  if (rpcErr) {
    console.log('exec_sql RPC failed:', rpcErr.message);
    console.log('\nPlease run this SQL in the Supabase Dashboard SQL Editor:');
    console.log('---');
    console.log('ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS momentum_score NUMERIC DEFAULT 0;');
    console.log('---');
  } else {
    console.log('Column added successfully via exec_sql RPC');
  }
  
  // Verify
  const { error: verifyErr } = await supabase
    .from('startup_uploads')
    .select('momentum_score')
    .limit(1);
  
  if (verifyErr) {
    console.log('Verification failed:', verifyErr.message);
  } else {
    console.log('Verified: momentum_score column now exists');
  }
}

main().catch(console.error);
