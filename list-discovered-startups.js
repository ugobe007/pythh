#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, created_at, discovery_event_id')
    .not('discovery_event_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.log('❌ Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No startups found with discovery_event_id');
    return;
  }
  
  console.log('\n🎯 ' + data.length + ' STARTUPS DISCOVERED VIA SSOT SCRAPER:\n');
  data.forEach((s, i) => {
    const date = new Date(s.created_at).toLocaleString();
    console.log(`${i+1}. ${s.name} (${date})`);
  });
  
  // Also check how many have graph_safe=true but no join
  const { count: graphSafeCount } = await supabase
    .from('startup_events')
    .select('*', { count: 'exact', head: true })
    .eq('extraction_meta->>graph_safe', 'true');
  
  console.log(`\n📊 Stats:`);
  console.log(`   - Events with graph_safe=true: ${graphSafeCount}`);
  console.log(`   - Graph joins created: ${data.length}`);
  console.log(`   - Conversion rate: ${((data.length/graphSafeCount)*100).toFixed(1)}%`);
})();
