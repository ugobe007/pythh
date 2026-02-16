#!/usr/bin/env node
/**
 * APPLY SCORE TRACKING MIGRATION
 * 
 * Purpose: Add last_score_change_at column and trigger for dead wood cleanup
 * Migration: 20260213_add_score_tracking.sql
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('📋 APPLYING SCORE TRACKING MIGRATION');
  console.log('═'.repeat(60));
  console.log('');

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260213_add_score_tracking.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Migration file: 20260213_add_score_tracking.sql');
  console.log('Size:', Math.round(migrationSQL.length / 1024), 'KB');
  console.log('');

  console.log('⚠️  NOTE: Supabase client cannot execute DDL statements directly.');
  console.log('You must apply this migration via the Supabase Dashboard.');
  console.log('');
  console.log('📋 MANUAL APPLICATION STEPS:');
  console.log('─'.repeat(60));
  console.log('');
  console.log('1. Open Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to "SQL Editor" in the left sidebar');
  console.log('4. Click "New query"');
  console.log('5. Copy and paste the migration SQL from:');
  console.log(`   ${migrationPath}`);
  console.log('6. Click "Run"');
  console.log('');
  console.log('Or run this command to display the SQL:');
  console.log(`   cat ${migrationPath}`);
  console.log('');
  console.log('─'.repeat(60));
  console.log('');
  console.log('💡 QUICK COPY (paste this into SQL Editor):');
  console.log('');
  console.log(migrationSQL);
  console.log('');
  console.log('─'.repeat(60));
  console.log('');
  console.log('After applying the migration, run:');
  console.log('   node scripts/cleanup-dead-wood.js           # Test dry run');
  console.log('   node scripts/cleanup-dead-wood.js --execute # Archive stagnant startups');
  console.log('');
}

applyMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
