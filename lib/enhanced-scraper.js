#!/usr/bin/env node
/**
 * ENHANCED SCRAPER - Dynamic Parser Integration
 * 
 * Uses Parse.bot-style AI parsing for intelligent data extraction.
 * Integrates with continuous-scraper.js for automated discovery.
 * 
 * Features:
 * - Dynamic schema extraction (no hardcoded selectors)
 * - Smart caching to reduce API costs
 * - Batch processing for efficiency
 * - Automatic sector/stage normalization
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { DynamicParser } = require('./dynamic-parser');

// Supabase setup
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

// Initialize parser with caching
const parser = new DynamicParser({
  cacheTimeout: 2 * 60 * 60 * 1000 // 2 hour cache
});

// Sector normalization map
const SECTOR_MAP = {
  'artificial intelligence': ['ai', 'machine learning', 'ml', 'deep learning', 'neural network', 'llm', 'generative ai'],
  'fintech': ['financial technology', 'payments', 'banking', 'neobank', 'lending', 'insurance tech', 'insurtech'],
  'healthcare': ['health tech', 'healthtech', 'medtech', 'biotech', 'digital health', 'telemedicine'],
  'saas': ['software as a service', 'b2b saas', 'enterprise software', 'cloud software'],
  'e-commerce': ['ecommerce', 'online retail', 'marketplace', 'direct to consumer', 'd2c', 'dtc'],
  'climate': ['cleantech', 'clean tech', 'sustainability', 'green tech', 'renewable', 'carbon'],
  'crypto': ['blockchain', 'web3', 'defi', 'nft', 'cryptocurrency'],
  'developer tools': ['devtools', 'dev tools', 'infrastructure', 'platform', 'api'],
  'consumer': ['consumer tech', 'b2c', 'consumer app', 'social', 'creator economy'],
  'enterprise': ['b2b', 'enterprise software', 'business software'],
  'security': ['cybersecurity', 'infosec', 'data security', 'identity'],
  'education': ['edtech', 'ed tech', 'learning', 'training'],
  'real estate': ['proptech', 'property tech', 'real estate tech'],
  'logistics': ['supply chain', 'transportation', 'delivery', 'fulfillment'],
  'food': ['foodtech', 'food tech', 'restaurant tech', 'agtech', 'agriculture']
};

// Stage normalization
const STAGE_MAP = {
  0: ['idea', 'concept', 'pre-launch'],
  1: ['pre-seed', 'preseed', 'angel', 'friends and family'],
  2: ['seed', 'seed stage'],
  3: ['series a', 'series-a', 'seriesa', 'a round'],
  4: ['series b', 'series-b', 'seriesb', 'b round'],
  5: ['series c', 'series-c', 'seriesc', 'c round', 'growth', 'late stage']
};

/**
 * Normalize sector to standard categories
 */
function normalizeSector(sector) {
  if (!sector) return null;
  const lower = sector.toLowerCase().trim();
  
  for (const [standard, aliases] of Object.entries(SECTOR_MAP)) {
    if (standard === lower || aliases.some(alias => lower.includes(alias) || alias.includes(lower))) {
      return standard.charAt(0).toUpperCase() + standard.slice(1);
    }
  }
  
  // Return original if no match (capitalized)
  return sector.charAt(0).toUpperCase() + sector.slice(1);
}

/**
 * Normalize funding stage
 */
function normalizeStage(stage) {
  if (typeof stage === 'number') return stage;
  if (!stage) return null;
  
  const lower = String(stage).toLowerCase().trim();
  
  for (const [num, aliases] of Object.entries(STAGE_MAP)) {
    if (aliases.some(alias => lower.includes(alias) || alias.includes(lower))) {
      return parseInt(num);
    }
  }
  
  return null;
}

/**
 * Parse startup from URL and save to database
 */
