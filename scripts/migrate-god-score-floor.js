/**
 * Migration: Lower GOD score DB floor from 40 to 30
 * 
 * Rationale: The VC rubric says low-quality startups score 30-48.
 * An artificial floor at 40 crushes differentiation — 93% of startups
 * were piling at exactly 40. Approved startups are human-vetted so
 * a floor of 30 is the appropriate minimum.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
  console.log('Checking for existing god score floor constraint...');

  // Check for existing constraint
  const { data: constraints, error: checkErr } = await sb.rpc('exec_sql', {
    sql: `
      SELECT c.conname, pg_get_constraintdef(c.oid) as def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'startup_uploads'
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%40%';
    `
  });

  if (checkErr) {
    console.log('Cannot query via RPC, trying direct approach...');
  } else {
    console.log('Existing constraints:', JSON.stringify(constraints, null, 2));
  }

  // Try to drop old constraint and add new one
  // The constraint was added in cleanup Dec 19, 2025
  const migrations = [
    // Try known constraint names
    `ALTER TABLE startup_uploads DROP CONSTRAINT IF EXISTS startup_uploads_total_god_score_check;`,
    `ALTER TABLE startup_uploads DROP CONSTRAINT IF EXISTS total_god_score_minimum;`,
    `ALTER TABLE startup_uploads DROP CONSTRAINT IF EXISTS god_score_minimum_40;`,
    `ALTER TABLE startup_uploads DROP CONSTRAINT IF EXISTS chk_god_score_minimum;`,
    // Add new constraint at 30
    `ALTER TABLE startup_uploads ADD CONSTRAINT startup_uploads_god_score_floor CHECK (total_god_score IS NULL OR total_god_score >= 30);`,
    // Also update any existing scores at exactly 40 that should be lower
    // (They'll get accurate scores on next recalculation — don't bulk change now)
  ];

  for (const sql of migrations) {
    console.log('\nRunning:', sql.substring(0, 80));
    const { error } = await sb.rpc('exec_sql', { sql });
    if (error) {
      console.log('  via exec_sql failed:', error.message);
      // Try raw query approach - some Supabase setups expose query directly
      const { error: err2 } = await sb.rpc('run_sql', { query: sql });
      if (err2) {
        console.log('  via run_sql failed:', err2.message);
      } else {
        console.log('  ✓ via run_sql OK');
      }
    } else {
      console.log('  ✓ OK');
    }
  }

  console.log('\nDone. If DROP CONSTRAINT failed, run the SQL directly in Supabase Dashboard > SQL Editor:');
  console.log('---');
  console.log('-- Step 1: Find the constraint name');
  console.log("SELECT c.conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'startup_uploads' AND c.contype = 'c';");
  console.log('-- Step 2: Drop old constraint (replace CONSTRAINT_NAME)');
  console.log('ALTER TABLE startup_uploads DROP CONSTRAINT CONSTRAINT_NAME;');
  console.log('-- Step 3: Add new constraint');
  console.log('ALTER TABLE startup_uploads ADD CONSTRAINT startup_uploads_god_score_floor CHECK (total_god_score IS NULL OR total_god_score >= 30);');
  console.log('---');
}

run();
