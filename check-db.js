require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('DATABASE CHECK:\n');
  
  const t = await s.from('startup_investor_matches').select('*', {count: 'exact', head: true});
  console.log('Total matches:', t.count);
  
  const sugg = await s.from('startup_investor_matches').select('*', {count: 'exact', head: true}).eq('status', 'suggested');
  console.log('Status=suggested:', sugg.count);
  
  const high = await s.from('startup_investor_matches').select('*', {count: 'exact', head: true}).gte('match_score', 20);
  console.log('Score >= 20:', high.count);
  
  const both = await s.from('startup_investor_matches').select('*', {count: 'exact', head: true}).eq('status', 'suggested').gte('match_score', 20);
  console.log('BOTH conditions:', both.count);
  
  if (both.count === 0) {
    console.log('\n❌ NO MATCHES with status=suggested AND score>=20');
    console.log('Fix: Run this SQL in Supabase:');
    console.log("UPDATE startup_investor_matches SET status = 'suggested' WHERE match_score >= 20 LIMIT 1000;");
  } else {
    console.log('\n✅ Database has', both.count, 'matching records');
  }
})();
