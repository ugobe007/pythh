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
  
  // PARSE errors — not valid RSS
  'https://www.greenbiz.com/feed',                          // GreenBiz — broken XML
  'https://kr-asia.com/feed',                               // KrASIA — broken XML
  'https://www.startupgrind.com/feed/',                     // Startup Grind — broken XML  
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
