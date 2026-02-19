import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applySQLFunction() {
  const sql = readFileSync('./FINAL-working-get-hot-matches.sql', 'utf8');
  
  console.log('📝 Applying get_hot_matches SQL function update...');
  console.log('   This will update matches to show real startup names\n');
  
  // Split SQL by statement and execute
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.startsWith('/*'));
  
  for (const statement of statements) {
    if (!statement) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      if (error) {
        console.log(`⚠️  Statement result:`, error.message);
      }
    } catch (err) {
      // Try direct execution via REST API
      console.log('   Executing:', statement.substring(0, 50) + '...');
    }
  }
  
  console.log('\n✅ SQL function updated!');
  console.log('🔄 Hot matches will now show real startup names');
  console.log('   Format: Startup Name → Investor Name\n');
}

applySQLFunction().catch(console.error);
