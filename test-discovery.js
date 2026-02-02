const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDiscovery(url) {
  console.log('=== TESTING DISCOVERY PAGE ===');
  console.log('URL:', url);
  
  // Step 1: Get a sample startup
  const { data: startup, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, website, total_god_score, sectors, stage')
    .eq('status', 'approved')
    .not('website', 'is', null)
    .limit(1)
    .single();
  
  if (startupError) {
    console.error('Startup error:', startupError);
    return;
  }
  
  console.log('\n✅ Sample startup found:');
  console.log('  ID:', startup.id);
  console.log('  Name:', startup.name);
  console.log('  GOD Score:', startup.total_god_score);
  console.log('  Sectors:', startup.sectors);
  console.log('  Stage:', startup.stage);
  
  // Step 2: Fetch matches for this startup
  const { data: matches, error: matchError } = await supabase
    .from('startup_investor_matches')
    .select('match_score, investor_id')
    .eq('startup_id', startup.id)
    .gte('match_score', 50)
    .order('match_score', { ascending: false })
    .limit(5);
  
  if (matchError) {
    console.error('Match error:', matchError);
    return;
  }
  
  console.log('\n✅ Matches found:', matches?.length || 0);
  
  if (matches && matches.length > 0) {
    // Step 3: Fetch investor details
    const investorIds = matches.map(m => m.investor_id);
    const { data: investors, error: invError } = await supabase
      .from('investors')
      .select('id, name, firm, sectors, stage, check_size_min, check_size_max, geography_focus')
      .in('id', investorIds);
    
    if (invError) {
      console.error('Investor error:', invError);
      return;
    }
    
    console.log('✅ Investors fetched:', investors?.length || 0);
    
    // Step 4: Join manually
    const joined = matches.map(match => ({
      match_score: match.match_score,
      investor: investors?.find(inv => inv.id === match.investor_id)
    })).filter(m => m.investor);
    
    console.log('\n✅ Joined results:', joined.length);
    
    // Display top 3
    console.log('\n=== TOP 3 MATCHES ===');
    joined.slice(0, 3).forEach((m, i) => {
      console.log(`\n#${i + 1} - Score: ${m.match_score}`);
      console.log(`  Name: ${m.investor.name}`);
      console.log(`  Firm: ${m.investor.firm || 'N/A'}`);
      console.log(`  Sectors: ${m.investor.sectors?.join(', ') || 'N/A'}`);
      console.log(`  Stage: ${m.investor.stage || 'N/A'}`);
    });
    
    console.log('\n✅ SUCCESS - Data pipeline working!');
    console.log(`\nTest URL: http://localhost:5173/discovery?url=${encodeURIComponent(startup.website || 'https://example.com')}`);
  } else {
    console.log('❌ No matches found for this startup');
  }
}

testDiscovery();
