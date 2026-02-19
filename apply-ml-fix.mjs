/**
 * Apply fix-ml-recommendations.sql migration
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = readFileSync('./fix-ml-recommendations.sql', 'utf-8');

console.log('🔧 Applying ML recommendations fix...\n');
console.log(sql);
console.log('\n');

// Execute SQL
const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

if (error) {
  console.error('❌ Error:', error);
  
  // Try direct approach - add columns one by one
  console.log('\n🔄 Trying alternative approach...');
  
  const queries = [
    "ALTER TABLE ml_recommendations ADD COLUMN IF NOT EXISTS applied_at timestamptz",
    "ALTER TABLE ml_recommendations ADD COLUMN IF NOT EXISTS applied_by text",
    "ALTER TABLE ml_recommendations DROP CONSTRAINT IF EXISTS ml_recommendations_status_check",
    "ALTER TABLE ml_recommendations ADD CONSTRAINT ml_recommendations_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'applied'))"
  ];
  
  for (const query of queries) {
    console.log('Executing:', query);
    const { error: qError } = await supabase.rpc('exec_sql', { sql_query: query });
    if (qError) {
      console.error('❌', qError.message);
    } else {
      console.log('✅ Success');
    }
  }
} else {
  console.log('✅ Migration applied successfully!');
}

console.log('\n✅ Done! ML recommendations table should now have applied_at and applied_by columns.');
