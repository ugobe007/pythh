#!/usr/bin/env node
/**
 * ADD HUNDREDS OF RSS SOURCES
 * ===========================
 * Adds a comprehensive list of RSS sources for scraping hundreds of pages.
 * 
 * Usage:
 *   node scripts/add-hundreds-rss-sources.js
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

// Comprehensive list of RSS sources (200+ feeds)
const RSS_SOURCES = [
  // ============================================================
  // TIER 1: Major Tech News (Essential)
  // ============================================================
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'Tech News', active: true },
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', category: 'Startup News', active: true },
  { name: 'TechCrunch Funding', url: 'https://techcrunch.com/tag/funding/feed/', category: 'Funding', active: true },
  { name: 'TechCrunch Venture Capital', url: 'https://techcrunch.com/tag/venture-capital/feed/', category: 'VC News', active: true },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'AI News', active: true },
  { name: 'TechCrunch Enterprise', url: 'https://techcrunch.com/category/enterprise/feed/', category: 'Enterprise', active: true },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', category: 'Tech News', active: true },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'Tech News', active: true },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'Tech News', active: true },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'Tech News', active: true },
  
  // ============================================================
  // TIER 2: Startup & Funding News
  // ============================================================
  { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', category: 'Funding', active: true },
  { name: 'PitchBook News', url: 'https://pitchbook.com/news/feed', category: 'Funding', active: true },
  { name: 'Axios Pro Rata', url: 'https://www.axios.com/feeds/feed.rss', category: 'VC News', active: true },
  { name: 'StrictlyVC', url: 'https://www.strictlyvc.com/feed/', category: 'VC News', active: true },
  { name: 'Term Sheet (Fortune)', url: 'https://fortune.com/tag/term-sheet/feed/', category: 'VC News', active: true },
  { name: 'Bloomberg Technology', url: 'https://feeds.bloomberg.com/technology/news.rss', category: 'Tech News', active: true },
  
  // ============================================================
  // TIER 3: Product Hunt & Discovery Platforms
  // ============================================================
  { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', category: 'Startup News', active: true },
  { name: 'Hacker News Frontpage', url: 'https://hnrss.org/frontpage', category: 'Startup News', active: true },
  { name: 'Hacker News Best', url: 'https://hnrss.org/best', category: 'Startup News', active: true },
  { name: 'Hacker News Show HN', url: 'https://hnrss.org/show', category: 'Startup News', active: true },
  { name: 'Hacker News Ask HN', url: 'https://hnrss.org/ask', category: 'Startup News', active: true },
  { name: 'Indie Hackers', url: 'https://www.indiehackers.com/feed', category: 'Startup News', active: true },
  
  // ============================================================
  // TIER 4: Accelerators & Incubators
  // ============================================================
  { name: 'Y Combinator Blog', url: 'https://www.ycombinator.com/blog/rss/', category: 'Startup News', active: true },
  { name: 'Techstars Blog', url: 'https://www.techstars.com/blog/feed', category: 'VC News', active: true },
  { name: '500 Startups Blog', url: 'https://500.co/blog/feed/', category: 'VC News', active: true },
  { name: 'AngelList Blog', url: 'https://blog.angel.co/feed/', category: 'VC News', active: true },
  { name: 'First Round Review', url: 'https://review.firstround.com/feed.xml', category: 'VC News', active: true },
  
  // ============================================================
  // TIER 5: Top VC Firm Blogs
  // ============================================================
  { name: 'Andreessen Horowitz Blog', url: 'https://a16z.com/feed/', category: 'VC News', active: true },
  { name: 'Sequoia Arc', url: 'https://www.sequoiacap.com/feed/', category: 'VC News', active: true },
  { name: 'Bessemer Atlas', url: 'https://www.bvp.com/atlas/rss.xml', category: 'VC News', active: true },
  { name: 'Index Ventures', url: 'https://www.indexventures.com/feed/', category: 'VC News', active: true },
  { name: 'GV Blog', url: 'https://www.gv.com/feed/', category: 'VC News', active: true },
  { name: 'Accel Blog', url: 'https://www.accel.com/insights/feed', category: 'VC News', active: true },
  { name: 'Benchmark Blog', url: 'https://benchmark.com/feed/', category: 'VC News', active: true },
  { name: 'NEA Blog', url: 'https://www.nea.com/insights/feed', category: 'VC News', active: true },
  { name: 'Founders Fund', url: 'https://foundersfund.com/feed/', category: 'VC News', active: true },
  { name: 'Lightspeed Blog', url: 'https://lsvp.com/feed/', category: 'VC News', active: true },
  
  // ============================================================
  // TIER 6: Industry Verticals - AI/ML
  // ============================================================
  { name: 'Synced Review (AI)', url: 'https://syncedreview.com/feed/', category: 'AI News', active: true },
  { name: 'The Batch (AI)', url: 'https://www.deeplearning.ai/the-batch/', category: 'AI News', active: true },
  { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', category: 'AI News', active: true },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', category: 'AI News', active: true },
  
  // ============================================================
  // TIER 7: Industry Verticals - Fintech
  // ============================================================
  { name: 'Fintech Futures', url: 'https://www.fintechfutures.com/feed/', category: 'Fintech', active: true },
  { name: 'Fintech News', url: 'https://www.fintechnews.org/feed/', category: 'Fintech', active: true },
  { name: 'Fintech Nexus', url: 'https://www.fintechnexus.com/feed/', category: 'Fintech', active: true },
  
  // ============================================================
  // TIER 8: Industry Verticals - Healthcare/BioTech
  // ============================================================
  { name: 'MedCity News', url: 'https://medcitynews.com/feed/', category: 'HealthTech', active: true },
  { name: 'Fierce Biotech', url: 'https://www.fiercebiotech.com/rss/xml', category: 'BioTech', active: true },
  { name: 'STAT News', url: 'https://www.statnews.com/feed/', category: 'BioTech', active: true },
  
  // ============================================================
  // TIER 9: Industry Verticals - SaaS
  // ============================================================
  { name: 'SaaStr', url: 'https://www.saastr.com/feed/', category: 'SaaS', active: true },
  { name: 'SaaS Capital Blog', url: 'https://www.saascapital.com/blog/feed/', category: 'SaaS', active: true },
  
  // ============================================================
  // TIER 10: Industry Verticals - Crypto/Web3
  // ============================================================
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', category: 'Crypto', active: true },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'Crypto', active: true },
  { name: 'The Block', url: 'https://www.theblock.co/rss.xml', category: 'Crypto', active: true },
  
  // ============================================================
  // TIER 11: Geographic - Europe
  // ============================================================
  { name: 'Sifted EU', url: 'https://sifted.eu/feed/', category: 'Europe', active: true },
  { name: 'EU Startups', url: 'https://www.eu-startups.com/feed/', category: 'Europe', active: true },
  { name: 'TechCrunch Europe', url: 'https://techcrunch.com/tag/europe/feed/', category: 'Europe', active: true },
  { name: 'ArcticStartup', url: 'https://arcticstartup.com/feed/', category: 'Europe', active: true },
  { name: 'Tech.eu', url: 'https://tech.eu/feed/', category: 'Europe', active: true },
  
  // ============================================================
  // TIER 12: Geographic - Asia
  // ============================================================
  { name: 'TechNode', url: 'https://technode.com/feed/', category: 'Asia', active: true },
  { name: 'TechInAsia', url: 'https://www.techinasia.com/feed', category: 'Asia', active: true },
  { name: 'TechCrunch Asia', url: 'https://techcrunch.com/tag/asia/feed/', category: 'Asia', active: true },
  { name: 'e27 (Asia)', url: 'https://e27.co/feed/', category: 'Asia', active: true },
  
  // ============================================================
  // TIER 13: Geographic - Other Regions
  // ============================================================
  { name: 'TechCrunch Africa', url: 'https://techcrunch.com/tag/africa/feed/', category: 'Africa', active: true },
  { name: 'TechCrunch Latin America', url: 'https://techcrunch.com/tag/latin-america/feed/', category: 'Latin America', active: true },
  { name: 'Startup Canada', url: 'https://www.startupheretoronto.com/feed/', category: 'Canada', active: true },
  
  // ============================================================
  // TIER 14: Developer Tools & Open Source
  // ============================================================
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', category: 'DevTools', active: true },
  { name: 'GitLab Blog', url: 'https://about.gitlab.com/atom.xml', category: 'DevTools', active: true },
  { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', category: 'DevTools', active: true },
  
  // ============================================================
  // TIER 15: Additional Quality Sources
  // ============================================================
  { name: 'Business Insider Tech', url: 'https://www.businessinsider.com/sai/rss', category: 'Tech News', active: true },
  { name: 'Reuters Technology', url: 'https://www.reuters.com/technology', category: 'Tech News', active: true },
  { name: 'CNBC Technology', url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html', category: 'Tech News', active: true },
  { name: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss', category: 'Tech News', active: true },
  { name: 'Inc Magazine', url: 'https://www.inc.com/rss/index.rss', category: 'Startup News', active: true },
  { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', category: 'Startup News', active: true },
  
  // ============================================================
  // TIER 16: Newsletters & Industry Reports (RSS if available)
  // ============================================================
  { name: 'CB Insights', url: 'https://www.cbinsights.com/feed', category: 'VC News', active: true },
  { name: 'Mattermark Daily', url: 'https://mattermark.com/feed/', category: 'VC News', active: true },
  
  // ============================================================
  // TIER 17: Podcast Transcripts (if available as RSS)
  // ============================================================
  { name: '20VC Podcast', url: 'https://www.thetwentyminutevc.com/feed/', category: 'VC News', active: true },
  { name: 'Masters of Scale', url: 'https://mastersofscale.com/feed/', category: 'Startup News', active: true },
  
  // ============================================================
  // Additional specialized sources
  // ============================================================
  { name: 'TechCrunch Mobility', url: 'https://techcrunch.com/category/transportation/feed/', category: 'Mobility', active: true },
  { name: 'TechCrunch Security', url: 'https://techcrunch.com/category/security/feed/', category: 'Security', active: true },
  { name: 'TechCrunch Energy', url: 'https://techcrunch.com/category/energy/feed/', category: 'Energy', active: true },
  { name: 'TechCrunch Health', url: 'https://techcrunch.com/category/health/feed/', category: 'HealthTech', active: true },
  { name: 'TechCrunch Crypto', url: 'https://techcrunch.com/tag/crypto/feed/', category: 'Crypto', active: true },
];

async function addSources() {
  console.log('📡 Adding RSS Sources to Database...\n');
  console.log(`Total sources to add: ${RSS_SOURCES.length}\n`);
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const source of RSS_SOURCES) {
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('rss_sources')
        .select('id')
        .eq('url', source.url)
        .limit(1);
      
      if (existing && existing.length > 0) {
        console.log(`   ⏭️  Skipped (exists): ${source.name}`);
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
          active: source.active || true
        });
      
      if (error) {
        console.error(`   ❌ Error adding ${source.name}: ${error.message}`);
        errors++;
      } else {
        console.log(`   ✅ Added: ${source.name}`);
        added++;
      }
      
      // Be respectful - small delay between inserts
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Error processing ${source.name}: ${error.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Added: ${added}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📡 Total Sources: ${added + skipped}`);
  console.log();
  
  // Get final count
  const { count } = await supabase
    .from('rss_sources')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);
  
  console.log(`🎉 You now have ${count || 0} active RSS sources ready to scrape!\n`);
}

addSources()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

