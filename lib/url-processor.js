/**
 * URL PROCESSOR - Smart URL Resolution & Classification
 * =====================================================
 * 
 * Handles URL processing for scrapers with intelligent classification:
 * 1. Is this URL new or does it already exist?
 * 2. Is this a company URL or a news article?
 * 3. Should we extract startup info from this URL?
 * 4. Is this URL in a quote/expression we should ignore?
 * 
 * USAGE:
 *   const processor = require('./lib/url-processor');
 *   const result = await processor.processUrl(url, context);
 *   
 *   if (result.action === 'CREATE_STARTUP') { ... }
 *   if (result.action === 'SKIP') { console.log(result.reason); }
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════════════════
// URL CLASSIFICATION - Determine URL type
// ═══════════════════════════════════════════════════════════════════════════

/**
 * News/Media domains that contain articles ABOUT startups (not startup sites)
 */
const NEWS_DOMAINS = new Set([
  // Tech news
  'techcrunch.com', 'venturebeat.com', 'theverge.com', 'wired.com',
  'arstechnica.com', 'engadget.com', 'gizmodo.com', 'mashable.com',
  'cnet.com', 'zdnet.com', 'thenextweb.com', 'techdirt.com',
  
  // Business news
  'bloomberg.com', 'reuters.com', 'ft.com', 'wsj.com', 'forbes.com',
  'fortune.com', 'businessinsider.com', 'cnbc.com', 'economist.com',
  'inc.com', 'fastcompany.com', 'entrepreneur.com',
  
  // Startup-focused news
  'crunchbase.com', 'news.crunchbase.com', 'pitchbook.com',
  'eu-startups.com', 'sifted.eu', 'techeu.com', 'tech.eu',
  'geekwire.com', 'axios.com', 'protocol.com',
  
  // General news
  'nytimes.com', 'washingtonpost.com', 'theguardian.com',
  'bbc.com', 'bbc.co.uk', 'cnn.com', 'apnews.com',
  
  // Social/community
  'twitter.com', 'x.com', 'linkedin.com', 'facebook.com',
  'reddit.com', 'news.ycombinator.com', 'medium.com', 'substack.com',
  
  // VC/investor blogs (contain deal announcements, not startup sites)
  'a16z.com', 'sequoiacap.com', 'greylock.com', 'accel.com',
  'benchmark.com', 'kpcb.com', 'nea.com', 'ggvc.com',
  
  // Other media
  'youtube.com', 'vimeo.com', 'podcasts.apple.com',
  'coindesk.com', 'decrypt.co', 'theblock.co',
]);

/**
 * Domains that are definitely NOT startup sites
 */
const SKIP_DOMAINS = new Set([
  // CDNs and infrastructure
  'cloudflare.com', 'amazonaws.com', 'googleusercontent.com',
  'githubusercontent.com', 'jsdelivr.net', 'unpkg.com',
  
  // Common services
  'google.com', 'apple.com', 'microsoft.com', 'amazon.com',
  'github.com', 'gitlab.com', 'bitbucket.org',
  'notion.so', 'figma.com', 'miro.com', 'slack.com',
  
  // Analytics/tracking
  'mixpanel.com', 'segment.com', 'amplitude.com',
  'hotjar.com', 'fullstory.com', 'heap.io',
  
  // Documentation sites
  'docs.google.com', 'drive.google.com', 'dropbox.com',
  'readthedocs.io', 'gitbook.io',
  
  // Email providers
  'gmail.com', 'outlook.com', 'mail.google.com',
]);

/**
 * Patterns that indicate URL is in a quote or expression (ignore these)
 */
const QUOTE_CONTEXT_PATTERNS = [
  // Quoted text
  /"[^"]*https?:\/\/[^"]*"/,
  /'[^']*https?:\/\/[^']*'/,
  /「[^」]*https?:\/\/[^」]*」/,
  
  // Code blocks
  /`[^`]*https?:\/\/[^`]*`/,
  /```[\s\S]*?https?:\/\/[\s\S]*?```/,
  
  // Example/placeholder patterns
  /example\.com|test\.com|foo\.com|bar\.com|example\.org/i,
  /your-?domain|your-?company|your-?startup|mydomain|mycompany/i,
  
  // Documentation references
  /see:?\s+https?:\/\//i,
  /documentation:?\s+https?:\/\//i,
  /source:?\s+https?:\/\//i,
];

/**
 * Semantic expressions that wrap URLs (extract the URL differently)
 */
