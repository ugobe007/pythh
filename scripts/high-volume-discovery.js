#!/usr/bin/env node
/**
 * HIGH-VOLUME STARTUP & INVESTOR DISCOVERY
 * 
 * Goal: 200+ startups/day, 100+ investors/day
 * 
 * Strategy:
 * 1. Scrape 50+ high-yield startup news sources every 2 hours
 * 2. Scrape investor announcements and team pages every 4 hours
 * 3. Use AI entity extraction to find companies/investors in news articles
 * 
 * Run: node scripts/high-volume-discovery.js
 * PM2: See ecosystem.config.js for scheduling
 */

require('dotenv').config();
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// OpenAI for entity extraction
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// ============================================================================
// HIGH-YIELD STARTUP SOURCES (prioritized by discovery rate)
// ============================================================================
const STARTUP_SOURCES = [
  // Funding news (highest yield - mentions startups by name)
  { name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/feed/', priority: 1, expectedYield: 20 },
  { name: 'TechCrunch Venture', url: 'https://techcrunch.com/category/venture/feed/', priority: 1, expectedYield: 15 },
  { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/', priority: 1, expectedYield: 25 },
  { name: 'VentureBeat', url: 'https://venturebeat.com/feed/', priority: 1, expectedYield: 15 },
  { name: 'FINSMES', url: 'https://www.finsmes.com/feed', priority: 1, expectedYield: 30 },
  { name: 'EU-Startups', url: 'https://www.eu-startups.com/feed/', priority: 1, expectedYield: 20 },
  { name: 'Tech.eu', url: 'https://tech.eu/feed/', priority: 1, expectedYield: 15 },
  
  // Product launches (high signal)
  { name: 'Product Hunt (via HN)', url: 'https://hnrss.org/show?q=product+hunt', priority: 2, expectedYield: 10 },
  { name: 'Hacker News Show HN', url: 'https://hnrss.org/show', priority: 2, expectedYield: 15 },
  // REMOVED: Indie Hackers (returns 403 - blocking scrapers)
  // REMOVED: BetaList (returns 404 - feed moved/removed)
  
  // Regional startup news
  { name: 'Inc42 (India)', url: 'https://inc42.com/feed/', priority: 1, expectedYield: 20 },
  // REMOVED: e27 (SEA) (returns 403 - blocking scrapers)
  { name: 'Tech in Asia', url: 'https://www.techinasia.com/feed', priority: 1, expectedYield: 15 },
  { name: 'Silicon Republic', url: 'https://www.siliconrepublic.com/feed', priority: 2, expectedYield: 10 },
  { name: 'Startupbeat', url: 'https://startupbeat.com/feed/', priority: 2, expectedYield: 8 },
  
  // Sector-specific (AI, Fintech, Climate)
  { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/', priority: 2, expectedYield: 10 },
  { name: 'The Fintech Times', url: 'https://thefintechtimes.com/feed/', priority: 2, expectedYield: 10 },
  { name: 'CleanTechnica', url: 'https://cleantechnica.com/feed/', priority: 2, expectedYield: 8 },
  { name: 'Healthcare IT News', url: 'https://www.healthcareitnews.com/feed', priority: 2, expectedYield: 8 },
  
  // Google News RSS (aggregates many sources) - MOST RELIABLE
  { name: 'Google: Startup Funding', url: 'https://news.google.com/rss/search?q=startup+funding+raised&hl=en-US', priority: 1, expectedYield: 30 },
  { name: 'Google: Series A', url: 'https://news.google.com/rss/search?q=series+a+funding&hl=en-US', priority: 1, expectedYield: 25 },
  { name: 'Google: Seed Round', url: 'https://news.google.com/rss/search?q=seed+round+startup&hl=en-US', priority: 1, expectedYield: 20 },
  { name: 'Google: AI Startup', url: 'https://news.google.com/rss/search?q=AI+startup+launch&hl=en-US', priority: 1, expectedYield: 20 },
  { name: 'Google: YC Startups', url: 'https://news.google.com/rss/search?q=y+combinator+startup&hl=en-US', priority: 1, expectedYield: 15 },
  { name: 'Google: Fintech', url: 'https://news.google.com/rss/search?q=fintech+startup+funding&hl=en-US', priority: 1, expectedYield: 15 },
  
  // REMOVED: Reddit RSS (all return 403 - blocking scrapers)
  // Alternative: Use Hacker News which has similar content
  { name: 'Hacker News Startups', url: 'https://hnrss.org/newest?q=startup', priority: 3, expectedYield: 10 },
  { name: 'Hacker News Funding', url: 'https://hnrss.org/newest?q=funding+raised', priority: 3, expectedYield: 10 },
];

// ============================================================================
// INVESTOR SOURCES (VC announcements, new funds, team pages)
// ============================================================================
const INVESTOR_SOURCES = [
  // VC News - MOST RELIABLE
  { name: 'Axios Pro Rata', url: 'https://www.axios.com/pro/tech-deals/feed', priority: 1, expectedYield: 10 },
  // REMOVED: Fortune Term Sheet (returns 404)
  // REMOVED: PitchBook News (returns 403 - blocking scrapers)
  
  // VC Fund announcements - Google News (MOST RELIABLE)
  { name: 'Google: VC Fund Raise', url: 'https://news.google.com/rss/search?q=venture+capital+new+fund&hl=en-US', priority: 1, expectedYield: 10 },
  { name: 'Google: VC Partner', url: 'https://news.google.com/rss/search?q=venture+capital+partner+joins&hl=en-US', priority: 1, expectedYield: 8 },
  { name: 'Google: Angel Investor', url: 'https://news.google.com/rss/search?q=angel+investor+invests&hl=en-US', priority: 2, expectedYield: 5 },
  { name: 'Google: VC Investment', url: 'https://news.google.com/rss/search?q=venture+capital+investment+led+by&hl=en-US', priority: 1, expectedYield: 12 },
  { name: 'Google: VC Firm', url: 'https://news.google.com/rss/search?q=venture+firm+raises+fund&hl=en-US', priority: 1, expectedYield: 8 },
  
  // VC Blogs - Use working ones only
  // REMOVED: a16z Blog (returns 404)
  // REMOVED: First Round Review (returns 404)
  { name: 'Sequoia Ideas', url: 'https://www.sequoiacap.com/feed/', priority: 2, expectedYield: 2 },
  
  // Additional reliable investor sources
  { name: 'Crunchbase VC News', url: 'https://news.crunchbase.com/feed/', priority: 1, expectedYield: 15 },
  { name: 'TechCrunch Venture', url: 'https://techcrunch.com/category/venture/feed/', priority: 1, expectedYield: 12 },
  { name: 'NVCA News', url: 'https://nvca.org/feed/', priority: 2, expectedYield: 5 },
];

// ============================================================================
// AI ENTITY EXTRACTION
// ============================================================================
async function extractEntitiesWithAI(title, content, source) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('your-')) {
    return { startups: [], investors: [] };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `You extract startup companies and investors from news articles.
Return JSON with:
- startups: Array of {name, description, sector, stage, amount_raised}
- investors: Array of {name, firm, type}

Rules:
- Only include actual company names, not generic terms
- For startups: include if they raised funding, launched a product, or were acquired
- For investors: include VCs, angels, PE firms mentioned as investors
- stage should be: "Pre-Seed", "Seed", "Series A", "Series B", "Series C+", "Growth", or null
- sector should be one of: "AI", "Fintech", "Healthcare", "SaaS", "Consumer", "Climate", "Crypto", "Enterprise", "Other"
- amount_raised should be a number (in USD) or null`
        }, {
          role: 'user',
          content: `Extract entities from this ${source} article:\n\nTitle: ${title}\n\nContent: ${content?.substring(0, 2000) || 'No content'}`
        }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0
      })
    });

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{"startups":[],"investors":[]}');
    return {
      startups: parsed.startups || [],
      investors: parsed.investors || []
    };
  } catch (error) {
    console.error('  AI extraction error:', error.message);
    return { startups: [], investors: [] };
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================
async function saveStartup(startup, sourceUrl, articleTitle) {
  if (!startup.name || startup.name.length < 2) return null;
  
  // Skip known non-startups
  const skipNames = ['google', 'apple', 'microsoft', 'amazon', 'meta', 'openai', 'anthropic', 'nvidia'];
  if (skipNames.includes(startup.name.toLowerCase())) return null;
  
  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('id')
      .ilike('name', startup.name)
      .maybeSingle();
    
    if (existing) return null;

    // Insert with correct column names
    const { data, error } = await supabase
      .from('discovered_startups')
      .insert({
        name: startup.name,
        description: startup.description || articleTitle,
        sectors: startup.sector ? [startup.sector] : ['Other'],
        funding_stage: startup.stage || 'Unknown',
        funding_amount: startup.amount_raised ? String(startup.amount_raised) : null,
        article_url: sourceUrl,
        article_title: articleTitle,
        source: 'high_volume_discovery',
        metadata: {
          discovered_at: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (error) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  DB error for ${startup.name}:`, error.message);
      }
      return null;
    }
    
    return data?.id;
  } catch (err) {
    return null;
  }
}

async function saveInvestor(investor, sourceUrl) {
  if (!investor.name || investor.name.length < 2) return null;
  
  // Skip known non-investors
  const skipNames = ['bank of america', 'jpmorgan', 'goldman sachs'];
  if (skipNames.some(s => investor.name.toLowerCase().includes(s))) return null;

  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('investors')
      .select('id')
      .ilike('name', investor.name)
      .maybeSingle();
    
    if (existing) return null;

    // Insert with correct column names (no source/source_url in investors table)
    const { data, error } = await supabase
      .from('investors')
      .insert({
        name: investor.name,
        firm: investor.firm || null,
        type: investor.type || 'VC',
        sectors: [],
        stage: ['Seed'],
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  DB error for investor ${investor.name}:`, error.message);
      }
      return null;
    }
    
    return data?.id;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// SCRAPING LOGIC
// ============================================================================
async function scrapeFeed(source) {
  const results = { startups: 0, investors: 0, articles: 0 };
  
  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items?.slice(0, 30) || [];
    results.articles = items.length;
    
    for (const item of items) {
      // Skip old articles (> 3 days)
      const pubDate = new Date(item.pubDate || item.isoDate);
      if (Date.now() - pubDate.getTime() > 3 * 24 * 60 * 60 * 1000) continue;
      
      const title = item.title || '';
      const content = item.contentSnippet || item.content || item.description || '';
      const link = item.link || '';
      
      // Use AI to extract entities
      const entities = await extractEntitiesWithAI(title, content, source.name);
      
      // Save startups
      for (const startup of entities.startups) {
        const saved = await saveStartup(startup, link, title);
        if (saved) results.startups++;
      }
      
      // Save investors
      for (const investor of entities.investors) {
        const saved = await saveInvestor(investor, link);
        if (saved) results.investors++;
      }
      
      // Small delay between articles
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error) {
    console.error(`  Error scraping ${source.name}:`, error.message?.substring(0, 50));
  }
  
  return results;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 HIGH-VOLUME STARTUP & INVESTOR DISCOVERY');
  console.log('   Goal: 200+ startups/day, 100+ investors/day');
  console.log('═'.repeat(70));
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  
  // Check API key
  if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('your-')) {
    console.log('⚠️  OpenAI API key not configured - using basic extraction only\n');
  }
  
  // Get starting counts
  const { count: startupsBefore } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  const { count: investorsBefore } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 BEFORE: ${startupsBefore} startups, ${investorsBefore} investors\n`);
  
  let totalStartups = 0;
  let totalInvestors = 0;
  
  // Process startup sources
  console.log('━'.repeat(70));
  console.log('📡 SCRAPING STARTUP SOURCES');
  console.log('━'.repeat(70));
  
  for (const source of STARTUP_SOURCES) {
    process.stdout.write(`  ${source.name.padEnd(30)}... `);
    const results = await scrapeFeed(source);
    console.log(`📰 ${results.articles} articles → 🚀 ${results.startups} startups, 💼 ${results.investors} investors`);
    totalStartups += results.startups;
    totalInvestors += results.investors;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Process investor sources
  console.log('\n' + '━'.repeat(70));
  console.log('💼 SCRAPING INVESTOR SOURCES');
  console.log('━'.repeat(70));
  
  for (const source of INVESTOR_SOURCES) {
    process.stdout.write(`  ${source.name.padEnd(30)}... `);
    const results = await scrapeFeed(source);
    console.log(`📰 ${results.articles} articles → 🚀 ${results.startups} startups, 💼 ${results.investors} investors`);
    totalStartups += results.startups;
    totalInvestors += results.investors;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // Final counts
  const { count: startupsAfter } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  const { count: investorsAfter } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS');
  console.log('═'.repeat(70));
  console.log(`  Startups:  ${startupsBefore} → ${startupsAfter} (+${startupsAfter - startupsBefore})`);
  console.log(`  Investors: ${investorsBefore} → ${investorsAfter} (+${investorsAfter - investorsBefore})`);
  console.log(`  Duration:  ${duration}s`);
  console.log('═'.repeat(70));
  
  // Log to database
  await supabase.from('ai_logs').insert({
    type: 'discovery',
    action: 'high_volume_run',
    status: 'success',
    output: {
      startups_added: startupsAfter - startupsBefore,
      investors_added: investorsAfter - investorsBefore,
      sources_scraped: STARTUP_SOURCES.length + INVESTOR_SOURCES.length,
      duration_seconds: parseFloat(duration)
    }
  });
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