async function parseAndSaveStartup(url) {
  console.log(`\n🔍 Parsing startup: ${url}`);
  
  try {
    // Use parseAs for predefined startup schema
    const data = await parser.parseAs(url, 'startup');
    
    // Accept either 'name' or 'company_name'
    const companyName = data?.name || data?.company_name;
    if (!data || !companyName) {
      console.log('⚠️  No valid startup data extracted');
      console.log('   Received:', JSON.stringify(data, null, 2));
      return null;
    }
    
    // Normalize sectors
    const sectors = [];
    if (data.industry) sectors.push(normalizeSector(data.industry));
    if (data.categories && Array.isArray(data.categories)) {
      data.categories.forEach(cat => {
        const normalized = normalizeSector(cat);
        if (normalized && !sectors.includes(normalized)) {
          sectors.push(normalized);
        }
      });
    }
    
    // Build startup record (matching discovered_startups schema)
    const startup = {
      name: companyName,
      description: data.description || data.mission || '',
      website: url,
      funding_stage: data.stage || data.funding_stage || 'seed',
      funding_amount: data.funding_amount || null,
      investors_mentioned: data.investors || data.founders || [],
      sectors: sectors.length > 0 ? sectors : ['SaaS', 'Technology'],
      article_url: url,
      rss_source: 'dynamic_parser',
      value_proposition: data.tagline || data.description?.substring(0, 300) || '',
      problem: data.target_market || '',
      solution: data.traction || ''
    };
    
    // Add traction data if available
    if (data.team_size) startup.customer_count = parseInt(data.team_size) || null;
    if (data.founded_year) {
      // Store in description since there's no founded column
      startup.description += ` (Founded: ${data.founded_year})`;
    }
    if (data.funding_amount) startup.has_revenue = true;
    
    // Check for duplicates
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('id')
      .or(`website.eq.${url},name.ilike.${startup.name}`)
      .single();
    
    if (existing) {
      console.log(`⏭️  Startup already exists: ${startup.name}`);
      return { ...startup, duplicate: true };
    }
    
    // Insert to discovered_startups
    const { data: inserted, error } = await supabase
      .from('discovered_startups')
      .insert(startup)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Insert error:', error.message);
      return null;
    }
    
    console.log(`✅ Saved startup: ${startup.name} (ID: ${inserted.id})`);
    return inserted;
    
  } catch (error) {
    console.error(`❌ Parse error: ${error.message}`);
    return null;
  }
}

/**
 * Parse investor/VC from URL and save to database
 */
async function parseAndSaveInvestor(url) {
  console.log(`\n🔍 Parsing investor: ${url}`);
  
  try {
    // Use parseAs for predefined investor schema
    const data = await parser.parseAs(url, 'investor');
    
    // Accept either 'name' or 'firm_name'
    const firmName = data?.name || data?.firm_name;
    if (!data || !firmName) {
      console.log('⚠️  No valid investor data extracted');
      console.log('   Received:', JSON.stringify(data, null, 2));
      return null;
    }
    
    // Normalize sectors from data.sectors (predefined schema field)
    const sectors = [];
    const sectorSource = data.sectors || data.investment_sectors || [];
    if (Array.isArray(sectorSource)) {
      sectorSource.forEach(sector => {
        const normalized = normalizeSector(sector);
        if (normalized && !sectors.includes(normalized)) {
          sectors.push(normalized);
        }
      });
    }
    
    // Normalize stages from data.stages (predefined schema field)
    const stages = [];
    const stageSource = data.stages || data.investment_stages || [];
    if (Array.isArray(stageSource)) {
      stageSource.forEach(stage => {
        const stageNames = ['Idea', 'Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+'];
        const normalized = normalizeStage(stage);
        if (normalized !== null && !stages.includes(stageNames[normalized])) {
          stages.push(stageNames[normalized]);
        }
      });
    }
    
    // Build investor record (matching investors table schema)
    const investor = {
      name: firmName,
      firm: firmName,
      bio: data.description || '',
      investment_thesis: data.description || '',
      sectors: sectors.length > 0 ? sectors : ['SaaS', 'Technology'],
      stage: stages.length > 0 ? stages : ['Seed', 'Series A'],
      status: 'active',
      last_enrichment_date: new Date().toISOString()
    };
    
    // Add optional fields (matching actual column names)
    if (data.check_size) {
      // Parse check size into min/max if possible
      const sizeMatch = data.check_size.match(/\$?([\d.]+)([KMB])?.*\$?([\d.]+)?([KMB])?/i);
      if (sizeMatch) {
        const multiplier = { K: 1000, M: 1000000, B: 1000000000 };
        investor.check_size_min = parseFloat(sizeMatch[1]) * (multiplier[sizeMatch[2]?.toUpperCase()] || 1);
        if (sizeMatch[3]) {
          investor.check_size_max = parseFloat(sizeMatch[3]) * (multiplier[sizeMatch[4]?.toUpperCase()] || 1);
        }
      }
    }
    if (data.geography) investor.geography_focus = Array.isArray(data.geography) ? data.geography : [data.geography];
    if (data.portfolio) investor.portfolio_companies = data.portfolio;
    if (data.partners) investor.partners = { names: data.partners };
    
    // Check for duplicates
    const { data: existing } = await supabase
      .from('investors')
      .select('id')
      .or(`website.eq.${url},name.ilike.${investor.name}`)
      .single();
    
    if (existing) {
      // Update existing investor with new data
      const { data: updated, error } = await supabase
        .from('investors')
        .update(investor)
        .eq('id', existing.id)
        .select()
        .single();
      
      console.log(`🔄 Updated investor: ${investor.name}`);
      return updated;
    }
    
    // Insert new investor
    const { data: inserted, error } = await supabase
      .from('investors')
      .insert(investor)
      .select()
      .single();
    
    if (error) {
      console.error('❌ Insert error:', error.message);
      return null;
    }
    
    console.log(`✅ Saved investor: ${investor.name} (ID: ${inserted.id})`);
    return inserted;
    
  } catch (error) {
    console.error(`❌ Parse error: ${error.message}`);
    return null;
  }
}

