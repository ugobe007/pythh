require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkMatches() {
  console.log('🔍 Testing startup_investor_matches table...\n');
  
  try {
    // Try a simple limit query first (no count)
    console.log('1. Simple select (10 rows)...');
    const start1 = Date.now();
    const { data: sample1, error: error1 } = await supabase
      .from('startup_investor_matches')
      .select('id, match_score')
      .limit(10);
    console.log('   Time:', Date.now() - start1, 'ms');
    
    if (error1) {
      console.log('   ❌ Error:', error1.message);
      console.log('   Code:', error1.code);
      console.log('   Details:', error1.details);
    } else {
      console.log('   ✅ Retrieved', sample1.length, 'rows');
    }
    
    // Try count with small timeout
    console.log('\n2. Count query (with timeout)...');
    const start2 = Date.now();
    const { count, error: error2 } = await Promise.race([
      supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 10s')), 10000)
      )
    ]);
    console.log('   Time:', Date.now() - start2, 'ms');
    
    if (error2) {
      console.log('   ❌ Error:', error2.message);
    } else {
      console.log('   ✅ Total matches:', count.toLocaleString());
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMatches();
