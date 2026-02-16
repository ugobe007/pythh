#!/usr/bin/env node
/**
 * Quick fix: deactivate remaining broken feeds after replacement attempts failed
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BROKEN_URLS = [
  'https://www.accel.com/noteworthy/rss.xml',
  'https://www.axios.com/technology/feed.rss',
  'https://betalist.com/markets/startup-tools.rss',
  'https://www.wired.co.uk/feed/category/business/latest/rss',
  'https://old.reddit.com/r/Entrepreneur/.rss',
  'https://old.reddit.com/r/SaaS/.rss',
  'https://old.reddit.com/r/startups/.rss',
  'https://old.reddit.com/r/venturecapital/.rss',
  'https://kr-asia.com/rss/feed.xml',
  'https://inside.com/ai/rss',
  'https://bothsidesofthetable.com/feed',
  'https://tomtunguz.com/feed/',
];

(async () => {
  let count = 0;
  for (const url of BROKEN_URLS) {
    const { data } = await supabase
      .from('rss_sources')
      .select('id, name, active')
      .eq('url', url)
      .single();
    
    if (data && data.active) {
      const { error } = await supabase
        .from('rss_sources')
        .update({ active: false })
        .eq('id', data.id);
      
      if (!error) {
        console.log(`✅ Deactivated: ${data.name} (${url})`);
        count++;
      } else {
        console.log(`❌ Error: ${data.name}: ${error.message}`);
      }
    } else if (data) {
      console.log(`⏭️  Already inactive: ${data.name}`);
    } else {
      console.log(`⏭️  Not found: ${url}`);
    }
  }
  console.log(`\nDone: ${count} feeds deactivated`);
  
  // Count remaining active feeds
  const { count: activeCount } = await supabase
    .from('rss_sources')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);
  console.log(`Active feeds remaining: ${activeCount}`);
})();
