#!/usr/bin/env node
/**
 * Add High-Value RSS Sources - Phase 1
 * 
 * Goal: 84 → 200+ sources (100+ new sources)
 * Categories:
 * - Regional tech news (Asia, Europe, Africa, LatAm)
 * - VC firm blogs (top 50 VCs)
 * - Industry verticals (FinTech, HealthTech, Climate, AI)
 * - Accelerators & business news
 */

require('dotenv').config({ path: '.env.bak' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// High-value RSS sources to add
const newSources = [
  // ========================================
  // REGIONAL TECH NEWS (Asia-Pacific)
  // ========================================
  { name: 'TechNode', url: 'https://technode.com/feed/', category: 'tech-news', region: 'asia', priority: 1 },
  { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed', category: 'tech-news', region: 'asia', priority: 1 },
  { name: 'e27', url: 'https://e27.co/feed/', category: 'tech-news', region: 'asia', priority: 1 },
  { name: 'KrASIA', url: 'https://kr-asia.com/feed', category: 'tech-news', region: 'asia', priority: 1 },
  { name: 'The Ken (India)', url: 'https://the-ken.com/feed/', category: 'tech-news', region: 'asia', priority: 2 },
  { name: 'YourStory', url: 'https://yourstory.com/feed', category: 'tech-news', region: 'asia', priority: 2 },
  { name: 'Inc42', url: 'https://inc42.com/feed/', category: 'tech-news', region: 'asia', priority: 2 },
  { name: 'TechCrunch Japan', url: 'https://jp.techcrunch.com/feed/', category: 'tech-news', region: 'asia', priority: 2 },
  { name: 'The Bridge', url: 'https://thebridge.jp/feed', category: 'tech-news', region: 'asia', priority: 3 },
  { name: 'Vulcan Post', url: 'https://vulcanpost.com/feed/', category: 'tech-news', region: 'asia', priority: 3 },
  
  // ========================================
  // REGIONAL TECH NEWS (Europe)
  // ========================================
  { name: 'EU-Startups', url: 'https://www.eu-startups.com/feed/', category: 'tech-news', region: 'europe', priority: 1 },
  { name: 'Tech.eu', url: 'https://tech.eu/feed/', category: 'tech-news', region: 'europe', priority: 1 },
  { name: 'Sifted', url: 'https://sifted.eu/feed', category: 'tech-news', region: 'europe', priority: 1 },
  { name: 'The Next Web', url: 'https://thenextweb.com/feed/', category: 'tech-news', region: 'europe', priority: 1 },
  { name: 'Silicon Canals', url: 'https://siliconcanals.com/feed/', category: 'tech-news', region: 'europe', priority: 2 },
  { name: 'Tech Funding News', url: 'https://techfundingnews.com/feed/', category: 'tech-news', region: 'europe', priority: 2 },
  { name: 'Wired UK', url: 'https://www.wired.co.uk/feed/rss', category: 'tech-news', region: 'europe', priority: 2 },
  { name: 'Business Insider UK Tech', url: 'https://www.businessinsider.com/rss', category: 'tech-news', region: 'europe', priority: 3 },
  
  // ========================================
  // REGIONAL TECH NEWS (Africa)
  // ========================================
  { name: 'Disrupt Africa', url: 'https://disrupt-africa.com/feed/', category: 'tech-news', region: 'africa', priority: 1 },
  { name: 'TechCabal', url: 'https://techcabal.com/feed/', category: 'tech-news', region: 'africa', priority: 1 },
  { name: 'Ventureburn', url: 'https://ventureburn.com/feed/', category: 'tech-news', region: 'africa', priority: 2 },
  { name: 'ITWeb Africa', url: 'https://www.itweb.co.za/rss/news.xml', category: 'tech-news', region: 'africa', priority: 2 },
  
  // ========================================
  // REGIONAL TECH NEWS (Latin America)
  // ========================================
  { name: 'LatAm.tech', url: 'https://latam.tech/feed/', category: 'tech-news', region: 'latam', priority: 1 },
  { name: 'Contxto', url: 'https://www.contxto.com/en/feed/', category: 'tech-news', region: 'latam', priority: 1 },
  { name: 'Brazil Journal', url: 'https://braziljournal.com/feed', category: 'tech-news', region: 'latam', priority: 2 },
  
  // ========================================
  // VC FIRM BLOGS (Top Tier)
  // ========================================
  { name: 'a16z', url: 'https://a16z.com/feed/', category: 'vc-blog', region: 'us', priority: 1 },
  { name: 'Sequoia Capital', url: 'https://www.sequoiacap.com/feed/', category: 'vc-blog', region: 'us', priority: 1 },
  { name: 'First Round Review', url: 'https://review.firstround.com/feed', category: 'vc-blog', region: 'us', priority: 1 },
  { name: 'Bessemer Venture Partners', url: 'https://www.bvp.com/atlas/feed', category: 'vc-blog', region: 'us', priority: 1 },
  { name: 'Accel', url: 'https://www.accel.com/noteworthy/feed', category: 'vc-blog', region: 'us', priority: 1 },
  { name: 'NEA', url: 'https://www.nea.com/feed', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'Lightspeed Venture Partners', url: 'https://lsvp.com/feed/', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'Index Ventures', url: 'https://www.indexventures.com/perspectives/feed', category: 'vc-blog', region: 'europe', priority: 2 },
  { name: 'Benchmark', url: 'https://www.benchmark.com/feed/', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'GGV Capital', url: 'https://www.ggvc.com/blog-feed.xml', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'Matrix Partners', url: 'https://www.matrixpartners.com/feed/', category: 'vc-blog', region: 'us', priority: 3 },
  { name: 'Union Square Ventures', url: 'https://www.usv.com/feed/', category: 'vc-blog', region: 'us', priority: 2 },
  { name: '500 Global', url: 'https://500.co/blog/feed/', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'Initialized Capital', url: 'https://initialized.com/feed/', category: 'vc-blog', region: 'us', priority: 3 },
  
  // ========================================
  // FINTECH
  // ========================================
  { name: 'Fintech Futures', url: 'https://www.fintechfutures.com/feed/', category: 'fintech', region: 'global', priority: 1 },
  { name: 'The Fintech Times', url: 'https://thefintechtimes.com/feed/', category: 'fintech', region: 'global', priority: 1 },
  { name: 'Fintech News', url: 'https://www.fintechnews.org/feed/', category: 'fintech', region: 'global', priority: 2 },
  { name: 'Pymnts', url: 'https://www.pymnts.com/feed/', category: 'fintech', region: 'us', priority: 2 },
  { name: 'American Banker', url: 'https://www.americanbanker.com/feed', category: 'fintech', region: 'us', priority: 2 },
  
  // ========================================
  // HEALTHTECH
  // ========================================
  { name: 'MobiHealthNews', url: 'https://www.mobihealthnews.com/feed', category: 'healthtech', region: 'global', priority: 1 },
  { name: 'Health IT News', url: 'https://www.healthcareitnews.com/feed', category: 'healthtech', region: 'global', priority: 1 },
  { name: 'MedCity News', url: 'https://medcitynews.com/feed/', category: 'healthtech', region: 'us', priority: 1 },
  { name: 'FierceBiotech', url: 'https://www.fiercebiotech.com/rss/xml', category: 'healthtech', region: 'us', priority: 2 },
  { name: 'STAT News', url: 'https://www.statnews.com/feed/', category: 'healthtech', region: 'us', priority: 1 },
  
  // ========================================
  // CLIMATE TECH
  // ========================================
  { name: 'GreenBiz', url: 'https://www.greenbiz.com/feed', category: 'climate', region: 'global', priority: 1 },
  { name: 'Canary Media', url: 'https://www.canarymedia.com/feed', category: 'climate', region: 'global', priority: 1 },
  { name: 'CleanTechnica', url: 'https://cleantechnica.com/feed/', category: 'climate', region: 'global', priority: 1 },
  { name: 'Greentech Media', url: 'https://www.greentechmedia.com/rss.xml', category: 'climate', region: 'us', priority: 2 },
  { name: 'Climate Tech VC', url: 'https://www.climatetechvc.com/feed', category: 'climate', region: 'global', priority: 1 },
  
  // ========================================
  // AI/ML
  // ========================================
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', category: 'ai', region: 'global', priority: 1 },
  { name: 'Synced Review', url: 'https://syncedreview.com/feed/', category: 'ai', region: 'global', priority: 1 },
  { name: 'The AI Blog', url: 'https://blogs.nvidia.com/feed/', category: 'ai', region: 'global', priority: 2 },
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', category: 'ai', region: 'us', priority: 1 },
  { name: 'AI News', url: 'https://artificialintelligence-news.com/feed/', category: 'ai', region: 'global', priority: 2 },
  
  // ========================================
  // ACCELERATORS
  // ========================================
  { name: 'Y Combinator', url: 'https://www.ycombinator.com/blog/feed', category: 'accelerator', region: 'us', priority: 1 },
  { name: 'Techstars', url: 'https://www.techstars.com/blog/feed', category: 'accelerator', region: 'us', priority: 1 },
  { name: 'MassChallenge', url: 'https://masschallenge.org/feed', category: 'accelerator', region: 'us', priority: 2 },
  { name: 'Startup Grind', url: 'https://www.startupgrind.com/feed/', category: 'accelerator', region: 'global', priority: 2 },
  { name: '500 Startups', url: 'https://500.co/feed/', category: 'accelerator', region: 'us', priority: 2 },
  
  // ========================================
  // BUSINESS NEWS
  // ========================================
  { name: 'Forbes Startups', url: 'https://www.forbes.com/startups/feed/', category: 'business-news', region: 'us', priority: 1 },
  { name: 'Inc Magazine', url: 'https://www.inc.com/rss/', category: 'business-news', region: 'us', priority: 1 },
  { name: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss', category: 'business-news', region: 'us', priority: 1 },
  { name: 'Bloomberg Technology', url: 'https://www.bloomberg.com/feed/podcast/Bloomberg-Technology.xml', category: 'business-news', region: 'us', priority: 1 },
  { name: 'WSJ Venture Capital', url: 'https://www.wsj.com/xml/rss/3_7014.xml', category: 'business-news', region: 'us', priority: 1 },
  { name: 'Fortune Startups', url: 'https://fortune.com/feed/', category: 'business-news', region: 'us', priority: 2 },
  { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', category: 'business-news', region: 'us', priority: 2 },
  
  // ========================================
  // NICHE/EMERGING
  // ========================================
  { name: 'The Information', url: 'https://www.theinformation.com/feed', category: 'tech-news', region: 'us', priority: 1 },
  { name: 'Axios Pro Rata', url: 'https://www.axios.com/feeds/feed.rss', category: 'tech-news', region: 'us', priority: 1 },
  { name: 'PitchBook News', url: 'https://pitchbook.com/news/feed', category: 'vc-news', region: 'us', priority: 1 },
  { name: 'Strictly VC', url: 'https://www.strictlyvc.com/feed/', category: 'vc-news', region: 'us', priority: 1 },
  { name: 'Term Sheet', url: 'https://fortune.com/section/term-sheet/feed/', category: 'vc-news', region: 'us', priority: 1 },
  { name: 'SaaStr', url: 'https://www.saastr.com/feed/', category: 'saas', region: 'us', priority: 2 },
  { name: 'Product Hunt Blog', url: 'https://blog.producthunt.com/feed', category: 'product', region: 'global', priority: 1 },
  { name: 'BetaList Blog', url: 'https://betalist.com/feed.xml', category: 'product', region: 'global', priority: 2 },
  { name: 'Launching Next', url: 'https://www.launchingnext.com/feed/', category: 'product', region: 'global', priority: 3 },
  
  // ========================================
  // CRYPTO/WEB3 (if relevant)
  // ========================================
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'crypto', region: 'global', priority: 2 },
  { name: 'The Block', url: 'https://www.theblockcrypto.com/rss.xml', category: 'crypto', region: 'global', priority: 2 },
  { name: 'Decrypt', url: 'https://decrypt.co/feed', category: 'crypto', region: 'global', priority: 3 },
  
  // ========================================
  // DEVELOPER/TECH
  // ========================================
  { name: 'Stack Overflow Blog', url: 'https://stackoverflow.blog/feed/', category: 'developer', region: 'global', priority: 3 },
  { name: 'Dev.to', url: 'https://dev.to/feed', category: 'developer', region: 'global', priority: 3 },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', category: 'developer', region: 'global', priority: 2 },
  
  // ========================================
  // ADDITIONAL VC BLOGS
  // ========================================
  { name: 'Andreessen Horowitz Crypto', url: 'https://a16zcrypto.com/feed/', category: 'vc-blog', region: 'us', priority: 2 },
  { name: 'Point Nine Capital', url: 'https://medium.com/feed/point-nine-news', category: 'vc-blog', region: 'europe', priority: 2 },
  { name: 'Creandum', url: 'https://medium.com/feed/@creandum', category: 'vc-blog', region: 'europe', priority: 3 },
  { name: 'LocalGlobe', url: 'https://localglobe.vc/feed/', category: 'vc-blog', region: 'europe', priority: 3 },
];

async function addRSSSources() {
  console.log('🚀 Adding High-Value RSS Sources (Phase 1)');
  console.log(`📊 Total sources to add: ${newSources.length}`);
  console.log('');
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const source of newSources) {
    try {
      // Check if source already exists
      const { data: existing } = await supabase
        .from('rss_sources')
        .select('id')
        .eq('url', source.url)
        .single();
      
      if (existing) {
        console.log(`⏭️  Skipped: ${source.name} (already exists)`);
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
          last_scraped: null
        });
      
      if (error) {
        console.log(`❌ Error adding ${source.name}: ${error.message}`);
        errors++;
      } else {
        console.log(`✅ Added: ${source.name} (${source.category}, ${source.region})`);
        added++;
      }
      
      // Rate limit (avoid overwhelming Supabase)
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.log(`❌ Error processing ${source.name}: ${err.message}`);
      errors++;
    }
  }
  
  console.log('');
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Added: ${added}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log('');
  
  // Get updated total
  const { count: totalSources } = await supabase
    .from('rss_sources')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📡 Total RSS sources now: ${totalSources}`);
  console.log('');
  console.log('🎯 Next steps:');
  console.log('  1. Wait for next scraper run (every 15 min)');
  console.log('  2. Monitor with: node test-scraper-health.js');
  console.log('  3. Check PM2 logs: pm2 logs rss-scraper --lines 50');
  console.log('');
  console.log('Expected impact: 773 → 2,000+ events/day (36 → 100+ startups/day)');
}

addRSSSources().catch(console.error);
