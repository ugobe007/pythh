require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkDatabase() {
  console.log('🔍 Checking Supabase Database Status...\n');
  
  try {
    // Check startup_uploads
    const { count: startupCount, error: startupError } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    if (startupError) throw new Error('Startups: ' + startupError.message);
    console.log('✅ startup_uploads:         ', startupCount, 'approved startups');
    
    // Check total startups
    const { count: totalStartups } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true });
    console.log('   (Total in table:        ', totalStartups, 'all statuses)');
    
    // Check investors
    const { count: investorCount, error: investorError } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    
    if (investorError) throw new Error('Investors: ' + investorError.message);
    console.log('✅ investors:              ', investorCount, 'investors');
    
    // Check matches
    const { count: matchCount, error: matchError } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    if (matchError) throw new Error('Matches: ' + matchError.message);
    console.log('✅ startup_investor_matches:', matchCount.toLocaleString(), 'matches');
    
    // Check high-quality matches
    const { count: highQualityCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .gte('match_score', 70);
    console.log('   (High quality >= 70:    ', highQualityCount.toLocaleString(), 'matches)');
    
    // Sample query to test responsiveness
    console.log('\n📊 Testing Query Performance...');
    const start = Date.now();
    const { data: sample, error: sampleError } = await supabase
      .from('startup_investor_matches')
      .select(`
        id, 
        match_score, 
        startup_id,
        investor_id,
        startup_uploads!inner(name, total_god_score),
        investors!inner(name)
      `)
      .gte('match_score', 75)
      .limit(5);
    const elapsed = Date.now() - start;
    
    if (sampleError) throw new Error('Sample query: ' + sampleError.message);
    console.log('   Query time:', elapsed + 'ms');
    console.log('   Sample matches:');
    sample.forEach((m, i) => {
      console.log(`   ${i+1}. ${m.startup_uploads.name} → ${m.investors.name} (Score: ${m.match_score})`);
    });
    
    console.log('\n🎉 Database is UP and responsive!');
    console.log('\n📈 Summary:');
    console.log('   • Match generation capacity:', (startupCount * investorCount).toLocaleString(), 'potential matches');
    console.log('   • Current match coverage:    ', ((matchCount / (startupCount * investorCount)) * 100).toFixed(1) + '%');
    
  } catch (error) {
    console.error('\n❌ Database Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   1. Check if Supabase upgrade is complete');
    console.error('   2. Verify .env file has correct credentials');
    console.error('   3. Check Supabase dashboard for service status');
    process.exit(1);
  }
}

checkDatabase();