/**
 * Batch scrape multiple URLs
 */
async function batchScrape(urls, type = 'startup') {
  console.log(`\n📦 Batch scraping ${urls.length} ${type}s...\n`);
  
  const results = {
    success: [],
    failed: [],
    duplicates: []
  };
  
  for (const url of urls) {
    try {
      const result = type === 'investor' 
        ? await parseAndSaveInvestor(url)
        : await parseAndSaveStartup(url);
      
      if (result?.duplicate) {
        results.duplicates.push(url);
      } else if (result) {
        results.success.push(result);
      } else {
        results.failed.push(url);
      }
      
      // Rate limit: 2 seconds between requests
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (error) {
      results.failed.push(url);
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 BATCH SCRAPE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Success:    ${results.success.length}`);
  console.log(`⏭️  Duplicates: ${results.duplicates.length}`);
  console.log(`❌ Failed:     ${results.failed.length}`);
  console.log('═'.repeat(60) + '\n');
  
  return results;
}

/**
 * Parse news article for funding announcements
 */
async function parseNewsArticle(url) {
  console.log(`\n📰 Parsing news article: ${url}`);
  
  try {
    const data = await parser.parse(url, 'funding_news');
    
    if (!data) {
      console.log('⚠️  No valid funding news extracted');
      return null;
    }
    
    console.log('📊 Funding news extracted:', JSON.stringify(data, null, 2));
    return data;
    
  } catch (error) {
    console.error(`❌ Parse error: ${error.message}`);
    return null;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🚀 ENHANCED SCRAPER - Dynamic Parser Integration

Usage:
  node lib/enhanced-scraper.js <url> [type]
  node lib/enhanced-scraper.js batch <file> [type]

Types: startup, investor, news

Examples:
  node lib/enhanced-scraper.js https://stripe.com startup
  node lib/enhanced-scraper.js https://a16z.com investor
  node lib/enhanced-scraper.js batch urls.txt startup
`);
    process.exit(0);
  }
  
  const [urlOrCmd, typeOrFile, batchType] = args;
  
  if (urlOrCmd === 'batch') {
    const fs = require('fs');
    const urls = fs.readFileSync(typeOrFile, 'utf-8')
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && u.startsWith('http'));
    
    batchScrape(urls, batchType || 'startup').catch(console.error);
  } else {
    const type = typeOrFile || 'startup';
    
    if (type === 'investor') {
      parseAndSaveInvestor(urlOrCmd).catch(console.error);
    } else if (type === 'news') {
      parseNewsArticle(urlOrCmd).catch(console.error);
    } else {
      parseAndSaveStartup(urlOrCmd).catch(console.error);
    }
  }
}

module.exports = {
  parseAndSaveStartup,
  parseAndSaveInvestor,
  batchScrape,
  parseNewsArticle,
  normalizeSector,
  normalizeStage
};
