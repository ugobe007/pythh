require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🔍 Testing match availability...\n');
  
  const { count, error } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .gte('match_score', 20);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Found ${count} matches with score >= 20`);
    
    if (count === 0) {
      console.log('\n⚠️  NO MATCHES - Run: node match-regenerator.js');
    } else {
      console.log('✅ Database OK - Frontend should load matches');
    }
  }
})();
