#!/usr/bin/env node
/**
 * FIX BROKEN RSS FEEDS
 * 
 * Actions:
 * 1. Replace feeds with known working alternative URLs
 * 2. Deactivate feeds that have no working alternative
 * 3. Add new high-value startup discovery feeds
 * 
 * Usage:
 *   node scripts/fix-rss-feeds.js            # Dry run
 *   node scripts/fix-rss-feeds.js --apply    # Apply changes
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APPLY = process.argv.includes('--apply');

// ═══════════════════════════════════════════════════════════════
// REPLACEMENTS: Broken URL → Working alternative URL
// ═══════════════════════════════════════════════════════════════
const URL_REPLACEMENTS = {
  // Fast Company — /technology/rss.xml → 404 (Apr 2026)
  'https://www.fastcompany.com/technology/rss.xml': 'https://www.fastcompany.com/latest/rss',
  // 404 feeds — replace with working alternatives
  'https://www.accel.com/noteworthy/feed': 'https://www.accel.com/noteworthy/rss.xml',
  'https://api.axios.com/feed/technology': 'https://www.axios.com/technology/feed.rss',
  'https://betalist.com/feed.xml': 'https://betalist.com/markets/startup-tools.rss',
  'https://www.wired.co.uk/feed/rss': 'https://www.wired.co.uk/feed/category/business/latest/rss',
  
  // 403 Reddit feeds — use old.reddit.com or JSON feeds
  'https://www.reddit.com/r/Entrepreneur/.rss': 'https://old.reddit.com/r/Entrepreneur/.rss',
  'https://www.reddit.com/r/SaaS/.rss': 'https://old.reddit.com/r/SaaS/.rss',
  'https://www.reddit.com/r/startups/.rss': 'https://old.reddit.com/r/startups/.rss',
  'https://www.reddit.com/r/venturecapital/.rss': 'https://old.reddit.com/r/venturecapital/.rss',
  
  // 403 AI News — try alternate URL
  'https://artificialintelligence-news.com/feed/': 'https://www.artificialintelligence-news.com/feed/',
};

// ═══════════════════════════════════════════════════════════════
// DEACTIVATE: Feeds with no working alternative
// ═══════════════════════════════════════════════════════════════
const DEACTIVATE_URLS = [
  // 404 — pages no longer exist
  'https://www.canarymedia.com/feed',        // Canary Media — site restructured
  'https://www.itweb.co.za/rss/news.xml',    // ITWeb Africa — feed removed
  'https://fortune.com/section/term-sheet/feed/',  // Term Sheet — duplicate of Fortune Venture feed
  
  // 401 — requires authentication
  'https://www.wsj.com/xml/rss/3_7014.xml',  // WSJ — paywall
  
  // DNS — domain dead
  'https://www.climatetechvc.com/feed',       // Climate Tech VC — domain expired
  
  // 403 — aggressive blocking
  'https://masschallenge.org/feed',           // MassChallenge — blocked
  'https://pitchbook.com/news/rss',           // PitchBook — blocked
  'https://www.artificialintelligence-news.com/feed/',  // AI News duplicate (will try replacement first)
  
  // Dead RSS / HTML instead of XML / bot-block — pause (Apr 2026)
  'https://builtin.com/rss.xml',
  'https://www.sbir.gov/rss/awards.rss',
  'https://www.grants.gov/rss/GG_NewOppByCategory.xml?category=ST',
  'https://www.finsmes.com/feed',
  'https://www.finsmes.com/feed/',
  'https://www.startupgrind.com/blog/feed/',
  'https://www.startupgrind.com/feed/',

  // PARSE errors — not valid RSS
  'https://www.greenbiz.com/feed',                          // GreenBiz — broken XML
  'https://kr-asia.com/feed',                               // KrASIA — broken XML
  // Startup Grind — see URLs above (blog/feed and /feed/)
  'https://uwaterloo.ca/engineering/startup-list',          // Not an RSS feed (HTML page)
  'https://www.ycombinator.com/companies',                  // Not an RSS feed (HTML page)
  
  // OTHER — not RSS feeds (HTML pages)
  'https://www.bristol.ac.uk/business/innovate-and-grow/research-commercialisation/our-spin-out-companies/all-spin-out-companies-list/',
  'https://sparkmed.stanford.edu/commercializing-spark/startups/',
  'https://jp.techcrunch.com/feed/',                        // TechCrunch Japan — Japanese content
  'https://topstartups.io/rss/',                            // TopStartups — broken
  'https://blog.ventureradar.com/2020/09/29/the-top-20-newly-founded-university-spin-offs-you-should-know/',  // Static blog post
  'https://www.extruct.ai/data-room/ycombinator-companies-f25/',  // Not RSS
  'https://blog.producthunt.com/feed',                      // Product Hunt Blog — dead

  // Apr 2026 — scrape log (404/403/parse/HTML); also in scripts/sql/deactivate_dead_rss_feeds_bulk.sql
  'https://www.fastcompany.com/technology/rss.xml',
  'https://a16z.com/feed/',
  'https://a16z.com/blog/feed/',
  'https://www.bvp.com/atlas/rss.xml',
  'https://www.accel.com/insights/feed',
  'https://www.bvp.com/feed',
  'https://betalist.com/feed',
  'https://www.indexventures.com/feed/',
  'https://www.angellist.com/blog/rss.xml',
  'https://review.firstround.com/feed',
  'https://www.axios.com/pro-rata/rss',
  'https://www.axios.com/pro-rata',
  'https://fortune.com/tag/term-sheet/feed/',
  'https://vcnewsdaily.com/feed/',
  'https://www.techstars.com/blog/feed',
  'https://thehustle.co/feed/',
  'https://greylock.com/feed/',
  'https://www.nea.com/insights/feed',
  'https://www.nea.com/feed',
  'https://www.nfx.com/post/feed.xml',
  'https://sequoiacap.com/stories/',
  'https://sequoiacap.com/stories/?_story-category=news',
  'https://dealroom.co/blog/feed',
  'https://www.bloomberg.com/feed/podcast/bloomberg-technology',
  'https://benchmark.com/feed/',
  'https://www.gv.com/feed/',
  'https://kr-asia.com/rss/feed.xml',
  'https://feeds.megaphone.fm/thisweekinstartups',
  'https://www.deeplearning.ai/the-batch/',
  'https://e27.co/feed/',
  'https://www.saascapital.com/blog/feed/',
  'https://blog.angel.co/feed/',
  'https://www.indiehackers.com/feed',
  'https://hax.co/startups/',
  'https://sifted.eu/feed/',
  'https://www.wired.co.uk/feed/category/business/latest/rss',
  'https://www.tomtunguz.com/feed/',
  'https://bothsidesofthetable.com/feed',
  'https://inside.com/ai/rss',
  'https://www.businessinsider.com/sai/rss',
  'https://www.thetwentyminutevc.com/feed/',
  'https://www.startups.com/library/rss',
  'https://www.theinformation.com/feed',
  'https://www.cbinsights.com/feed',
  'https://500.co/blog/feed/',
  'https://www.fintechfutures.com/feed/',
  'https://www.inc.com/rss/index.rss',
  'https://www.eu-startups.com/feed/',
];

// ═══════════════════════════════════════════════════════════════
// NEW HIGH-VALUE FEEDS TO ADD
// ═══════════════════════════════════════════════════════════════
const NEW_FEEDS = [
  // Startup funding aggregators
  { name: 'AlleyWatch', url: 'https://www.alleywatch.com/feed/', category: 'startup_news' },
  { name: 'Failory', url: 'https://www.failory.com/blog/rss.xml', category: 'startup_news' },
  { name: 'Inside.com - AI', url: 'https://inside.com/ai/rss', category: 'ai' },
  { name: 'Tomasz Tunguz', url: 'https://tomtunguz.com/feed/', category: 'vc_blog' },
  { name: 'Both Sides of the Table', url: 'https://bothsidesofthetable.com/feed', category: 'vc_blog' },
  
  // Regional startup news
  { name: 'TechInAfrica', url: 'https://www.techinafrica.com/feed/', category: 'startup_news' },
  { name: 'KrASIA RSS', url: 'https://kr-asia.com/rss/feed.xml', category: 'startup_news' },
  { name: 'e27 Asia', url: 'https://e27.co/feed/', category: 'startup_news' },
  
  // VC/Accelerator feeds
  { name: 'a16z Blog', url: 'https://a16z.com/feed/', category: 'vc_blog' },
  { name: 'First Round Review', url: 'https://review.firstround.com/feed.xml', category: 'vc_blog' },
  
  // Google News startup discovery (broad coverage)
  { name: 'Google News - Seed Funding', url: 'https://news.google.com/rss/search?q=seed+funding+startup&hl=en-US&gl=US&ceid=US:en', category: 'google_news' },
  { name: 'Google News - Series B', url: 'https://news.google.com/rss/search?q=series+B+funding+startup&hl=en-US&gl=US&ceid=US:en', category: 'google_news' },
  { name: 'Google News - HealthTech', url: 'https://news.google.com/rss/search?q=healthtech+startup+funding&hl=en-US&gl=US&ceid=US:en', category: 'google_news' },
  { name: 'Google News - Climate Startup', url: 'https://news.google.com/rss/search?q=climate+startup+funding&hl=en-US&gl=US&ceid=US:en', category: 'google_news' },
];

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  FIX RSS FEEDS — ${APPLY ? '🔧 APPLY MODE' : '🔍 DRY RUN (add --apply)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Read current audit results
  let auditData;
  try {
    auditData = JSON.parse(require('fs').readFileSync('/tmp/rss-audit-results.json', 'utf8'));
    console.log(`📊 Audit data: ${auditData.working} working, ${auditData.broken} broken\n`);
  } catch {
    console.log('⚠️  No audit data found. Run audit-rss-feeds.js first.\n');
  }

  // 1. URL Replacements
  console.log('📋 URL REPLACEMENTS:');
  let replaced = 0;
  for (const [oldUrl, newUrl] of Object.entries(URL_REPLACEMENTS)) {
    const { data: source } = await supabase
      .from('rss_sources')
      .select('id, name')
      .eq('url', oldUrl)
      .single();
    
    if (source) {
      console.log(`  🔄 ${source.name}`);
      console.log(`     OLD: ${oldUrl}`);
      console.log(`     NEW: ${newUrl}`);
      
      if (APPLY) {
        const { error } = await supabase
          .from('rss_sources')
          .update({ url: newUrl, updated_at: new Date().toISOString() })
          .eq('id', source.id);
        
        if (error) console.log(`     ❌ Error: ${error.message}`);
        else { console.log(`     ✅ Updated`); replaced++; }
      }
    }
  }
  console.log(`  Total: ${replaced} replaced\n`);

  // 2. Deactivate broken feeds
  console.log('📋 DEACTIVATING BROKEN FEEDS:');
  let deactivated = 0;
  for (const url of DEACTIVATE_URLS) {
    const { data: source } = await supabase
      .from('rss_sources')
      .select('id, name, active')
      .eq('url', url)
      .single();
    
    if (source && source.active) {
      console.log(`  ❌ ${source.name} → deactivate`);
      
      if (APPLY) {
        const { error } = await supabase
          .from('rss_sources')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('id', source.id);
        
        if (error) console.log(`     ❌ Error: ${error.message}`);
        else { console.log(`     ✅ Deactivated`); deactivated++; }
      }
    } else if (source && !source.active) {
      console.log(`  ⏭️  ${source.name} — already inactive`);
    }
  }
  console.log(`  Total: ${deactivated} deactivated\n`);

  // 3. Add new feeds
  console.log('📋 NEW FEEDS TO ADD:');
  let added = 0;
  for (const feed of NEW_FEEDS) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('rss_sources')
      .select('id, name')
      .eq('url', feed.url)
      .single();
    
    if (existing) {
      console.log(`  ⏭️  ${feed.name} — already exists`);
      continue;
    }

    console.log(`  ➕ ${feed.name} (${feed.url})`);
    
    if (APPLY) {
      const { error } = await supabase
        .from('rss_sources')
        .insert({
          name: feed.name,
          url: feed.url,
          category: feed.category,
          active: true,
        });
      
      if (error) console.log(`     ❌ Error: ${error.message}`);
      else { console.log(`     ✅ Added`); added++; }
    }
  }
  console.log(`  Total: ${added} added\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  if (APPLY) {
    console.log(`  ✅ CHANGES APPLIED`);
    console.log(`     ${replaced} URLs replaced`);
    console.log(`     ${deactivated} feeds deactivated`);
    console.log(`     ${added} new feeds added`);
  } else {
    console.log('  DRY RUN COMPLETE — No changes made.');
    console.log('  Run with --apply to execute changes.');
  }
  console.log('═══════════════════════════════════════════════════════════════');
}

run().catch(console.error);
