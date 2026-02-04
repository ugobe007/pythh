#!/usr/bin/env node
/**
 * Add alternative RSS sources for startup/VC news
 * These are high-quality, scraper-friendly sources
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Alternative sources that don't block scrapers
const ALTERNATIVE_SOURCES = [
  // Google News RSS - aggregates from many sources
  { name: "Google News - Startups", url: "https://news.google.com/rss/search?q=startup+funding&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  { name: "Google News - VC Funding", url: "https://news.google.com/rss/search?q=venture+capital+funding&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  { name: "Google News - Series A", url: "https://news.google.com/rss/search?q=series+A+funding&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  { name: "Google News - YC Startups", url: "https://news.google.com/rss/search?q=Y+Combinator+startup&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  { name: "Google News - AI Startups", url: "https://news.google.com/rss/search?q=AI+startup+funding&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  { name: "Google News - Fintech", url: "https://news.google.com/rss/search?q=fintech+startup+funding&hl=en-US&gl=US&ceid=US:en", category: "aggregator" },
  
  // Reddit RSS - startup communities
  { name: "Reddit Startups", url: "https://www.reddit.com/r/startups/.rss", category: "community" },
  { name: "Reddit Entrepreneur", url: "https://www.reddit.com/r/Entrepreneur/.rss", category: "community" },
  { name: "Reddit SaaS", url: "https://www.reddit.com/r/SaaS/.rss", category: "community" },
  { name: "Reddit Venture Capital", url: "https://www.reddit.com/r/venturecapital/.rss", category: "community" },
  
  // Hacker News alternatives
  { name: "Lobsters", url: "https://lobste.rs/rss", category: "tech_news" },
  
  // Academic/Research
  { name: "MIT Tech Review", url: "https://www.technologyreview.com/feed/", category: "tech_news" },
  
  // Verified working startup news
  { name: "Startups.com Blog", url: "https://www.startups.com/library/rss", category: "startup_news" },
  { name: "EU-Startups", url: "https://www.eu-startups.com/feed/", category: "startup_news" },
  { name: "Tech.eu", url: "https://tech.eu/feed/", category: "startup_news" },
  { name: "Silicon Republic", url: "https://www.siliconrepublic.com/feed", category: "startup_news" },
  { name: "TechNode", url: "https://technode.com/feed/", category: "startup_news" },
  { name: "e27", url: "https://e27.co/feed/", category: "startup_news" },
  { name: "ArcticStartup", url: "https://arcticstartup.com/feed/", category: "startup_news" },
  { name: "Startupbeat", url: "https://startupbeat.com/feed/", category: "startup_news" },
  
  // VC-focused that work
  { name: "CB Insights Blog", url: "https://www.cbinsights.com/research/feed/", category: "vc_research" },
  { name: "PitchBook News", url: "https://pitchbook.com/news/rss", category: "vc_research" },
  
  // Tech news that covers funding
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "tech_news" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "tech_news" },
  { name: "VentureBeat", url: "https://venturebeat.com/feed/", category: "tech_news" },
  { name: "ZDNet", url: "https://www.zdnet.com/news/rss.xml", category: "tech_news" },
  { name: "GeekWire", url: "https://www.geekwire.com/feed/", category: "tech_news" },
  { name: "TechRepublic", url: "https://www.techrepublic.com/rssfeeds/articles/", category: "tech_news" },
];

async function addSources() {
  console.log('Adding alternative RSS sources...\n');
  
  let added = 0;
  let skipped = 0;
  
  for (const source of ALTERNATIVE_SOURCES) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('rss_sources')
      .select('id')
      .eq('url', source.url)
      .single();
    
    if (existing) {
      console.log(`⏭️  ${source.name} (already exists)`);
      skipped++;
      continue;
    }
    
    // Insert new source
    const { error } = await supabase
      .from('rss_sources')
      .insert({
        name: source.name,
        url: source.url,
        category: source.category,
        active: true,
      });
    
    if (error) {
      console.log(`❌ ${source.name}: ${error.message}`);
    } else {
      console.log(`✅ ${source.name}`);
      added++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Added: ${added}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total alternative sources: ${ALTERNATIVE_SOURCES.length}`);
}

addSources().catch(console.error);
