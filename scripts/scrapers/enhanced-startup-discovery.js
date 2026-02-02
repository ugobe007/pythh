#!/usr/bin/env node
/**
 * Enhanced Startup Discovery
 * 
 * Replaces modern-startup-discovery.js with dynamic parser integration.
 * Uses the Parse.bot-style DynamicParser for richer data extraction.
 * NOW INTEGRATED: Smart URL Processor for intelligent URL classification.
 * 
 * Usage:
 *   node enhanced-startup-discovery.js
 *   node enhanced-startup-discovery.js --investors  # Also enrich investors
 *   node enhanced-startup-discovery.js --limit 20   # Limit per source
 */

require('dotenv').config();
const { DynamicParser } = require('./lib/dynamic-parser');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// URL Processor for intelligent classification
let urlProcessor;
try {
  urlProcessor = require('../../lib/url-processor');
} catch (e) {
  console.warn('⚠️  URL Processor not found, using fallback logic');
  urlProcessor = null;
}

// Initialize
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const parser = new DynamicParser();

// Startup discovery sources - ONLY sources that don't block scrapers
// ProductHunt returns 403, so removed
const STARTUP_SOURCES = [
  // RSS Feeds - Most reliable, always work
  { 
    name: 'TechCrunch Startups RSS', 
    listUrl: 'https://techcrunch.com/category/startups/feed/',
    type: 'rss',
    linkPattern: /techcrunch\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/gi
  },
  { 
    name: 'TechCrunch Funding RSS', 
    listUrl: 'https://techcrunch.com/tag/funding/feed/',
    type: 'rss',
    linkPattern: /techcrunch\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/gi
  },
  { 
    name: 'Hacker News Show HN', 
    listUrl: 'https://hnrss.org/show',
    type: 'rss',
    linkPattern: /item\?id=\d+/gi
  },
  { 
    name: 'Crunchbase News RSS', 
    listUrl: 'https://news.crunchbase.com/feed/',
    type: 'rss',
    linkPattern: /news\.crunchbase\.com\/[a-z0-9-\/]+/gi
  },
  { 
    name: 'VentureBeat RSS', 
    listUrl: 'https://venturebeat.com/feed/',
    type: 'rss',
    linkPattern: /venturebeat\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+/gi
  },
  { 
    name: 'Indie Hackers RSS', 
    listUrl: 'https://www.indiehackers.com/feed.xml',
    type: 'rss',
    linkPattern: /indiehackers\.com\/post\/[a-z0-9-]+/gi
  },
  // Web scraping - These allow scraping
  { 
    name: 'Y Combinator', 
    listUrl: 'https://www.ycombinator.com/companies',
    type: 'startup_list',
    linkPattern: /\/companies\/[a-z0-9-]+/gi
  }
  // REMOVED: ProductHunt - returns 403 Forbidden
  // { name: 'Product Hunt', listUrl: 'https://www.producthunt.com/...', ... }
];

// Investor sources (for --investors flag)
const INVESTOR_SOURCES = [
  {
    name: 'Signal NVCA',
    listUrl: 'https://nvca.org/members/',
    type: 'investor_list',
    linkPattern: /\/member\/[a-z0-9-]+/gi
  }
];

// Sector normalization map
const SECTOR_MAP = {
  'ai': 'Artificial Intelligence',
  'artificial intelligence': 'Artificial Intelligence',
  'machine learning': 'Machine Learning',
  'saas': 'SaaS',
  'b2b': 'B2B',
  'b2c': 'B2C',
  'fintech': 'FinTech',
  'healthtech': 'HealthTech',
  'healthcare': 'HealthTech',
  'edtech': 'EdTech',
  'devtools': 'Developer Tools',
  'developer tools': 'Developer Tools',
  'enterprise': 'Enterprise Software',
  'crypto': 'Crypto/Web3',
  'web3': 'Crypto/Web3',
  'climate': 'Climate Tech',
  'ecommerce': 'E-Commerce',
  'security': 'Cybersecurity'
};

