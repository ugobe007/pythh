#!/usr/bin/env node
/**
 * DEACTIVATE BROKEN RSS FEEDS
 * ===========================
 * Deactivates RSS feeds that are consistently returning errors.
 * 
 * Usage:
 *   node scripts/deactivate-broken-feeds.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Feeds known to be broken (404, 403, 401, parsing errors)
const BROKEN_FEEDS = [
  // 404 errors
  'https://www.gv.com/feed/',
  'https://techcrunch.com/category/health/feed/',
  'https://techcrunch.com/category/energy/feed/',
  'https://www.thetwentyminutevc.com/feed/',
  'https://www.bloomberg.com/feed/podcast/bloomberg-technology',
  'https://www.bvp.com/atlas/rss.xml',
  'https://www.indexventures.com/feed/',
  'https://benchmark.com/feed/',
  'https://www.nea.com/insights/feed',
  'https://www.saascapital.com/blog/feed/',
  'https://www.techstars.com/blog/feed',
  'https://www.accel.com/insights/feed',
  // fastcompany /technology/rss — fixed in migration → /latest/rss
  'https://www.inc.com/rss/index.rss',
  'https://www.businessinsider.com/sai/rss',
  
  // 403 errors
  'https://www.fintechfutures.com/feed/',
  
  // 401 errors
  'https://www.reuters.com/technology',
  
  // Parsing errors
  'https://www.indiehackers.com/feed',
  'https://blog.angel.co/feed/',
  'https://www.deeplearning.ai/the-batch/',
  'https://500.co/blog/feed/',
  'https://www.cbinsights.com/feed',
  'https://www.startupheretoronto.com/feed/',
  'https://www.fiercebiotech.com/rss/xml',
];

async function deactivateBrokenFeeds() {
  console.log('🔧 Deactivating Broken RSS Feeds...\n');
  
  let deactivated = 0;
  let notFound = 0;
  
  for (const feedUrl of BROKEN_FEEDS) {
    try {
      const { data, error } = await supabase
        .from('rss_sources')
        .update({ active: false })
        .eq('url', feedUrl)
        .select();
      
      if (error) {
        console.error(`   ❌ Error deactivating ${feedUrl}: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`   ✅ Deactivated: ${data[0].name}`);
        deactivated++;
      } else {
        notFound++;
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${feedUrl}: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Deactivated: ${deactivated} broken feed(s)`);
  console.log(`   ⏭️  Not found: ${notFound} (already inactive or don't exist)`);
  console.log();
}

deactivateBrokenFeeds()
  .then(() => {
    console.log('✅ Cleanup complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

