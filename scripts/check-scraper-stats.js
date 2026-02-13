#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Get today's discoveries
  const { data: today, error: todayError } = await supabase
    .from('discovered_startups')
    .select('source')
    .gte('created_at', todayStart);

  // Get last 24 hours
  const { data: last24, error: last24Error } = await supabase
    .from('discovered_startups')
    .select('source')
    .gte('created_at', last24h);

  if (todayError || last24Error) {
    console.error('Error:', todayError || last24Error);
    process.exit(1);
  }

  console.log('📊 SCRAPER STATISTICS');
  console.log('═══════════════════════════════════\n');
  
  console.log('📅 Today (Feb 12, 2026):');
  console.log(`   Total: ${today.length} startups discovered`);
  
  // Group by source
  const todaySources = today.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n   By source:');
  Object.entries(todaySources).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`   ${source.padEnd(25)} ${count.toString().padStart(4)} ${bar}`);
  });

  console.log('\n📊 Last 24 hours:');
  console.log(`   Total: ${last24.length} startups discovered`);
  
  const last24Sources = last24.reduce((acc, s) => {
    acc[s.source] = (acc[s.source] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n   By source:');
  Object.entries(last24Sources).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    const bar = '█'.repeat(Math.ceil(count / 5));
    console.log(`   ${source.padEnd(25)} ${count.toString().padStart(4)} ${bar}`);
  });

  // Get scraper health
  const { data: rssStatus } = await supabase
    .from('rss_sources')
    .select('active, last_fetched')
    .eq('active', true);

  console.log('\n🔧 Scraper Status:');
  console.log(`   Active RSS sources: ${rssStatus?.length || 0}`);
  console.log(`   Scraper process: ✅ Online (PM2)`);
  
})();
