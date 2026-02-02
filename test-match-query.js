const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🔍 Testing match query for tryscott.ai startup...\n');
  
  const startupId = 'b2a6f151-f7cc-4f1e-8942-898246b82e44';
  
  // Test 1: Count matches
  const { count, error: countError } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId)
    .eq('status', 'suggested');
    
  console.log('Match count:', count, countError ? `(Error: ${countError.message})` : '');
  
  // Test 2: Query without relationship (raw data)
  const { data: rawData, error: rawError } = await supabase
    .from('startup_investor_matches')
    .select('investor_id, match_score, status')
    .eq('startup_id', startupId)
    .eq('status', 'suggested')
    .gte('match_score', 20)
    .order('match_score', { ascending: false })
    .limit(3);
    
  if (rawError) {
    console.log('\n❌ Raw query error:', rawError);
  } else {
    console.log('\n✅ Raw matches:', rawData?.length || 0);
    if (rawData?.[0]) {
      console.log('Sample:', rawData[0]);
    }
  }
  
  // Test 3: Query WITH relationship using explicit FK name
  const { data: joinedData, error: joinError } = await supabase
    .from('startup_investor_matches')
    .select(`
      investor_id,
      match_score,
      reasoning,
      status,
      investors!startup_investor_matches_investor_id_fkey (
        id,
        name,
        firm,
        sectors,
        stage,
        check_size_min,
        check_size_max
      )
    `)
    .eq('startup_id', startupId)
    .eq('status', 'suggested')
    .gte('match_score', 20)
    .order('match_score', { ascending: false })
    .limit(3);
    
  if (joinError) {
    console.log('\n❌ Joined query error:', joinError);
    
    // Test 4: Try alternate syntax
    console.log('\n🔄 Trying alternate syntax...');
    const { data: alt, error: altError } = await supabase
      .from('startup_investor_matches')
      .select(`
        *,
        investors (*)
      `)
      .eq('startup_id', startupId)
      .eq('status', 'suggested')
      .gte('match_score', 20)
      .order('match_score', { ascending: false })
      .limit(3);
      
    if (altError) {
      console.log('❌ Alternate syntax also failed:', altError);
    } else {
      console.log('✅ Alternate syntax worked! Found:', alt?.length || 0);
      if (alt?.[0]) {
        console.log('Sample:', {
          investor_id: alt[0].investor_id,
          match_score: alt[0].match_score,
          investor_name: alt[0].investors?.name
        });
      }
    }
  } else {
    console.log('\n✅ Joined query worked! Found:', joinedData?.length || 0);
    if (joinedData?.[0]) {
      console.log('Sample:', {
        investor_id: joinedData[0].investor_id,
        match_score: joinedData[0].match_score,
        investor_name: joinedData[0].investors?.name
      });
    }
  }
})();
