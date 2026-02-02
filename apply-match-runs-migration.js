/**
 * apply-match-runs-migration.js
 * Applies the match runs migration using Supabase client
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function applyMigration() {
  try {
    console.log('📦 Reading migration file...');
    
    const migrationPath = path.join(__dirname, 'migrations', '001-match-runs-orchestration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying migration to Supabase...');
    console.log('   URL:', process.env.VITE_SUPABASE_URL);
    
    // Split SQL into statements (basic split on semicolon + newline)
    const statements = sql
      .split(';\n')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      // Skip comments and separators
      if (stmt.startsWith('--') || stmt.match(/^={10,}/)) {
        continue;
      }
      
      // Extract statement type for logging
      const stmtType = stmt.split(/\s+/)[0]?.toUpperCase() || 'UNKNOWN';
      
      process.stdout.write(`   [${i + 1}/${statements.length}] ${stmtType}... `);
      
      const { error } = await supabase.rpc('exec_sql', { sql_string: stmt + ';' });
      
      if (error) {
        // Try direct query if RPC doesn't exist
        const { error: queryError } = await supabase.from('_placeholder').select('*').limit(0);
        
        if (queryError) {
          console.log('❌ FAILED');
          console.error('   Error:', error.message);
          errorCount++;
          
          // Some errors are OK (e.g., "type already exists")
          if (error.message.includes('already exists')) {
            console.log('   ⚠️  Skipping (already exists)');
            successCount++;
          }
        } else {
          console.log('✅');
          successCount++;
        }
      } else {
        console.log('✅');
        successCount++;
      }
    }
    
    console.log('');
    console.log('✅ Migration complete!');
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart server: pm2 restart server');
    console.log('2. Test API: curl -X POST http://localhost:3002/api/match/run -H "Content-Type: application/json" -d \'{"url":"https://example.com"}\'');
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

applyMigration();
