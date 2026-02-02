const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // Check total matches
  const { data: matches, error, count } = await supabase
    .from('startup_investor_matches')
    .select('match_score, startup_id, investor_id', { count: 'exact' })
    .limit(5);

  console.log('=== MATCH DATA CHECK ===');
  console.log('Total matches in DB:', count);
  console.log('Fetched:', matches?.length || 0);
  
  if (matches && matches.length > 0) {
    console.log('\nSample match:');
    console.log(JSON.stringify(matches[0], null, 2));
    
    // Check if investor exists
    const { data: investor, error: invError } = await supabase
      .from('investors')
      .select('id, name, firm')
      .eq('id', matches[0].investor_id)
      .single();
    
    console.log('\nInvestor lookup:');
    console.log(investor ? JSON.stringify(investor, null, 2) : 'NOT FOUND');
    if (invError) console.log('Investor error:', invError);
    
    // Now try with investor join (without !inner)
    const { data: withInvestor, error: joinError } = await supabase
      .from('startup_investor_matches')
      .select('match_score, investor:investors(id, name, firm)')
      .eq('startup_id', matches[0].startup_id)
      .limit(1)
      .single();
    
    console.log('\nWith investor join:');
    console.log(withInvestor ? JSON.stringify(withInvestor, null, 2) : 'NULL');
    if (joinError) console.log('Join error:', joinError);
  }
  
  if (error) {
    console.error('Error:', error);
  }
})();
