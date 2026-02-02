#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  // Count events
  const { count: events } = await supabase
    .from('startup_events')
    .select('*', { count: 'exact', head: true });

  // Count graph joins (startups with discovery_event_id)
  const { count: graphJoins } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .not('discovery_event_id', 'is', null);

  // Get sample high-quality events
  const { data: sampleEvents } = await supabase
    .from('startup_events')
    .select('event_type, frame_confidence, subject, source_title, extraction_meta')
    .eq('extraction_meta->>graph_safe', 'true')
    .order('frame_confidence', { ascending: false })
    .limit(10);

  console.log('\n📊 SSOT SCRAPER RESULTS\n');
  console.log('✅ Events stored:', events);
  console.log('🎯 Graph joins (high-quality):', graphJoins || 0);
  console.log('📈 Quality rate:', graphJoins && events ? ((graphJoins/events)*100).toFixed(1) + '%' : '0%');
  
  console.log('\n🏆 SAMPLE HIGH-QUALITY EVENTS (graph_safe=true):\n');
  sampleEvents.forEach((e, i) => {
    console.log(`${i+1}. ${e.event_type} (conf: ${e.frame_confidence.toFixed(2)}) - ${e.subject}`);
    console.log(`   "${e.source_title.slice(0, 80)}..."`);
  });

  console.log('\n📊 BEFORE vs AFTER:');
  console.log('   BEFORE: 1589 items → 1 startup (0.06% - data loss crisis)');
  console.log(`   AFTER:  ${events} items → ${graphJoins || 0} startups (${graphJoins && events ? ((graphJoins/events)*100).toFixed(1) : '0'}% - quality filtering)`);
})();
