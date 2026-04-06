/**
 * Simple RSS Scraper - No AI Required
 * Extracts startup names from funding news headlines using regex patterns
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const { shouldProcessEvent } = require('../lib/source-quality-filter');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
});

// Funding patterns to match in headlines
const FUNDING_PATTERNS = [
  /^([A-Z][A-Za-z0-9\s]+?)\s+raises?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /^([A-Z][A-Za-z0-9\s]+?)\s+secures?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /^([A-Z][A-Za-z0-9\s]+?)\s+closes?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /^([A-Z][A-Za-z0-9\s]+?)\s+lands?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /^([A-Z][A-Za-z0-9\s]+?)\s+gets?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /^([A-Z][A-Za-z0-9\s]+?)\s+nabs?\s+\$?([\d.]+)\s*(million|m|billion|b)/i,
  /\$?([\d.]+)\s*(million|m|billion|b)\s+for\s+([A-Z][A-Za-z0-9\s]+)/i,
  /([A-Z][A-Za-z0-9\s]+?)\s+funding\s+round/i,
  /Series\s+[A-Z]\s+for\s+([A-Z][A-Za-z0-9\s]+)/i,
];

// Stage patterns
const STAGE_PATTERNS = {
  'Pre-Seed': /pre-?seed/i,
  'Seed': /\bseed\b/i,
  'Series A': /series\s*a\b/i,
  'Series B': /series\s*b\b/i,
  'Series C': /series\s*c\b/i,
  'Series D+': /series\s*[d-z]\b/i,
};

// Sector keywords
const SECTOR_KEYWORDS = {
  'AI/ML': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'llm', 'gpt', 'neural'],
  'FinTech': ['fintech', 'banking', 'payments', 'finance', 'lending', 'crypto', 'blockchain'],
  'HealthTech': ['health', 'medical', 'biotech', 'pharma', 'healthcare', 'clinical'],
  'SaaS': ['saas', 'software', 'cloud', 'enterprise', 'b2b'],
  'E-commerce': ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'shopping'],
  'CleanTech': ['clean', 'climate', 'energy', 'solar', 'ev', 'sustainability', 'green'],
  'EdTech': ['education', 'edtech', 'learning', 'school', 'student'],
  'Cybersecurity': ['security', 'cyber', 'privacy', 'encryption'],
};

function extractStartupInfo(title, description = '') {
  const combined = `${title} ${description}`.toLowerCase();
  
  // Try to extract startup name and funding amount
  let startupName = null;
  let fundingAmount = null;
  
  for (const pattern of FUNDING_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      // Different patterns have name in different positions
      if (match[3] && /million|billion|m|b/i.test(match[2])) {
        startupName = match[1].trim();
        const amount = parseFloat(match[2]);
        const multiplier = /billion|b/i.test(match[3]) ? 1000000000 : 1000000;
        fundingAmount = amount * multiplier;
      } else if (match[3]) {
        startupName = match[3].trim();
      } else if (match[1]) {
        startupName = match[1].trim();
      }
      break;
    }
  }
  
  if (!startupName) return null;
  
  // Clean up startup name
  startupName = startupName
    .replace(/\s+(raises?|secures?|closes?|lands?|gets?|nabs?|announces?).*/i, '')
    .replace(/[,.:;!?]+$/, '')
    .trim();
  
  // Skip if name is too short or too long
  if (startupName.length < 2 || startupName.length > 50) return null;
  
  // Skip common false positives
  const skipWords = ['the', 'a', 'an', 'this', 'that', 'new', 'latest', 'how', 'why', 'what'];
  if (skipWords.includes(startupName.toLowerCase())) return null;
  
  // Extract stage
  let stage = 'Unknown';
  for (const [stageName, pattern] of Object.entries(STAGE_PATTERNS)) {
    if (pattern.test(combined)) {
      stage = stageName;
      break;
    }
  }
  
  // Extract sectors
  const sectors = [];
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      sectors.push(sector);
    }
  }
  if (sectors.length === 0) sectors.push('Technology');
  
  return {
    name: startupName,
    funding_amount: fundingAmount,
    stage,
    sectors: sectors.slice(0, 3),
    description: description?.slice(0, 500) || title,
  };
}

async function scrapeRSS() {
  console.log('🚀 Simple RSS Scraper (No AI)');
  console.log('═'.repeat(60));
  
  // Get active RSS sources
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('*')
    .eq('active', true)
    .limit(20);
  
  console.log(`📡 Found ${sources?.length || 0} active RSS sources\n`);
  
  let totalFound = 0;
  let totalAdded = 0;
  let totalSkipped = 0;
  
  for (const source of sources || []) {
    try {
      console.log(`📰 ${source.name}`);
      console.log(`   ${source.url}`);
      
      const feed = await parser.parseURL(source.url);
      const items = feed.items?.slice(0, 10) || [];
      
      let sourceFound = 0;
      let sourceAdded = 0;
      
      for (const item of items) {
        if (!item.title || !shouldProcessEvent(item.title, source.name).keep) {
          continue;
        }

        const info = extractStartupInfo(item.title, item.contentSnippet || item.content);
        
        if (info) {
          sourceFound++;
          totalFound++;
          
          // Check if already exists
          const { data: existing } = await supabase
            .from('discovered_startups')
            .select('id')
            .ilike('name', info.name)
            .limit(1);
          
          if (existing?.length > 0) {
            totalSkipped++;
            continue;
          }
          
          // Also check startup_uploads
          const { data: approved } = await supabase
            .from('startup_uploads')
            .select('id')
            .ilike('name', info.name)
            .limit(1);
          
          if (approved?.length > 0) {
            totalSkipped++;
            continue;
          }
          
          // Add to discovered_startups
          const { error } = await supabase.from('discovered_startups').insert({
            name: info.name,
            description: info.description,
            sectors: info.sectors,
            stage: info.stage,
            funding_amount: info.funding_amount,
            source: source.url,
            source_url: item.link,
            discovered_at: new Date().toISOString(),
          });
          
          if (!error) {
            sourceAdded++;
            totalAdded++;
            console.log(`   ✅ Added: ${info.name} (${info.stage})`);
          }
        }
      }
      
      console.log(`   📊 Found: ${sourceFound} | Added: ${sourceAdded}\n`);
      
      // Update last_scraped
      await supabase
        .from('rss_sources')
        .update({ last_scraped: new Date().toISOString() })
        .eq('id', source.id);
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }
  
  console.log('═'.repeat(60));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Found: ${totalFound}`);
  console.log(`   Added: ${totalAdded}`);
  console.log(`   Skipped (duplicates): ${totalSkipped}`);
  console.log('═'.repeat(60));
}

scrapeRSS().catch(console.error);
