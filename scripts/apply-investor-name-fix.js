#!/usr/bin/env node
/**
 * Apply migration to fix investor names always showing in RPC
 * Run with: node scripts/apply-investor-name-fix.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('📝 Reading migration file...');
  
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260202_fix_investor_names_visible.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Extract just the CREATE OR REPLACE FUNCTION part (skip comments)
  const functionMatch = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]+?\$\$;/);
  
  if (!functionMatch) {
    console.error('❌ Could not extract function from migration');
    process.exit(1);
  }
  
  console.log('🔧 Applying migration...');
  console.log('   Function: get_live_match_table');
  console.log('   Change: Always return investor_name (not NULL for locked)');
  
  const { error } = await supabase.rpc('exec_sql', { 
    sql: functionMatch[0] 
  });
  
  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
  
  console.log('✅ Migration applied successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Hard refresh your browser (Cmd+Shift+R)');
  console.log('2. Check /signal-matches?url=brickeye.com');
  console.log('3. Top 5 investors should show real names now');
}

applyMigration().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
