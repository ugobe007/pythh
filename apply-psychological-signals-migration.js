#!/usr/bin/env node

/**
 * Apply Psychological Signals Migration to Supabase
 * =================================================  
 * 
 * This migration adds:
 * - psychological_signals table
 * - investor_behavior_patterns table
 * - sector_momentum table
 * - Psychological signal columns to startup_uploads
 * - Functions and triggers for auto-calculating enhanced GOD scores
 * 
 * Usage: node apply-psychological-signals-migration.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log('🧠 APPLYING PSYCHOLOGICAL SIGNALS MIGRATION');
console.log('═══════════════════════════════════════════════════════════════\n');

// Validate environment
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_KEY');
  console.error('\nPlease check your .env file.');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const migrationPath = path.join(__dirname, 'supabase/migrations/20260212_psychological_signals.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, 'utf8');

console.log('📄 Migration File: 20260212_psychological_signals.sql');
console.log(`📏 Size: ${(sql.length / 1024).toFixed(2)} KB`);
console.log('─'.repeat(60));
console.log('\n⚠️  NOTE: This migration contains complex DDL (triggers, functions, views).');
console.log('   If automatic execution fails, please:');
console.log('   1. Open Supabase Dashboard → SQL Editor');
console.log('   2. Copy/paste: supabase/migrations/20260212_psychological_signals.sql');
console.log('   3. Click "Run" to execute manually\n');
console.log('─'.repeat(60));
console.log('\n🚀 Attempting automatic execution...\n');

(async () => {
  try {
    // Try executing the entire migration as one block
    // This works if Supabase supports the exec RPC or direct SQL execution
    
    // Method 1: Try via RPC (if exec function exists)
    console.log('Method 1: Trying RPC execution...');
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('exec', { sql })
      .catch(err => ({ data: null, error: err }));
    
    if (rpcError) {
      console.log('   ℹ️  RPC not available, trying direct query...\n');
      
      // Method 2: Try splitting into smaller statements
      console.log('Method 2: Splitting migration into statements...');
      
      // Split by semicolon, but be careful with function bodies
      const statements = sql
        .split(/;\s*(?=CREATE|ALTER|DROP|COMMENT|DO|INSERT|UPDATE|DELETE|GRANT)/gi)
        .map(s => s.trim())
        .filter(s => s.length > 10 && !s.startsWith('--'));
      
      console.log(`   Found ${statements.length} statements to execute\n`);
      
      let successCount = 0;
      let skipCount = 0;
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const preview = statement.substring(0, 80).replace(/\n/g, ' ');
        console.log(`[${i+1}/${statements.length}] ${preview}...`);
        
        try {
          // For DDL statements, we can't really execute them via JavaScript client
          // They need to run in Supabase SQL Editor
          skipCount++;
        } catch (err) {
          console.log(`   ⚠️  Skipped (DDL - run manually)`);
          skipCount++;
        }
      }
      
      console.log('\n' + '─'.repeat(60));
      console.log(`\n⚠️  Automatic execution not fully supported for complex DDL.`);
      console.log(`\n📋 MANUAL STEPS REQUIRED:`);
      console.log('─'.repeat(60));
      console.log('1. Open Supabase Dashboard: https://app.supabase.com');
      console.log('2. Navigate to: SQL Editor');
      console.log('3. Click "New Query"');
      console.log('4. Copy/paste entire file: supabase/migrations/20260212_psychological_signals.sql');
      console.log('5. Click "Run" (bottom right)');
      console.log('6. Verify success (should see "Success" message)\n');
      console.log('─'.repeat(60));
      console.log('\n📊 WHAT THIS MIGRATION DOES:');
      console.log('─'.repeat(60));
      console.log('✅ Creates psychological_signals table');
      console.log('✅ Creates investor_behavior_patterns table');
      console.log('✅ Creates sector_momentum table');
      console.log('✅ Adds 12 psychological signal columns to startup_uploads:');
      console.log('   - is_oversubscribed, oversubscription_multiple, fomo_signal_strength');
      console.log('   - has_followon, followon_investors, conviction_signal_strength');
      console.log('   - is_competitive, term_sheet_count, urgency_signal_strength');
      console.log('   - is_bridge_round, risk_signal_strength');
      console.log('   - psychological_multiplier, enhanced_god_score');
      console.log('✅ Creates calculate_psychological_multiplier() function');
      console.log('✅ Creates trigger for auto-updating enhanced GOD scores');
      console.log('✅ Creates analytical views (hot_startups_with_signals, sector_momentum_trend)');
      console.log('\n' + '─'.repeat(60));
      
      console.log('\n🔍 VALIDATION QUERIES (run after migration):');
      console.log('─'.repeat(60));
      console.log(`-- Check if tables exist`);
      console.log(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('psychological_signals', 'investor_behavior_patterns', 'sector_momentum');`);
      console.log();
      console.log(`-- Check new columns`);
      console.log(`SELECT column_name FROM information_schema.columns WHERE table_name = 'startup_uploads' AND column_name LIKE '%signal%' OR column_name LIKE 'enhanced%';`);
      console.log();
      console.log(`-- Test the multiplier function`);
      console.log(`SELECT calculate_psychological_multiplier('any-startup-uuid-here');`);
      console.log('\n' + '─'.repeat(60));
      
    } else {
      console.log('✅ Migration executed successfully via RPC!\n');
      successCount = statements.length;
    }
    
  } catch (err) {
    console.error('\n❌ Error executing migration:');
    console.error(err.message);
    console.log('\n📋 Please apply migration manually (see instructions above)');
  }
  
  console.log('\n💡 NEXT STEPS AFTER MIGRATION:');
  console.log('─'.repeat(60));
  console.log('1. Verify migration success in Supabase Dashboard');
  console.log('2. Run: node scripts/backfill-psychological-signals.js');
  console.log('   (Extract signals from existing startup_uploads data)');
  console.log('3. Run: npx tsx scripts/recalculate-scores.ts');
  console.log('   (Recalculate GOD scores with psychological multipliers)');
  console.log('4. Test enhanced scores: SELECT name, total_god_score, enhanced_god_score, psychological_multiplier FROM startup_uploads WHERE enhanced_god_score > total_god_score LIMIT 10;');
  console.log('\n');
  
})();
