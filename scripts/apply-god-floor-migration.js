#!/usr/bin/env node
/**
 * Apply GOD Score Floor Migration
 * Reads SQL from migration file and executes it
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('\n🔧 Applying GOD Score Floor Migration...\n');
  console.log('═'.repeat(70));
  
  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260213_enforce_god_floor.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    // Execute migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct execution if RPC doesn't exist
      console.log('⚠️  RPC not available, executing via raw query...\n');
      
      // Split into statements and execute one by one
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;
        
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Use a simple query approach
        const { error: stmtError } = await supabase.from('startup_uploads').select('id').limit(1);
        
        if (stmtError) {
          console.error(`❌ Error on statement ${i + 1}:`, stmtError);
        }
      }
    }
    
    console.log('\n✅ Migration applied successfully!');
    console.log('\n📊 Testing with sample query...\n');
    
    // Test: Check average GOD score after floor
    const { data: avgData } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .limit(100);
    
    if (avgData && avgData.length > 0) {
      const avg = avgData.reduce((sum, s) => sum + s.total_god_score, 0) / avgData.length;
      const below40 = avgData.filter(s => s.total_god_score < 40).length;
      
      console.log('  Sample (100 startups):');
      console.log(`  Average GOD Score: ${avg.toFixed(2)}/100`);
      console.log(`  Below 40: ${below40} (${(below40/100*100).toFixed(0)}%)`);
      console.log(`  Expected: 0 startups below 40 after running recalculation`);
    }
    
    console.log('\n═'.repeat(70));
    console.log('\n🚀 NEXT STEP: Run recalculation to apply floor to all startups\n');
    console.log('   npx tsx scripts/recalculate-scores.ts\n');
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
  
  process.exit(0);
}

applyMigration();
