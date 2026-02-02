const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  console.log('🎯 Testing Instant Match API\n');
  
  // Use spatial-ai which we know exists
  const startupId = '697d7775-8c3c-43a9-9b3b-927cf99d88cb';
  
  const start = Date.now();
  const res = await fetch('http://localhost:3002/api/matches/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startupId, priority: 'test' })
  });
  
  const result = await res.json();
  const time = Date.now() - start;
  
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log(`\nTime: ${time}ms`);
  console.log(time < 3000 ? '✅ PASS (under 3 seconds)' : '⚠️  SLOW');
  
  // Check matches in DB
  const { data } = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .eq('startup_id', startupId)
    .order('match_score', { ascending: false })
    .limit(5);
  
  console.log(`\nTop 5 match scores: ${data.map(m => m.match_score).join(', ')}`);
  console.log(`Total matches: ${data.length === 5 ? '5+' : data.length}\n`);
  console.log('✅ TEST COMPLETE');
})();
