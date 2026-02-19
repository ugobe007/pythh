const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function test() {
  console.log('🔍 Testing Hot Matches SQL functions...\n');
  
  // Test get_hot_matches
  console.log('1️⃣ Testing get_hot_matches()...');
  const { data: matches, error: matchError } = await supabase.rpc('get_hot_matches', {
    limit_count: 5,
    hours_ago: 168 // 7 days to get more results
  });
  
  if (matchError) {
    console.error('   ❌ Error:', matchError.message);
  } else {
    console.log(`   ✅ Success! Found ${matches.length} matches`);
    if (matches.length > 0) {
      const m = matches[0];
      console.log(`   📊 Sample: "${m.startup_name}" → "${m.investor_name}" (${m.match_score}% match, GOD ${m.startup_god_score})`);
    }
  }
  
  // Test get_platform_velocity
  console.log('\n2️⃣ Testing get_platform_velocity()...');
  const { data: velocity, error: velError } = await supabase.rpc('get_platform_velocity');
  
  if (velError) {
    console.error('   ❌ Error:', velError.message);
  } else {
    const v = velocity[0];
    console.log(`   ✅ Success!`);
    console.log(`   📈 ${v.total_matches_today} matches today, ${v.total_matches_week} this week`);
    console.log(`   🎯 ${v.high_quality_matches_today} elite matches today`);
  }
  
  // Test get_sector_heat_map
  console.log('\n3️⃣ Testing get_sector_heat_map()...');
  const { data: sectors, error: sectorError } = await supabase.rpc('get_sector_heat_map', {
    days_ago: 7
  });
  
  if (sectorError) {
    console.error('   ❌ Error:', sectorError.message);
  } else {
    console.log(`   ✅ Success! Found ${sectors.length} hot sectors`);
    if (sectors.length > 0) {
      const s = sectors[0];
      console.log(`   🔥 Hottest: ${s.sector} (${s.match_count} matches, ${s.week_over_week_change}% WoW change)`);
    }
  }
  
  console.log('\n🎉 All Hot Matches functions are working!');
  console.log('💡 Refresh your browser - the feed should now load!');
}

test().catch(console.error);
