#!/usr/bin/env node
/**
 * Update get_startup_context RPC function
 * Adds enhanced fields for richer startup profile display
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   Need: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateRPC() {
  console.log('🔄 Updating get_startup_context RPC function...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, '..', 'update-startup-context-rpc.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try running it as a query
      const { error: directError } = await supabase.from('_').select('*').limit(0);
      
      console.log('⚠️  Cannot execute SQL directly via Supabase client.');
      console.log('📋 Please run this SQL manually in your Supabase SQL Editor:\n');
      console.log('   1. Go to: https://supabase.com/dashboard/project/[YOUR_PROJECT]/sql');
      console.log('   2. Copy contents of: update-startup-context-rpc.sql');
      console.log('   3. Paste and run in SQL Editor\n');
      
      console.log('Or use psql:');
      console.log('   psql "$SUPABASE_DB_URL" -f update-startup-context-rpc.sql\n');
      
      process.exit(1);
    }

    console.log('✅ Function updated successfully!');
    console.log('📊 Enhanced profile now shows:');
    console.log('   • Logo');
    console.log('   • Sectors');
    console.log('   • Raise amount/type');
    console.log('   • Problem/Solution');
    console.log('   • Value proposition');
    console.log('   • Traction metrics (from extracted_data)');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📋 Manual update required:');
    console.log('   Run: update-startup-context-rpc.sql in Supabase SQL Editor');
    process.exit(1);
  }
}

updateRPC();
