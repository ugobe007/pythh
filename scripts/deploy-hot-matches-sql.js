#!/usr/bin/env node

/**
 * Deploy Hot Matches SQL Functions to Supabase
 * 
 * Reads the SQL file and executes it against the Supabase database
 * using the service role key to bypass RLS
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deploySqlFunctions() {
  console.log('🚀 Deploying Hot Matches SQL functions to Supabase...\n');
  
  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'supabase', 'functions', 'get_hot_matches.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found: ${sqlPath}`);
    process.exit(1);
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Split by function creation (each CREATE OR REPLACE FUNCTION block)
  const functionBlocks = sql.split(/(?=CREATE OR REPLACE FUNCTION)/);
  
  console.log(`📄 Found ${functionBlocks.filter(b => b.trim()).length} function blocks to deploy\n`);
  
  for (const block of functionBlocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    
    // Extract function name for logging
    const match = trimmed.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/);
    const funcName = match ? match[1] : 'unknown';
    
    console.log(`📦 Deploying function: ${funcName}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: trimmed }).catch(() => {
        // If exec_sql doesn't exist, we need to use a raw query approach
        // For Supabase, we can't execute raw DDL via RPC easily
        // Instead, user should manually run this in SQL Editor
        throw new Error('Cannot execute DDL via Supabase client - use SQL Editor');
      });
      
      if (error) throw error;
      
      console.log(`   ✅ ${funcName} deployed successfully`);
    } catch (err) {
      console.error(`   ❌ Error deploying ${funcName}:`, err.message);
      console.error('\n⚠️  Supabase doesn\'t support running DDL (CREATE FUNCTION) via client library.');
      console.error('📋 Please deploy manually:');
      console.error('   1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql/new');
      console.error('   2. Copy contents of: supabase/functions/get_hot_matches.sql');
      console.error('   3. Paste and run in SQL Editor');
      console.error('   4. Refresh your app');
      process.exit(1);
    }
  }
  
  console.log('\n✅ All functions deployed successfully!');
  console.log('\n🔍 Testing functions...');
  
  // Test the functions
  try {
    const { data: matches, error: matchError } = await supabase.rpc('get_hot_matches', {
      limit_count: 5,
      hours_ago: 168 // 7 days
    });
    
    if (matchError) throw matchError;
    
    console.log(`   ✅ get_hot_matches() works - returned ${matches?.length || 0} matches`);
    
    const { data: velocity, error: velError } = await supabase.rpc('get_platform_velocity');
    
    if (velError) throw velError;
    
    console.log(`   ✅ get_platform_velocity() works - ${velocity?.[0]?.total_matches_today || 0} matches today`);
    
    console.log('\n🎉 Hot Matches system is live!');
    
  } catch (err) {
    console.error('   ❌ Function test failed:', err.message);
  }
}

deploySqlFunctions().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