function normalizeSectors(sectors) {
  if (!sectors || !Array.isArray(sectors)) return sectors;
  return sectors.map(s => SECTOR_MAP[s.toLowerCase()] || s)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

/**
 * Fetch a page with retries
 */
async function fetchPage(url, retries = 3) {
  const fetch = (await import('node-fetch')).default;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 30000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Extract startup/company links from a list page
 * ENHANCED: Now uses URL Processor for intelligent filtering
 */
async function extractLinksFromListPage(listUrl, linkPattern, sourceName = 'unknown') {
  try {
    const html = await fetchPage(listUrl);
    const $ = cheerio.load(html);
    
    const allLinks = new Set();
    const processedLinks = [];
    
    // Find all links on the page
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && linkPattern.test(href)) {
        // Make absolute URL
        const url = href.startsWith('http') ? href : new URL(href, listUrl).toString();
        allLinks.add(url);
      }
    });
    
    // If URL processor available, filter intelligently
    if (urlProcessor) {
      console.log(`   🧠 Smart filtering ${allLinks.size} URLs...`);
      
      for (const url of allLinks) {
        const result = await urlProcessor.processUrl(url, { 
          source: sourceName,
          fromMention: false 
        });
        
        // Log decision
        await urlProcessor.logUrlDecision(result, sourceName);
        
        // Only include URLs that should create startups or extract from articles
        if (result.action === 'CREATE_STARTUP' || result.action === 'EXTRACT_FROM_ARTICLE') {
          processedLinks.push({
            url,
            action: result.action,
            domain: result.domain,
            reason: result.reason
          });
        } else {
          console.log(`   ⏭️  Skip: ${result.reason} - ${url.substring(0, 50)}...`);
        }
      }
      
      console.log(`   ✅ Filtered to ${processedLinks.length} actionable URLs`);
      return processedLinks.map(l => l.url);
    }
    
    // Fallback to original behavior
    return Array.from(allLinks);
  } catch (err) {
    console.error(`Error extracting links from ${listUrl}:`, err.message);
    return [];
  }
}

/**
 * Check if startup already exists
 * ENHANCED: Uses URL processor's smarter domain matching
 */
async function startupExists(name, website) {
  // If URL processor available, use its comprehensive check
  if (urlProcessor && website) {
    const existsResult = await urlProcessor.checkUrlExists(website);
    if (existsResult.exists) {
      return {
        exists: true,
        table: existsResult.table,
        record: existsResult.record
      };
    }
  }
  
  // Fallback to original behavior
  const { data } = await supabase
    .from('discovered_startups')
    .select('id')
    .or(`name.ilike.%${name}%,website.eq.${website}`)
    .limit(1);
  
  if (data && data.length > 0) {
    return { exists: true, table: 'discovered_startups' };
  }
  
  return { exists: false };
}

/**
 * Check if investor already exists
 */
async function investorExists(name, firm) {
  const { data } = await supabase
    .from('investors')
    .select('id')
    .or(`name.ilike.%${name}%,firm.ilike.%${firm}%`)
    .limit(1);
  
  return data && data.length > 0;
}

/**
 * Save startup to discovered_startups
 */
