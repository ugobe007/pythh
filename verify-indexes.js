require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function verifyIndexes() {
  console.log('🔍 Verifying Database Indexes...\n');
  
  try {
    // Test 1: High-score query (should use idx_matches_score_desc)
    console.log('1️⃣  Testing high-score match query (uses index)...');
    const start1 = Date.now();
    const { data: highScores, error: error1 } = await supabase
      .from('startup_investor_matches')
      .select(`
        id,
        match_score,
        startup_uploads!inner(name, total_god_score),
        investors!inner(name)
      `)
      .gte('match_score', 75)
      .order('match_score', { ascending: false })
      .limit(10);
    const time1 = Date.now() - start1;
    
    if (error1) {
      console.log('   ❌ Error:', error1.message);
    } else {
      console.log(`   ✅ Retrieved ${highScores.length} matches in ${time1}ms`);
      console.log('   Top 3 matches:');
      highScores.slice(0, 3).forEach((m, i) => {
        console.log(`   ${i+1}. ${m.startup_uploads.name} → ${m.investors.name} (${m.match_score})`);
      });
    }
    
    // Test 2: Count with short timeout
    console.log('\n2️⃣  Testing COUNT query (faster with index)...');
    const start2 = Date.now();
    const { count, error: error2 } = await Promise.race([
      supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true }),
      new Promise((resolve, reject) => 
        setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
      )
    ]);
    const time2 = Date.now() - start2;
    
    if (error2) {
      console.log(`   ⚠️  Still timing out (${time2}ms): ${error2.message}`);
      console.log('   Note: COUNT on 4M+ rows may still be slow initially');
    } else {
      console.log(`   ✅ Total matches: ${count.toLocaleString()} (counted in ${time2}ms)`);
    }
    
    // Test 3: Filtered count (should be faster)
    console.log('\n3️⃣  Testing filtered COUNT (high-quality matches)...');
    const start3 = Date.now();
    const { count: filteredCount, error: error3 } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .gte('match_score', 70);
    const time3 = Date.now() - start3;
    
    if (error3) {
      console.log('   ❌ Error:', error3.message);
    } else {
      console.log(`   ✅ High-quality matches: ${filteredCount?.toLocaleString() || 'N/A'} (${time3}ms)`);
    }
    
    console.log('\n📊 Performance Summary:');
    console.log('   • High-score query:', time1 + 'ms', time1 < 500 ? '✅ FAST' : '⚠️ SLOW');
    console.log('   • Filtered count:', time3 + 'ms', time3 < 2000 ? '✅ FAST' : '⚠️ SLOW');
    
    if (time1 < 500 && time3 < 2000) {
      console.log('\n🎉 Indexes are working! Database is optimized.');
      console.log('   Ready to build Signals page table component.');
    } else {
      console.log('\n⏳ Indexes may still be building in background.');
      console.log('   Large indexes can take 5-10 minutes on 4M+ rows.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyIndexes();