const SEMANTIC_EXPRESSIONS = [
  // "startup X (website.com)" patterns
  { pattern: /(\w[\w\s]+)\s*\((?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})\)/gi, type: 'company_mention' },
  
  // "funded by Y at website.com"
  { pattern: /funded\s+by\s+(\w+[\w\s]*)\s+at\s+(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/gi, type: 'funding_mention' },
  
  // "startup website.com raised"
  { pattern: /(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})\s+raised/gi, type: 'funding_news' },
  
  // "X, a startup building Y, at website.com"
  { pattern: /(\w+),\s+a\s+startup\s+.+?,\s+(?:at\s+)?(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/gi, type: 'description_mention' },
];

// ═══════════════════════════════════════════════════════════════════════════
// URL NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canonicalize URL for consistent storage
 */
function canonicalizeUrl(url) {
  if (!url) return null;
  
  try {
    let urlToParse = url.trim();
    if (!/^https?:\/\//i.test(urlToParse)) {
      urlToParse = 'https://' + urlToParse;
    }
    
    const parsed = new URL(urlToParse);
    let hostname = parsed.hostname.toLowerCase();
    
    // Strip www.
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Get pathname, strip trailing slash
    let pathname = parsed.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Build canonical
    let canonical = hostname;
    if (pathname && pathname !== '/') {
      canonical += pathname;
    }
    
    return canonical;
  } catch {
    return url.trim().toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');
  }
}

/**
 * Extract just the domain from a URL
 */
function extractDomain(url) {
  const canonical = canonicalizeUrl(url);
  if (!canonical) return null;
  return canonical.split('/')[0].split('?')[0].split('#')[0];
}

// ═══════════════════════════════════════════════════════════════════════════
// URL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify a URL based on its domain and context
 */
function classifyUrl(url, context = {}) {
  const domain = extractDomain(url);
  if (!domain) {
    return { type: 'INVALID', reason: 'Could not extract domain' };
  }
  
  // Skip known infrastructure/service domains
  if (SKIP_DOMAINS.has(domain)) {
    return { type: 'SKIP', reason: `Infrastructure/service domain: ${domain}` };
  }
  
  // Check if it's a news article URL
  if (NEWS_DOMAINS.has(domain)) {
    return { type: 'NEWS_ARTICLE', domain, reason: `News source: ${domain}` };
  }
  
  // Check for news-like path patterns even on unknown domains
  const newsPathPatterns = [
    /\/\d{4}\/\d{2}\/\d{2}\//,  // /2024/01/15/
    /\/news\//i,
    /\/article\//i,
    /\/blog\//i,
    /\/press-release/i,
    /\/funding-round/i,
  ];
  
  for (const pattern of newsPathPatterns) {
    if (pattern.test(url)) {
      return { type: 'NEWS_ARTICLE', domain, reason: `News-like path pattern` };
    }
  }
  
  // If context suggests it's a mentioned startup website
  if (context.fromMention) {
    return { type: 'COMPANY_WEBSITE', domain, reason: 'Extracted from semantic mention' };
  }
  
  // Default: likely a company website
  return { type: 'COMPANY_WEBSITE', domain, reason: 'Default classification' };
}

/**
 * Check if URL is in a quote or expression context that should be ignored
 */