async function saveStartup(startup, source) {
  // Check for duplicates - now returns object with details
  const existsResult = await startupExists(startup.name, startup.website);
  if (existsResult.exists || existsResult === true) {
    const table = existsResult.table || 'discovered_startups';
    return { skipped: true, reason: `duplicate (in ${table})` };
  }

  // --- Enhanced Extraction for Traction/Product Signals ---
  // Try to extract MRR, ARR, growth rate, customer count from structured and unstructured fields
  let mrr = null, arr = null, growth_rate_monthly = null, customer_count = null, team_size = null;
  // Structured fields
  if (startup.mrr) mrr = startup.mrr;
  if (startup.arr) arr = startup.arr;
  if (startup.growth_rate_monthly) growth_rate_monthly = startup.growth_rate_monthly;
  if (startup.customer_count) customer_count = startup.customer_count;
  if (startup.team_size) team_size = startup.team_size;
  // Try to extract from description or value_proposition (simple regexes)
  const textFields = [startup.description, startup.value_proposition, startup.tagline].filter(Boolean).join(' ');
  if (!mrr) {
    const m = textFields.match(/\$?([0-9,.]+)\s*(k|m)?\s*mrr/i);
    if (m) {
      let val = parseFloat(m[1].replace(/,/g, ''));
      if (m[2] && m[2].toLowerCase() === 'm') val *= 1e6;
      if (m[2] && m[2].toLowerCase() === 'k') val *= 1e3;
      mrr = val;
    }
  }
  if (!arr) {
    const m = textFields.match(/\$?([0-9,.]+)\s*(k|m)?\s*arr/i);
    if (m) {
      let val = parseFloat(m[1].replace(/,/g, ''));
      if (m[2] && m[2].toLowerCase() === 'm') val *= 1e6;
      if (m[2] && m[2].toLowerCase() === 'k') val *= 1e3;
      arr = val;
    }
  }
  if (!growth_rate_monthly) {
    const m = textFields.match(/([0-9,.]+)%\s*(mo\.?|monthly)?\s*growth/i);
    if (m) growth_rate_monthly = parseFloat(m[1].replace(/,/g, ''));
  }
  if (!customer_count) {
    const m = textFields.match(/([0-9,.]+)\s+customers?/i);
    if (m) customer_count = parseInt(m[1].replace(/,/g, ''));
  }
  if (!team_size) {
    const m = textFields.match(/([0-9,.]+)\s+(person|employee|team|founder)s?/i);
    if (m) team_size = parseInt(m[1].replace(/,/g, ''));
  }

  // --- Signal Completeness Threshold ---
  let signalCount = 0;
  if (mrr) signalCount++;
  if (arr) signalCount++;
  if (growth_rate_monthly) signalCount++;
  if (customer_count) signalCount++;
  if (team_size) signalCount++;

  const MIN_SIGNALS = 2;
  let flagged_incomplete = false;
  if (signalCount < MIN_SIGNALS) {
    flagged_incomplete = true;
  }

  const record = {
    name: startup.name,
    website: startup.website,
    description: startup.description?.substring(0, 5000),
    value_proposition: startup.value_proposition || startup.tagline,
    sectors: normalizeSectors(startup.sectors),
    funding_amount: startup.funding_amount,
    funding_stage: startup.funding_stage || startup.stage,
    founders: startup.founders,
    team_signals: team_size ? { estimated_size: team_size } : null,
    mrr,
    arr,
    growth_rate_monthly,
    customer_count,
    flagged_incomplete,
    rss_source: source,
    discovered_at: new Date().toISOString()
  };

  // Only save if meets threshold, else flag as incomplete
  if (signalCount >= MIN_SIGNALS) {
    const { data, error } = await supabase
      .from('discovered_startups')
      .insert(record)
      .select('id');
    if (error) {
      return { error: error.message };
    }
    // Log completeness
    await supabase.from('ai_logs').insert({
      type: 'scraper',
      action: 'save_startup',
      status: 'success',
      output: { name: startup.name, signalCount, flagged_incomplete: false }
    });
    return { success: true, id: data[0].id };
  } else {
    // Save as incomplete for review, or skip insert if you prefer
    await supabase.from('ai_logs').insert({
      type: 'scraper',
      action: 'save_startup',
      status: 'incomplete',
      output: { name: startup.name, signalCount, flagged_incomplete: true }
    });
    return { skipped: true, reason: 'incomplete', signalCount };
  }
}

/**
 * Save or update investor
 */
