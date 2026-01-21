#!/usr/bin/env node
/**
 * Apply Convergence Engine V1 Migration
 * =====================================
 * Run this to create observer tracking tables + views
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function applyMigration() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables');
    console.error('   Need: VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  
  console.log('🔧 Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Read migration SQL
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260119_convergence_engine_v1.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📝 Applying convergence engine migration...');
  console.log(`   File: ${migrationPath}`);
  console.log(`   Size: ${sql.length} bytes`);
  
  // Split into statements and execute one by one
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  console.log(`   Statements: ${statements.length}`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    // Skip comments and empty statements
    if (stmt.startsWith('--') || stmt.trim() === ';') continue;
    
    try {
      const { error } = await supabase.rpc('exec', { sql: stmt });
      
      if (error) {
        console.error(`❌ Statement ${i + 1} failed:`, error.message.substring(0, 100));
        failed++;
      } else {
        success++;
        if (i % 5 === 0) {
          console.log(`✓ Progress: ${i + 1}/${statements.length}`);
        }
      }
    } catch (e) {
      console.error(`❌ Statement ${i + 1} error:`, e.message.substring(0, 100));
      failed++;
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Successful: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 Migration complete! Convergence engine is ready.');
    console.log('\nNext steps:');
    console.log('1. Restart api-server: pm2 restart api-server');
    console.log('2. Test endpoint: curl "http://localhost:3002/api/discovery/convergence?url=test.com"');
  } else {
    console.log('\n⚠️  Migration had errors. Check Supabase dashboard for details.');
  }
}

applyMigration().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
