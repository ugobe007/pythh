#!/usr/bin/env node
/**
 * Apply Migration via Supabase Admin API
 * Uses service role key to execute raw SQL
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('   Get it from: Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('📝 Reading migration file...\n');
  
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260119_convergence_engine_v1.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`📊 Found ${statements.length} SQL statements\n`);
  console.log('🚀 Executing migration...\n');
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    try {
      // Execute SQL using Supabase admin API
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: stmt
      });
      
      if (error) {
        // Try direct execution for DDL statements
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({ sql_query: stmt })
        });
        
        if (!response.ok) {
          console.log(`❌ Statement ${i + 1} failed`);
          console.log(`   ${stmt.substring(0, 80)}...`);
          failed++;
        } else {
          console.log(`✅ Statement ${i + 1} success`);
          success++;
        }
      } else {
        console.log(`✅ Statement ${i + 1} success`);
        success++;
      }
    } catch (err) {
      console.log(`❌ Statement ${i + 1} error:`, err.message);
      failed++;
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successful: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some statements failed. Try manual application:');
    console.log('   1. Open Supabase Dashboard > SQL Editor');
    console.log('   2. Copy/paste migration SQL');
    console.log('   3. Run');
  } else {
    console.log('\n🎉 Migration applied successfully!');
    console.log('\nVerify:');
    console.log('   SELECT COUNT(*) FROM investor_startup_observers;');
    console.log('   SELECT COUNT(*) FROM convergence_candidates;');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