async function saveInvestor(investor, source) {
  // Check for duplicates
  if (await investorExists(investor.name, investor.firm)) {
    return { skipped: true, reason: 'duplicate' };
  }
  
  const record = {
    name: investor.name || investor.firm,
    firm: investor.firm || investor.name,
    bio: investor.description?.substring(0, 2000),
    investment_thesis: investor.investment_thesis,
    sectors: normalizeSectors(investor.sectors),
    check_size_min: investor.check_size_min,
    check_size_max: investor.check_size_max,
    stage: investor.stage,
    partners: investor.partners,
    focus_areas: investor.focus_areas,
    status: 'active',
    last_enrichment_date: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('investors')
    .insert(record)
    .select('id');
  
  if (error) {
    return { error: error.message };
  }
  
  return { success: true, id: data[0].id };
}

/**
 * Discover startups from a source
 */
async function discoverFromSource(source, limit = 10) {
  console.log(`\n📡 ${source.name}`);
  console.log(`   ${source.listUrl}`);
  
  const stats = { found: 0, added: 0, skipped: 0, failed: 0 };
  
  try {
    if (source.type === 'news') {
      // For news sources, parse the list page for funding announcements
      const result = await parser.parseAs(source.listUrl, 'funding_news');
      
      if (result && result.announcements) {
        for (const announcement of result.announcements.slice(0, limit)) {
          stats.found++;
          
          if (announcement.startup_name) {
            // Try to get startup website and enrich
            const startup = {
              name: announcement.startup_name,
              website: announcement.startup_url,
              funding_amount: announcement.funding_amount,
              funding_stage: announcement.funding_round,
              sectors: announcement.sectors,
              description: announcement.description
            };
            
            const saveResult = await saveStartup(startup, source.name);
            if (saveResult.success) {
              stats.added++;
              console.log(`   ✅ ${startup.name}`);
            } else if (saveResult.skipped) {
              stats.skipped++;
            } else {
              stats.failed++;
            }
          }
          
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } else {
      // For list pages, extract individual startup URLs and parse each
      const links = await extractLinksFromListPage(source.listUrl, source.linkPattern);
      console.log(`   Found ${links.length} potential links`);
      
      for (const link of links.slice(0, limit)) {
        stats.found++;
        
        try {
          console.log(`   🔄 Parsing: ${link}`);
          
          const result = await parser.parseAs(link, 'startup');
          
          if (result && result.name) {
            const saveResult = await saveStartup(result, source.name);
            
            if (saveResult.success) {
              stats.added++;
              console.log(`   ✅ ${result.name}`);
            } else if (saveResult.skipped) {
              stats.skipped++;
              console.log(`   ⏭️  ${result.name} (duplicate)`);
            } else {
              stats.failed++;
              console.log(`   ❌ Save failed: ${saveResult.error}`);
            }
          }
          
          // Rate limiting
          await new Promise(r => setTimeout(r, 2000));
          
        } catch (err) {
          stats.failed++;
          console.log(`   ❌ Error: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.log(`   ❌ Source error: ${err.message}`);
  }
  
  console.log(`   📊 Found: ${stats.found} | Added: ${stats.added} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`);
  return stats;
}

/**
 * Discover investors from a source
 */
async function discoverInvestorsFromSource(source, limit = 10) {
  console.log(`\n💼 ${source.name}`);
  console.log(`   ${source.listUrl}`);
  
  const stats = { found: 0, added: 0, skipped: 0, failed: 0 };
  
  try {
    const links = await extractLinksFromListPage(source.listUrl, source.linkPattern);
    console.log(`   Found ${links.length} potential investor pages`);
    
    for (const link of links.slice(0, limit)) {
      stats.found++;
      
      try {
        console.log(`   🔄 Parsing: ${link}`);
        
        const result = await parser.parseAs(link, 'investor');
        
        if (result && (result.name || result.firm)) {
          const saveResult = await saveInvestor(result, source.name);
          
          if (saveResult.success) {
            stats.added++;
            console.log(`   ✅ ${result.firm || result.name}`);
          } else if (saveResult.skipped) {
            stats.skipped++;
          } else {
            stats.failed++;
          }
        }
        
        await new Promise(r => setTimeout(r, 2000));
        
      } catch (err) {
        stats.failed++;
      }
    }
  } catch (err) {
    console.log(`   ❌ Source error: ${err.message}`);
  }
  
  console.log(`   📊 Found: ${stats.found} | Added: ${stats.added} | Skipped: ${stats.skipped} | Failed: ${stats.failed}`);
  return stats;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const includeInvestors = args.includes('--investors');
  const limitArg = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
  
  console.log('🚀 ENHANCED STARTUP DISCOVERY');
  console.log('=' .repeat(60));
  console.log(`Using Dynamic Parser (Parse.bot style)`);
  console.log(`Limit per source: ${limitArg}`);
  if (includeInvestors) console.log('Including investor discovery');
  console.log('');
  
  const totals = {
    startups: { found: 0, added: 0, skipped: 0, failed: 0 },
    investors: { found: 0, added: 0, skipped: 0, failed: 0 }
  };
  
  // Discover startups
  console.log('\n📊 STARTUP DISCOVERY');
  console.log('-'.repeat(40));
  
  for (const source of STARTUP_SOURCES) {
    const stats = await discoverFromSource(source, limitArg);
    totals.startups.found += stats.found;
    totals.startups.added += stats.added;
    totals.startups.skipped += stats.skipped;
    totals.startups.failed += stats.failed;
    
    // Wait between sources
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Optionally discover investors
  if (includeInvestors) {
    console.log('\n💼 INVESTOR DISCOVERY');
    console.log('-'.repeat(40));
    
    for (const source of INVESTOR_SOURCES) {
      const stats = await discoverInvestorsFromSource(source, limitArg);
      totals.investors.found += stats.found;
      totals.investors.added += stats.added;
      totals.investors.skipped += stats.skipped;
      totals.investors.failed += stats.failed;
      
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DISCOVERY SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n🚀 Startups:`);
  console.log(`   Found: ${totals.startups.found}`);
  console.log(`   Added: ${totals.startups.added}`);
  console.log(`   Skipped: ${totals.startups.skipped}`);
  console.log(`   Failed: ${totals.startups.failed}`);
  
  if (includeInvestors) {
    console.log(`\n💼 Investors:`);
    console.log(`   Found: ${totals.investors.found}`);
    console.log(`   Added: ${totals.investors.added}`);
    console.log(`   Skipped: ${totals.investors.skipped}`);
    console.log(`   Failed: ${totals.investors.failed}`);
  }
  
  // Log to ai_logs
  try {
    await supabase.from('ai_logs').insert({
      type: 'discovery',
      action: 'enhanced_startup_discovery',
      status: 'success',
      output: totals
    });
  } catch (err) {
    console.log('Failed to log to ai_logs');
  }
  
  console.log('\n✨ Discovery complete!');
}

main().catch(console.error);
