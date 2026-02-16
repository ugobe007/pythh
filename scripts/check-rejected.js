#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRejectedStartups() {
  console.log('\n🚨 CHECKING REJECTED STARTUPS FOR POTENTIAL GOOD ONES...\n');
  
  const { data: rejected, error } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, pitch, website, is_launched, team_size, mrr, customer_count, extracted_data')
    .eq('status', 'rejected')
    .order('total_god_score', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total rejected startups with scores shown: ${rejected.length}\n`);
  
  // Check for high-scoring rejected startups
  const highScorers = rejected.filter(st => st.total_god_score >= 50);
  
  if (highScorers.length > 0) {
    console.log(`🚨 ALERT: ${highScorers.length} rejected startups with scores >= 50!\n`);
    for (const st of highScorers.slice(0, 20)) {
      console.log(`${st.name}: ${st.total_god_score} pts`);
      console.log(`  Components: T:${st.team_score} Tr:${st.traction_score} M:${st.market_score} P:${st.product_score} V:${st.vision_score}`);
      console.log(`  Pitch: ${st.pitch ? 'YES (' + st.pitch.length + ' chars)' : 'NO'}`);
      console.log(`  Website: ${st.website || 'NO'}`);
      console.log(`  Launched: ${st.is_launched ? 'YES' : 'NO'}`);
      console.log(`  Team: ${st.team_size || 1}`);
      console.log(`  MRR: $${st.mrr || 0}`);
      console.log(`  Customers: ${st.customer_count || 0}`);
      console.log('');
    }
  } else {
    console.log('✅ No high-scoring startups (50+) in rejected list\n');
  }
  
  // Show top 20 rejected for inspection
  console.log('📋 TOP 20 REJECTED STARTUPS:\n');
  for (const st of rejected.slice(0, 20)) {
    const hasData = (st.pitch && st.pitch.length > 50) || 
                    (st.website && st.is_launched && st.team_size > 1) ||
                    st.mrr > 0 || st.customer_count > 0 ||
                    (st.extracted_data && Object.keys(st.extracted_data).length >= 5);
    
    console.log(`${st.name}: ${st.total_god_score} pts`);
    console.log(`  Pitch: ${st.pitch ? st.pitch.substring(0, 60) + '...' : 'NO'}`);
    console.log(`  Would pass NEW filter: ${hasData ? 'YES ✅' : 'NO ❌'}`);
    console.log('');
  }
}

checkRejectedStartups().catch(console.error);
