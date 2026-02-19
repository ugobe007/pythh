#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkScraperHealth() {
  console.log('\n🔍 SCRAPER HEALTH CHECK\n');
  console.log('='.repeat(60));
  
  try {
    // Total counts by import status
    const { count: totalCount } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true });
    
    const { count: pendingCount } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .eq('imported_to_startups', false);
    
    const { count: importedCount } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .eq('imported_to_startups', true);
    
    console.log('📊 DISCOVERY PIPELINE:');
    console.log(`   Total Discovered: ${totalCount}`);
    console.log(`   ⏳ Pending Import: ${pendingCount}`);
    console.log(`   ✅ Imported: ${importedCount}`);
    
    // Recent activity (last 24h)
    const oneDayAgo = new Date(Date.now() - 24*60*60*1000).toISOString();
    const { data: recent, count: recentCount } = await supabase
      .from('discovered_startups')
      .select('name, rss_source, website, discovered_at', { count: 'exact' })
      .gte('discovered_at', oneDayAgo)
      .order('discovered_at', { ascending: false })
      .limit(10);
    
    console.log(`\n📅 LAST 24 HOURS: ${recentCount || 0} new discoveries`);
    
    if (recent && recent.length > 0) {
      console.log('\n   Most Recent:');
      recent.slice(0, 5).forEach(s => {
        const time = new Date(s.discovered_at).toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`   ${time} - ${s.name} from ${s.rss_source || 'unknown'}`);
      });
    } else {
      console.log('   ⚠️  No new discoveries in last 24h');
    }
    
    // Quality check - recent discoveries
    const { data: recentWithInfo } = await supabase
      .from('discovered_startups')
      .select('id, name, website')
      .gte('discovered_at', oneDayAgo);
    
    if (recentWithInfo && recentWithInfo.length > 0) {
      console.log(`\n📈 DISCOVERY DETAILS:`);
      console.log(`   Total discovered in 24h: ${recentWithInfo.length}`);
      console.log(`   With website: ${recentWithInfo.filter(s => s.website).length}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Health check complete\n');
    
  } catch (error) {
    console.error('❌ Error checking scraper health:', error.message);
  }
}

checkScraperHealth();
