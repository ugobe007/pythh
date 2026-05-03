#!/usr/bin/env node
/**
 * ADD RSS SOURCES
 * Adds comprehensive RSS feeds for startup/VC news discovery
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Comprehensive RSS feed list
const RSS_FEEDS = [
  // Tech News (Startup Funding)
  { name: 'TechCrunch - Startups', url: 'https://techcrunch.com/category/startups/feed/', category: 'tech_news' },
  { name: 'TechCrunch - Venture', url: 'https://techcrunch.com/category/venture/feed/', category: 'funding_news' },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: 'tech_news' },
  { name: 'The Information', url: 'https://www.theinformation.com/feed', category: 'tech_news' },
  { name: 'Axios Pro Rata', url: 'https://www.axios.com/feeds/feed.rss', category: 'funding_news' },
  
  // Startup/VC Focused
  { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', category: 'funding_news' },
  { name: 'PitchBook News', url: 'https://pitchbook.com/news/rss', category: 'funding_news' },
  { name: 'Fortune Term Sheet', url: 'https://fortune.com/section/term-sheet/feed/', category: 'funding_news' },
  { name: 'CB Insights', url: 'https://www.cbinsights.com/research/feed/', category: 'research' },
  
  // VC Blogs
  { name: 'a16z Blog', url: 'https://a16z.com/feed/', category: 'vc_blog' },
  { name: 'First Round Review', url: 'https://review.firstround.com/feed.xml', category: 'vc_blog' },
  { name: 'Sequoia Arc', url: 'https://www.sequoiacap.com/feed/', category: 'vc_blog' },
  { name: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss/', category: 'vc_blog' },
  { name: 'Union Square Ventures', url: 'https://www.usv.com/feed/', category: 'vc_blog' },
  { name: 'Bessemer Blog', url: 'https://www.bvp.com/atlas/feed', category: 'vc_blog' },
  { name: 'Greylock', url: 'https://greylock.com/feed/', category: 'vc_blog' },
  
  // Founder Resources
  { name: 'Paul Graham Essays', url: 'http://www.aaronsw.com/2002/feeds/pgessays.rss', category: 'founder_resource' },
  { name: 'Sam Altman Blog', url: 'https://blog.samaltman.com/feed', category: 'founder_resource' },
  
  // Product Discovery
  { name: 'Product Hunt Daily', url: 'https://www.producthunt.com/feed', category: 'product_launch' },
  { name: 'Hacker News Best', url: 'https://hnrss.org/best', category: 'tech_news' },
  { name: 'Hacker News Show HN', url: 'https://hnrss.org/show', category: 'product_launch' },
  
  // Industry Specific
  { name: 'AI News - VentureBeat', url: 'https://venturebeat.com/category/ai/feed/', category: 'tech_news' },
  { name: 'Fintech - TechCrunch', url: 'https://techcrunch.com/tag/fintech/feed/', category: 'tech_news' },
  { name: 'Healthcare - Rock Health', url: 'https://rockhealth.com/feed/', category: 'research' },
  { name: 'Climate Tech - CTVC', url: 'https://www.ctvc.co/feed/', category: 'research' },
  
  // Newsletters/Aggregators
  { name: 'StrictlyVC', url: 'https://www.strictlyvc.com/feed/', category: 'newsletter' },
  { name: 'Mattermark Daily', url: 'https://mattermark.com/feed/', category: 'newsletter' },
  { name: 'This Week in Startups', url: 'https://feeds.megaphone.fm/thisweekinstartups', category: 'podcast' },
];

async function main() {
  console.log('\n📡 Adding RSS Feed Sources\n');
  console.log('═'.repeat(60));
  
  let added = 0;
  let existed = 0;
  let errors = 0;
  
  for (const feed of RSS_FEEDS) {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from('rss_sources')
        .select('id')
        .eq('url', feed.url)
        .limit(1);
      
      if (existing && existing.length > 0) {
        process.stdout.write('⏭️ ');
        existed++;
        continue;
      }
      
      // Insert new
      const { error } = await supabase
        .from('rss_sources')
        .insert({
          name: feed.name,
          url: feed.url,
          category: feed.category,
          active: true,
          last_scraped: null
        });
      
      if (error) {
        process.stdout.write('❌ ');
        errors++;
      } else {
        process.stdout.write('✅ ');
        added++;
      }
    } catch (e) {
      process.stdout.write('❌ ');
      errors++;
    }
  }
  
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 RSS SOURCES SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Existed: ${existed}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('═'.repeat(60));
  
  // Show total
  const { count } = await supabase
    .from('rss_sources')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📡 Total RSS sources: ${count}`);
  console.log('\n💡 Run the RSS scraper to fetch articles:');
  console.log('   node run-rss-scraper-enhanced.js\n');
}

main();
