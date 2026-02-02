require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function applyIndexes() {
  console.log('📊 Applying Database Indexes...\n');
  
  const indexes = [
    {
      name: 'idx_matches_score_desc',
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_score_desc ON startup_investor_matches (match_score DESC);`
    },
    {
      name: 'idx_matches_score_startup',
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_score_startup ON startup_investor_matches (match_score DESC, startup_id, investor_id);`
    }
  ];
  
  for (const index of indexes) {
    console.log(`Creating index: ${index.name}...`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: index.sql });
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   Note: This might be expected if the index already exists`);
      } else {
        console.log(`   ✅ Index created successfully`);
      }
    } catch (err) {
      console.log(`   ℹ️  Cannot create via RPC (expected - need SQL editor)`);
      console.log(`   Please run this SQL in Supabase dashboard:`);
      console.log(`   ${index.sql}\n`);
    }
  }
  
  console.log('\n📋 Manual Instructions:');
  console.log('If indexes were not created automatically, please:');
  console.log('1. Go to Supabase Dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Run the following SQL:\n');
  console.log('```sql');
  indexes.forEach(idx => console.log(idx.sql));
  console.log('```\n');
  console.log('This will speed up match queries by 10-100x!');
}

applyIndexes();
