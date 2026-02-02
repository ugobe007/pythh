#!/usr/bin/env node
/**
 * Universal HTML Startup Scraper
 * 
 * Scrapes startup directories from universities and accelerators:
 * - YC Companies (ycombinator.com)
 * - Princeton Innovation
 * - Bristol University Spin-outs
 * - Waterloo Engineering Startups
 * - Stanford SPARK
 * - VentureRadar
 * 
 * Architecture:
 * 1. Fetch HTML page
 * 2. Parse with site-specific extractor
 * 3. Enrich with INFERENCE EXTRACTOR (no AI needed!)
 * 4. Validate with ONTOLOGY SYSTEM
 * 5. Save to startup_uploads via scraper-db
 * 
 * Run: node scripts/scrapers/html-startup-scraper.js
 * Schedule: pm2 start with cron every 6 hours
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const https = require('https');
const http = require('http');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Import inference extractor for structured data extraction
let extractInferenceData;
try {
  const inferenceExtractor = require('../../lib/inference-extractor.js');
  extractInferenceData = inferenceExtractor.extractInferenceData;
  console.log('✅ Inference extractor loaded');
} catch (e) {
  console.log('⚠️  Inference extractor not available, using basic extraction');
  extractInferenceData = null;
}

// ====================================================================
// CONFIGURATION
// ====================================================================

const CONFIG = {
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  REQUEST_TIMEOUT: 30000,
  RATE_LIMIT_DELAY: 2000,  // 2 seconds between requests
  MAX_STARTUPS_PER_SOURCE: 500,
  BATCH_SIZE: 50,
};

// ====================================================================
// ONTOLOGY CACHE (for semantic validation)
// ====================================================================

let ONTOLOGY_CACHE = new Map();

async function loadOntology() {
  const { data: entities } = await supabase
    .from('entity_ontologies')
    .select('entity_name, entity_type')
    .in('entity_type', ['STARTUP', 'INVESTOR', 'GENERIC_TERM', 'PLACE']);
  
  entities?.forEach(e => {
    ONTOLOGY_CACHE.set(e.entity_name.toLowerCase(), e.entity_type);
  });
  
  console.log(`📚 Loaded ${ONTOLOGY_CACHE.size} ontology entities`);
}

function isGenericTerm(name) {
  if (!name) return true;
  
  // Check ontology first
  const entry = ONTOLOGY_CACHE.get(name.toLowerCase());
  if (entry === 'GENERIC_TERM' || entry === 'PLACE') return true;
  
  // Heuristic patterns for junk names
  const junkPatterns = [
    /^(the|a|an)\s+/i,
    /^(your|my|our|their)\s+/i,
    /\b(for you|to you)\b/i,
    /^(please|click|submit|form|download)/i,
    /^[0-9.,\s$%]+$/,  // Just numbers
    /^\W+$/,  // Just symbols
  ];
  
  return name.length < 2 || name.length > 100 || junkPatterns.some(p => p.test(name));
}

// ====================================================================
// SITE-SPECIFIC PARSERS
// ====================================================================

const SITE_PARSERS = {
  // Y Combinator Companies
  'ycombinator.com': {
    name: 'YC Companies',
    parse: ($, url) => {
      const startups = [];
      
      // YC directory page structure
      $('a[href*="/companies/"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const name = $el.text().trim();
        
        if (name && href && !href.includes('/companies/industry/') && !href.includes('/companies?')) {
          const website = `https://www.ycombinator.com${href}`;
          const description = $el.parent().find('.text-gray-500, .description').text().trim();
          
          startups.push({
            name: cleanName(name),
            website,
            description: description || `Y Combinator startup`,
            source: 'Y Combinator',
            sectors: ['Technology'],
          });
        }
      });
      
      // Alternative: card-based layout
      $('.company-card, [data-company]').each((_, el) => {
        const $el = $(el);
        const name = $el.find('.company-name, h3, h4').first().text().trim();
        const website = $el.find('a[href^="http"]').attr('href') || $el.find('a').attr('href');
        const description = $el.find('.description, p').first().text().trim();
        const tags = [];
        $el.find('.tag, .badge, .pill').each((_, tag) => tags.push($(tag).text().trim()));
        
        if (name && !startups.find(s => s.name === name)) {
          startups.push({
            name: cleanName(name),
            website: website || '',
            description: description || `Y Combinator startup`,
            source: 'Y Combinator',
            sectors: tags.length > 0 ? tags : ['Technology'],
          });
        }
      });
      
      return startups;
    }
  },
  
  // Extruct.ai YC Data Room
  'extruct.ai': {
    name: 'Extruct YC Data',
    parse: ($, url) => {
      const startups = [];
      
      // Table rows
      $('table tbody tr, .startup-row').each((_, el) => {
        const $el = $(el);
        const cells = $el.find('td');
        
        if (cells.length >= 2) {
          const name = $(cells[0]).text().trim();
          const website = $el.find('a[href^="http"]').attr('href') || '';
          const description = $(cells[1]).text().trim();
          const batch = $el.find('[data-batch], .batch').text().trim() || '';
          
          if (name && name.length > 1) {
            startups.push({
              name: cleanName(name),
              website,
              description: description || `YC ${batch} startup`,
              source: `Extruct - YC ${batch}`,
              sectors: detectSectors(description),
            });
          }
        }
      });
      
      // Card layout
      $('.company-card, .startup-card, [data-startup]').each((_, el) => {
        const $el = $(el);
        const name = $el.find('.name, h3, h4, .title').first().text().trim();
        const website = $el.find('a[href^="http"]').attr('href') || '';
        const description = $el.find('.description, .tagline, p').first().text().trim();
        
        if (name && !startups.find(s => s.name === name)) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'YC startup',
            source: 'Extruct YC Data',
            sectors: detectSectors(description),
          });
        }
      });
      
      return startups;
    }
  },
  
  // Princeton Innovation
  'innovation.princeton.edu': {
    name: 'Princeton Startups',
    parse: ($, url) => {
      const startups = [];
      
      // Startup cards/listings
      $('.startup, .company, .spinout, article, .card').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
        const website = $el.find('a[href^="http"]').attr('href') || '';
        const description = $el.find('p, .description, .summary').first().text().trim();
        
        if (name && name.length > 1) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'Princeton spinout',
            source: 'Princeton Innovation',
            sectors: detectSectors(description),
          });
        }
      });
      
      // List format
      $('ul li, .list-item').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const link = $el.find('a').attr('href') || '';
        const name = $el.find('a').text().trim() || text.split('-')[0].trim();
        
        if (name && name.length > 2 && name.length < 100) {
          startups.push({
            name: cleanName(name),
            website: link.startsWith('http') ? link : '',
            description: text,
            source: 'Princeton Innovation',
            sectors: detectSectors(text),
          });
        }
      });
      
      return startups;
    }
  },
  
  // Bristol University
  'bristol.ac.uk': {
    name: 'Bristol Spin-outs',
    parse: ($, url) => {
      const startups = [];
      
      // Company listings
      $('.company, .spin-out, .spinout, .startup, article').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h2, h3, h4, .title, .name, a').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="bristol.ac.uk"]').attr('href') || '';
        const description = $el.find('p, .description').first().text().trim();
        
        if (name && name.length > 1) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'Bristol University spin-out',
            source: 'Bristol University',
            sectors: detectSectors(description),
          });
        }
      });
      
      // Table format
      $('table tbody tr').each((_, el) => {
        const $el = $(el);
        const cells = $el.find('td');
        if (cells.length >= 1) {
          const name = $(cells[0]).text().trim();
          const website = $el.find('a[href^="http"]').attr('href') || '';
          const description = cells.length > 1 ? $(cells[1]).text().trim() : '';
          
          if (name && name.length > 1) {
            startups.push({
              name: cleanName(name),
              website,
              description: description || 'Bristol University spin-out',
              source: 'Bristol University',
              sectors: detectSectors(description),
            });
          }
        }
      });
      
      return startups;
    }
  },
  
  // Waterloo Engineering
  'uwaterloo.ca': {
    name: 'Waterloo Startups',
    parse: ($, url) => {
      const startups = [];
      
      // Startup listings
      $('.startup, .company, article, .card, .list-item').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h2, h3, h4, .title, .name, a').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="uwaterloo.ca"]').attr('href') || '';
        const description = $el.find('p, .description').first().text().trim();
        
        if (name && name.length > 1 && name.length < 100) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'University of Waterloo startup',
            source: 'University of Waterloo',
            sectors: detectSectors(description),
          });
        }
      });
      
      // Table format (common for university lists)
      $('table tbody tr').each((_, el) => {
        const $el = $(el);
        const cells = $el.find('td');
        if (cells.length >= 1) {
          const name = $(cells[0]).text().trim() || $el.find('a').first().text().trim();
          const website = $el.find('a[href^="http"]').attr('href') || '';
          const description = cells.length > 1 ? $(cells.slice(1)).text().trim() : '';
          
          if (name && name.length > 1 && name.length < 100) {
            startups.push({
              name: cleanName(name),
              website,
              description: description || 'University of Waterloo startup',
              source: 'University of Waterloo',
              sectors: detectSectors(description),
            });
          }
        }
      });
      
      return startups;
    }
  },
  
  // Stanford SPARK
  'sparkmed.stanford.edu': {
    name: 'Stanford SPARK',
    parse: ($, url) => {
      const startups = [];
      
      $('.startup, .company, .project, article, .card').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h2, h3, h4, .title, .name').first().text().trim();
        const website = $el.find('a[href^="http"]').not('[href*="stanford.edu"]').attr('href') || '';
        const description = $el.find('p, .description').first().text().trim();
        
        if (name && name.length > 1) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'Stanford SPARK biomedical startup',
            source: 'Stanford SPARK',
            sectors: ['HealthTech', 'Biotech'],
          });
        }
      });
      
      return startups;
    }
  },
  
  // VentureRadar
  'ventureradar.com': {
    name: 'VentureRadar',
    parse: ($, url) => {
      const startups = [];
      
      // Blog post format - extract from article content
      $('article p, .content p, .entry-content p').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Look for company mentions with bold/strong names
        $el.find('strong, b, a').each((_, nameEl) => {
          const name = $(nameEl).text().trim();
          const website = $(nameEl).attr('href') || '';
          
          if (name && name.length > 1 && name.length < 50 && !name.includes('http')) {
            startups.push({
              name: cleanName(name),
              website: website.startsWith('http') ? website : '',
              description: text.slice(0, 300),
              source: 'VentureRadar',
              sectors: detectSectors(text),
            });
          }
        });
      });
      
      // List format
      $('ol li, ul li').each((_, el) => {
        const $el = $(el);
        const name = $el.find('strong, b, a').first().text().trim() || $el.text().split('-')[0].trim();
        const website = $el.find('a[href^="http"]').attr('href') || '';
        const description = $el.text().trim();
        
        if (name && name.length > 1 && name.length < 50 && !startups.find(s => s.name === name)) {
          startups.push({
            name: cleanName(name),
            website,
            description: description.slice(0, 300),
            source: 'VentureRadar',
            sectors: detectSectors(description),
          });
        }
      });
      
      return startups;
    }
  },
  
  // Generic fallback parser
  'default': {
    name: 'Generic HTML',
    parse: ($, url) => {
      const startups = [];
      
      // Try common patterns
      $('article, .card, .company, .startup, .listing, .item').each((_, el) => {
        const $el = $(el);
        const name = $el.find('h1, h2, h3, h4, .title, .name').first().text().trim();
        const website = $el.find('a[href^="http"]').attr('href') || '';
        const description = $el.find('p, .description, .summary').first().text().trim();
        
        if (name && name.length > 1 && name.length < 100) {
          startups.push({
            name: cleanName(name),
            website,
            description: description || 'Discovered startup',
            source: 'HTML Scrape',
            sectors: detectSectors(description),
          });
        }
      });
      
      // Table format
      $('table tbody tr').each((_, el) => {
        const $el = $(el);
        const cells = $el.find('td');
        if (cells.length >= 1) {
          const name = $(cells[0]).text().trim();
          const website = $el.find('a[href^="http"]').attr('href') || '';
          
          if (name && name.length > 1 && name.length < 100) {
            startups.push({
              name: cleanName(name),
              website,
              description: 'Discovered startup',
              source: 'HTML Scrape',
              sectors: ['Technology'],
            });
          }
        }
      });
      
      return startups;
    }
  }
};

// ====================================================================
// HELPER FUNCTIONS
// ====================================================================

function cleanName(name) {
  return name
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.&']/g, '')
    .trim()
    .slice(0, 100);
}

function detectSectors(text) {
  if (!text) return ['Technology'];
  
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'llm', 'deep learning', 'neural', 'nlp', 'computer vision'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments', 'lending', 'insurance', 'insurtech'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'clinical', 'patient', 'diagnosis', 'therapeutic'],
    'Biotech': ['biotech', 'biotechnology', 'pharmaceutical', 'drug', 'genomics', 'protein'],
    'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon', 'renewable', 'energy', 'solar', 'battery'],
    'E-commerce': ['ecommerce', 'e-commerce', 'marketplace', 'retail', 'shopping'],
    'EdTech': ['edtech', 'education', 'learning', 'school', 'student', 'teaching'],
    'Cybersecurity': ['security', 'cybersecurity', 'encryption', 'privacy', 'authentication'],
    'Hardware': ['hardware', 'device', 'sensor', 'robotics', 'iot', 'manufacturing'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors.slice(0, 3) : ['Technology'];
}

function getParserForUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    
    for (const [domain, parser] of Object.entries(SITE_PARSERS)) {
      if (domain !== 'default' && hostname.includes(domain)) {
        return parser;
      }
    }
    
    return SITE_PARSERS.default;
  } catch {
    return SITE_PARSERS.default;
  }
}

async function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: CONFIG.REQUEST_TIMEOUT,
    };
    
    const req = protocol.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location).then(resolve).catch(reject);
        return;
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ====================================================================
// DATABASE OPERATIONS
// ====================================================================

async function saveStartup(startup) {
  try {
    // ONTOLOGY VALIDATION: Skip generic/junk names
    if (isGenericTerm(startup.name)) {
      return { status: 'skipped', reason: 'generic_name' };
    }
    
    // Check if startup already exists by name or website
    const { data: existing } = await supabase
      .from('startup_uploads')
      .select('id, name')
      .or(`name.ilike.${startup.name},website.eq.${startup.website}`)
      .limit(1);
    
    if (existing && existing.length > 0) {
      return { status: 'exists', id: existing[0].id };
    }
    
    // INFERENCE EXTRACTION: Get structured data from description
    let extractedData = {};
    let inferredSectors = startup.sectors || ['Technology'];
    
    if (extractInferenceData && startup.description) {
      try {
        extractedData = extractInferenceData(
          `${startup.name} ${startup.description}`,
          startup.website
        );
        
        // Use inferred sectors if better than generic
        if (extractedData.sectors && extractedData.sectors.length > 0) {
          inferredSectors = extractedData.sectors;
        }
        
        console.log(`   ✓ Inference extracted for ${startup.name}: sectors=${inferredSectors.join(', ')}`);
      } catch (e) {
        // Silently continue without inference
      }
    }
    
    // Insert new startup with inference data
    const { data, error } = await supabase
      .from('startup_uploads')
      .insert({
        name: startup.name,
        website: startup.website || null,
        description: startup.description?.slice(0, 1000) || null,
        pitch: startup.description?.slice(0, 500) || null,
        tagline: startup.description?.slice(0, 200) || null,
        sectors: inferredSectors,
        status: 'pending',
        source_type: 'scraper',
        source_url: startup.sourceUrl,
        total_god_score: 50,  // Default score, will be recalculated
        extracted_data: Object.keys(extractedData).length > 0 ? extractedData : null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (error) {
      if (error.code === '23505') {
        return { status: 'duplicate', error: error.message };
      }
      return { status: 'error', error: error.message };
    }
    
    return { status: 'created', id: data.id };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function getHtmlSources() {
  const { data } = await supabase
    .from('rss_sources')
    .select('id, name, url, category, last_scraped')
    .eq('active', true)
    .in('category', ['university', 'accelerator', 'html', 'directory'])
    .order('last_scraped', { ascending: true, nullsFirst: true });
  
  return data || [];
}

async function updateSourceLastScraped(sourceId) {
  await supabase
    .from('rss_sources')
    .update({ last_scraped: new Date().toISOString() })
    .eq('id', sourceId);
}

// ====================================================================
// MAIN SCRAPER
// ====================================================================

async function scrapeSource(source) {
  console.log(`\n🔍 Scraping: ${source.name}`);
  console.log(`   URL: ${source.url}`);
  
  const parser = getParserForUrl(source.url);
  console.log(`   Parser: ${parser.name}`);
  
  try {
    // Fetch HTML
    const html = await fetchHtml(source.url);
    console.log(`   Fetched ${(html.length / 1024).toFixed(1)} KB`);
    
    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // Extract startups using site-specific parser
    let startups = parser.parse($, source.url);
    
    // Deduplicate by name
    const seen = new Set();
    startups = startups.filter(s => {
      if (seen.has(s.name.toLowerCase())) return false;
      seen.add(s.name.toLowerCase());
      return true;
    });
    
    console.log(`   Found ${startups.length} startups`);
    
    // Limit per source
    startups = startups.slice(0, CONFIG.MAX_STARTUPS_PER_SOURCE);
    
    // Save to database
    let created = 0, exists = 0, errors = 0;
    
    for (const startup of startups) {
      startup.sourceUrl = source.url;
      const result = await saveStartup(startup);
      
      if (result.status === 'created') {
        created++;
      } else if (result.status === 'exists' || result.status === 'duplicate') {
        exists++;
      } else {
        errors++;
        if (errors <= 3) {
          console.log(`   ⚠️  ${startup.name}: ${result.error}`);
        }
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 50));
    }
    
    console.log(`   ✅ Created: ${created} | Exists: ${exists} | Errors: ${errors}`);
    
    // Update last scraped
    await updateSourceLastScraped(source.id);
    
    return { created, exists, errors, total: startups.length };
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    return { created: 0, exists: 0, errors: 1, total: 0 };
  }
}

async function main() {
  console.log('🌐 Universal HTML Startup Scraper');
  console.log('='.repeat(50));
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  // Load ontology for semantic validation
  await loadOntology();
  
  // Get HTML sources
  const sources = await getHtmlSources();
  
  if (sources.length === 0) {
    console.log('No HTML sources found in rss_sources table.');
    console.log('Add sources with category = "university", "accelerator", or "html"');
    return;
  }
  
  console.log(`Found ${sources.length} HTML sources to scrape\n`);
  
  // Scrape each source
  const totals = { created: 0, exists: 0, errors: 0, total: 0 };
  
  for (const source of sources) {
    const result = await scrapeSource(source);
    totals.created += result.created;
    totals.exists += result.exists;
    totals.errors += result.errors;
    totals.total += result.total;
    
    // Rate limit between sources
    await new Promise(r => setTimeout(r, CONFIG.RATE_LIMIT_DELAY));
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log(`   Sources scraped: ${sources.length}`);
  console.log(`   Startups found:  ${totals.total}`);
  console.log(`   Created:         ${totals.created}`);
  console.log(`   Already exists:  ${totals.exists}`);
  console.log(`   Errors:          ${totals.errors}`);
  console.log(`\nCompleted: ${new Date().toISOString()}`);
}

// CLI: Allow scraping a single URL
if (process.argv[2]) {
  const url = process.argv[2];
  console.log(`Scraping single URL: ${url}\n`);
  
  fetchHtml(url).then(html => {
    const $ = cheerio.load(html);
    const parser = getParserForUrl(url);
    const startups = parser.parse($, url);
    
    console.log(`Found ${startups.length} startups:\n`);
    startups.slice(0, 20).forEach((s, i) => {
      console.log(`${i + 1}. ${s.name}`);
      console.log(`   Website: ${s.website || 'N/A'}`);
      console.log(`   Sectors: ${s.sectors.join(', ')}`);
      console.log(`   Description: ${s.description?.slice(0, 100)}...`);
      console.log();
    });
  }).catch(console.error);
} else {
  main().catch(console.error);
}
