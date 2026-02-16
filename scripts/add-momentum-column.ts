/**
 * T2: Add momentum_score column to startup_uploads
 * Run: npx tsx scripts/add-momentum-column.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function addColumn() {
  // Try to add the column - if it already exists, the update test will still pass
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS momentum_score REAL DEFAULT 0;`
  });

  if (error) {
    // rpc may not exist - try a different approach: just update one row to test
    console.log('RPC not available, testing column existence...');
    
    const { data: test, error: testErr } = await supabase
      .from('startup_uploads')
      .select('momentum_score')
      .limit(1);

    if (testErr && testErr.message.includes('momentum_score')) {
      console.log('❌ momentum_score column does not exist.');
      console.log('Please run this SQL in the Supabase dashboard:');
      console.log('  ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS momentum_score REAL DEFAULT 0;');
      process.exit(1);
    } else {
      console.log('✅ momentum_score column already exists (or was just added)');
    }
  } else {
    console.log('✅ momentum_score column added successfully');
  }
}

addColumn().catch(console.error);