function isInQuoteContext(url, surroundingText) {
  if (!surroundingText) return false;
  
  for (const pattern of QUOTE_CONTEXT_PATTERNS) {
    if (pattern.test(surroundingText)) {
      // Check if the URL is within the matched quote
      const match = surroundingText.match(pattern);
      if (match && match[0].includes(url)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Extract URLs from semantic expressions
 */
function extractFromSemanticExpressions(text) {
  const results = [];
  
  for (const { pattern, type } of SEMANTIC_EXPRESSIONS) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        companyName: match[1]?.trim(),
        url: match[2],
        type,
        fullMatch: match[0]
      });
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE LOOKUPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a URL already exists in our database
 * Uses strict domain matching to avoid false positives
 */
async function checkUrlExists(url) {
  const canonical = canonicalizeUrl(url);
  const domain = extractDomain(url);
  
  if (!canonical || !domain) {
    return { exists: false, error: 'Invalid URL' };
  }
  
  // Skip checking if this is a known news domain
  if (NEWS_DOMAINS.has(domain)) {
    return { exists: false, domain, reason: 'News domain, not a startup' };
  }
  
  // Build patterns for domain matching - need to match the whole domain
  // e.g., "grab.com" should match "grab.com" or "www.grab.com" but not "bloomberg.com/grab"
  const domainPatterns = [
    domain,                          // grab.com
    `www.${domain}`,                // www.grab.com
    `https://${domain}`,            // https://grab.com
    `https://www.${domain}`,        // https://www.grab.com
    `http://${domain}`,             // http://grab.com
    `http://www.${domain}`,         // http://www.grab.com
  ];
  
  // Check startup_uploads (approved startups) with stricter matching
  const { data: startupMatch } = await supabase
    .from('startup_uploads')
    .select('id, name, website, status')
    .or(domainPatterns.map(p => `website.eq.${p}`).join(','))
    .limit(1);
  
  if (startupMatch && startupMatch.length > 0) {
    return {
      exists: true,
      table: 'startup_uploads',
      record: startupMatch[0],
      domain
    };
  }
  
  // Also check using ilike but with word boundaries (ends with domain)
  const { data: looseMatch } = await supabase
    .from('startup_uploads')
    .select('id, name, website, status')
    .ilike('website', `%${domain}`)
    .limit(5);
  
  // Filter loose matches to ensure domain actually matches
  if (looseMatch) {
    for (const match of looseMatch) {
      const matchDomain = extractDomain(match.website);
      if (matchDomain === domain) {
        return {
          exists: true,
          table: 'startup_uploads',
          record: match,
          domain
        };
      }
    }
  }
  
  // Check discovered_startups (pending review)
  const { data: discoveredMatch } = await supabase
    .from('discovered_startups')
    .select('id, name, website, imported_to_startups')
    .or(domainPatterns.map(p => `website.eq.${p}`).join(','))
    .limit(1);
  
  if (discoveredMatch && discoveredMatch.length > 0) {
    return {
      exists: true,
      table: 'discovered_startups',
      record: discoveredMatch[0],
      domain
    };
  }
  
  // Check entity_ontologies for known entities
  const { data: ontologyMatch } = await supabase
    .from('entity_ontologies')
    .select('id, name, entity_type, website')
    .or(domainPatterns.map(p => `website.eq.${p}`).join(','))
    .limit(1);
  
  if (ontologyMatch && ontologyMatch.length > 0) {
    return {
      exists: true,
      table: 'entity_ontologies',
      record: ontologyMatch[0],
      domain
    };
  }
  
  return { exists: false, domain };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process a URL and determine what action to take
 * 
 * @param {string} url - The URL to process
 * @param {object} context - Context about where the URL was found
 * @param {string} context.surroundingText - Text around the URL
 * @param {string} context.source - Where this URL came from (e.g., 'rss_scraper')
 * @param {boolean} context.fromMention - Whether this was extracted from a semantic mention
 * 
 * @returns {object} - Action to take
 *   { action: 'CREATE_STARTUP', url, domain, ... } - Create new startup
 *   { action: 'EXTRACT_FROM_ARTICLE', url, domain, ... } - Parse article for startups
 *   { action: 'UPDATE_EXISTING', url, existingRecord, ... } - Update existing record
 *   { action: 'SKIP', url, reason, ... } - Skip this URL
 */
async function processUrl(url, context = {}) {
  // Step 1: Check if URL is in a quote context
  if (context.surroundingText && isInQuoteContext(url, context.surroundingText)) {
    return {
      action: 'SKIP',
      url,
      reason: 'URL is in quote/example context',
      context: 'quote'
    };
  }
  
  // Step 2: Classify the URL
  const classification = classifyUrl(url, context);
  
  if (classification.type === 'INVALID') {
    return {
      action: 'SKIP',
      url,
      reason: classification.reason,
      context: 'invalid'
    };
  }
  
  if (classification.type === 'SKIP') {
    return {
      action: 'SKIP',
      url,
      domain: classification.domain,
      reason: classification.reason,
      context: 'blacklisted_domain'
    };
  }
  
  // Step 3: Check if URL already exists
  const existsCheck = await checkUrlExists(url);
  
  if (existsCheck.exists) {
    return {
      action: 'UPDATE_EXISTING',
      url,
      domain: existsCheck.domain,
      table: existsCheck.table,
      existingRecord: existsCheck.record,
      reason: `Already exists in ${existsCheck.table}`
    };
  }
  
  // Step 4: Determine action based on classification
  if (classification.type === 'NEWS_ARTICLE') {
    return {
      action: 'EXTRACT_FROM_ARTICLE',
      url,
      domain: classification.domain,
      reason: classification.reason,
      instructions: 'Parse this article to extract mentioned startup info'
    };
  }
  
  // Step 5: This is a new company website - create startup
  return {
    action: 'CREATE_STARTUP',
    url,
    domain: classification.domain,
    reason: 'New company website',
    instructions: 'Scrape this website and create startup record'
  };
}

/**
 * Process text to extract all URLs and determine actions
 * 
 * @param {string} text - Text containing URLs
 * @param {string} source - Source identifier
 * @returns {array} - Array of URL processing results
 */
async function processText(text, source = 'unknown') {
  const results = [];
  
  // First, extract URLs from semantic expressions
  const semanticUrls = extractFromSemanticExpressions(text);
  for (const semantic of semanticUrls) {
    const result = await processUrl(semantic.url, {
      source,
      surroundingText: semantic.fullMatch,
      fromMention: true,
      companyName: semantic.companyName,
      mentionType: semantic.type
    });
    
    results.push({
      ...result,
      companyName: semantic.companyName,
      mentionType: semantic.type
    });
  }
  
  // Then extract raw URLs
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const rawUrls = text.match(urlPattern) || [];
  
  for (const url of rawUrls) {
    // Skip if already processed from semantic expressions
    const alreadyProcessed = results.some(r => 
      extractDomain(r.url) === extractDomain(url)
    );
    
    if (alreadyProcessed) continue;
    
    // Get surrounding context
    const urlIndex = text.indexOf(url);
    const start = Math.max(0, urlIndex - 100);
    const end = Math.min(text.length, urlIndex + url.length + 100);
    const surroundingText = text.substring(start, end);
    
    const result = await processUrl(url, {
      source,
      surroundingText,
      fromMention: false
    });
    
    results.push(result);
  }
  
  return results;
}

/**
 * Batch process multiple URLs
 */
async function processBatch(urls, source = 'batch') {
  const results = [];
  
  for (const url of urls) {
    const result = await processUrl(url, { source });
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Log URL processing decision to ai_logs table
 */
async function logUrlDecision(result, source = 'url_processor') {
  try {
    await supabase.from('ai_logs').insert({
      type: 'url_processor',
      action: result.action,
      status: result.action === 'SKIP' ? 'skipped' : 'processed',
      output: {
        url: result.url,
        domain: result.domain,
        reason: result.reason,
        context: result.context,
        source
      }
    });
  } catch (err) {
    // Silently fail on logging errors
  }
}

/**
 * Get URL processing statistics for dashboard
 */
async function getUrlStats(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data } = await supabase
    .from('ai_logs')
    .select('action, status')
    .eq('type', 'url_processor')
    .gte('created_at', since);
  
  if (!data) return null;
  
  const stats = {
    total: data.length,
    byAction: {},
    byStatus: {}
  };
  
  for (const row of data) {
    stats.byAction[row.action] = (stats.byAction[row.action] || 0) + 1;
    stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + 1;
  }
  
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Main processing functions
  processUrl,
  processText,
  processBatch,
  
  // Utilities
  canonicalizeUrl,
  extractDomain,
  classifyUrl,
  checkUrlExists,
  isInQuoteContext,
  extractFromSemanticExpressions,
  
  // Logging
  logUrlDecision,
  getUrlStats,
  
  // Constants for external use
  NEWS_DOMAINS,
  SKIP_DOMAINS,
  QUOTE_CONTEXT_PATTERNS,
  SEMANTIC_EXPRESSIONS,
};

// ═══════════════════════════════════════════════════════════════════════════
// CLI TESTING
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const testUrls = [
    'https://grab.com',                                    // Should: CREATE_STARTUP (if new)
    'https://techcrunch.com/2024/01/15/startup-raises',   // Should: EXTRACT_FROM_ARTICLE
    'https://bloomberg.com/news/articles/funding',        // Should: EXTRACT_FROM_ARTICLE
    'https://example.com',                                // Should: SKIP (in quote context list)
    'https://github.com/user/repo',                       // Should: SKIP (service domain)
    'https://newstartup.io',                              // Should: CREATE_STARTUP
  ];
  
  const testText = `
    Check out Acme Corp (acmecorp.com) who just raised $5M.
    Read more at https://techcrunch.com/2024/01/15/acme-funding
    The code example is: \`const url = "https://example.com"\`
  `;
  
  (async () => {
    console.log('═'.repeat(60));
    console.log('URL PROCESSOR - Test Run');
    console.log('═'.repeat(60));
    
    console.log('\n📍 Testing individual URLs:\n');
    for (const url of testUrls) {
      const result = await processUrl(url, { source: 'test' });
      console.log(`${result.action.padEnd(20)} | ${url}`);
      console.log(`   Reason: ${result.reason}`);
    }
    
    console.log('\n📍 Testing text extraction:\n');
    const textResults = await processText(testText, 'test');
    for (const result of textResults) {
      console.log(`${result.action.padEnd(20)} | ${result.url}`);
      if (result.companyName) console.log(`   Company: ${result.companyName}`);
      console.log(`   Reason: ${result.reason}`);
    }
    
    console.log('\n═'.repeat(60));
  })();
}
