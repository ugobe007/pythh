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

// Import LOCAL inference engine (NO AI required!)
const { 
  extractFunding, 
  extractSectors, 
  extractTeamSignals, 
  extractExecutionSignals 
} = require('../lib/inference-extractor');
const { classifyEvent } = require('../lib/event-classifier');

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

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
// LOCAL INFERENCE ENTITY EXTRACTION (NO AI - Pattern-based, zero-cost!)
// ============================================================================
function extractEntitiesWithInference(title, content, source) {
  const fullText = `${title} ${content || ''}`;
  
  // 1. Classify the event type
  const eventType = classifyEvent(title);
  
  // Skip filtered events (noise) - but be LESS aggressive
  if (eventType.type === 'FILTERED' && eventType.confidence > 0.9) {
    return { startups: [], investors: [] };
  }
  
  // 2. Extract funding data (stage, amount, investors)
  const funding = extractFunding(fullText);
  
  // 3. Extract sectors
  const sectors = extractSectors(fullText);
  
  // 4. Extract startup names - COMPREHENSIVE PATTERN MATCHING
  const startups = [];
  const investors = [];
  const foundNames = new Set();
  const founderNames = new Set(); // Track founders separately
  
  // Skip words that aren't company names
  const skipWords = new Set([
    'google', 'apple', 'microsoft', 'amazon', 'meta', 'openai', 'anthropic', 
    'nvidia', 'tesla', 'uber', 'airbnb', 'stripe', 'spacex', 'facebook', 'twitter',
    'linkedin', 'netflix', 'spotify', 'snapchat', 'tiktok', 'bytedance', 'alibaba',
    'the', 'and', 'for', 'with', 'from', 'into', 'how', 'why', 'what', 'who',
    'new', 'top', 'best', 'first', 'last', 'next', 'more', 'most', 'this', 'that',
    'series', 'seed', 'round', 'funding', 'raises', 'million', 'billion',
    'venture', 'capital', 'investor', 'investors', 'startup', 'startups',
    'company', 'companies', 'firm', 'firms', 'fund', 'funds', 'backed',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'report', 'news', 'update',
    'says', 'said', 'announces', 'announced', 'launches', 'launched', 'today',
    'here', 'there', 'will', 'can', 'could', 'should', 'would', 'may', 'might'
  ]);
  
  // Helper to add name if valid
  const addName = (name) => {
    if (!name) return;
    name = name.trim();
    if (name.length >= 2 && name.length < 50 && 
        !skipWords.has(name.toLowerCase()) && 
        !foundNames.has(name.toLowerCase()) &&
        !/^\d+$/.test(name)) { // Skip pure numbers
      foundNames.add(name.toLowerCase());
    }
  };
  
  let match;
  
  // ═══════════════════════════════════════════════════════════════════
  // FUNDING & BUSINESS PATTERNS
  // ═══════════════════════════════════════════════════════════════════
  
  // Pattern 1: "[Company] raises/secures/announces/launches/closes"
  const fundingPatterns = [
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:raises?|secures?|announces?|closes?|lands?|gets?|bags?|nabs?|snags?|grabs?)/gi,
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:has\s+)?(?:raised|secured|closed|announced|landed|received|obtained|won)/gi,
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:completes?|completed)\s+(?:\$[\d,.]+|series|seed|funding)/gi,
  ];
  
  for (const pattern of fundingPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 2: "X, a/the [type] startup/company/platform" 
  const typePatterns = [
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?),?\s+(?:a|the|an)\s+\w+\s*(?:startup|company|platform|fintech|healthtech|biotech|edtech|proptech|insurtech|regtech|legaltech|agritech|cleantech|medtech|saas|ai|ml|firm|provider|maker|developer|creator)/gi,
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?),?\s+(?:which|that|who)\s+(?:provides?|offers?|builds?|develops?|creates?|makes?|delivers?|enables?|helps?|allows?)/gi,
    /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+is\s+(?:a|the|an)\s+\w+\s*(?:startup|company|platform|solution|provider|tool)/gi,
  ];
  
  for (const pattern of typePatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 3: "backed by X" or "invested in X" or "funding for X"
  const backedPatterns = [
    /(?:backed|funded|invested\s+in|funding\s+for|acquired|acquired\s+by)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /(?:invests?\s+in|backs?|acquires?|leads?\s+round\s+(?:in|for)|bets\s+on)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /(?:portfolio\s+company|investment\s+in)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of backedPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 4: Dollar amounts with company names
  const dollarPatterns = [
    /\$[\d,.]+[MBK]?\s+(?:for|to|into|in|from)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)'?s?\s+\$[\d,.]+[MBK]?\s+(?:round|funding|raise|series|valuation|deal)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+valued\s+at\s+\$/gi,
    /(?:valued|worth|at)\s+\$[\d,.]+[MBK]?,?\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of dollarPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // FOUNDER & TEAM PATTERNS
  // ═══════════════════════════════════════════════════════════════════
  
  // Pattern 5: "founder of X" / "co-founder of X" / "CEO of X"
  const founderPatterns = [
    /(?:founder|co-founder|cofounder|ceo|cto|cfo|coo|chief\s+\w+\s+officer)\s+(?:of|at)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+),?\s+(?:founder|co-founder|cofounder|ceo)\s+(?:of|at)\s+([A-Z][a-zA-Z0-9]+)/gi,
    /(?:founded|started|launched|created|built)\s+(?:by\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?),?\s+([A-Z][a-zA-Z0-9]+)/gi,
  ];
  
  for (const pattern of founderPatterns) {
    while ((match = pattern.exec(fullText)) !== null) {
      // Get company name (last capture group typically)
      const companyName = match[2] || match[1];
      addName(companyName);
    }
  }
  
  // Pattern 6: "[Person] joins/joined [Company]" - Team hires
  const hiringPatterns = [
    /([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+(?:joins?|joined|appointed|named|hired\s+(?:by|as))\s+(?:\w+\s+)?(?:at\s+)?([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:hires?|hired|appoints?|appointed|names?|named|welcomes?|welcomed)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/gi,
    /(?:new|former)\s+(?:ceo|cto|cfo|coo|vp|president|head|director|chief)\s+(?:at|of|for)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:adds?|added|brings?|brought)\s+(?:new\s+)?(?:ceo|cto|cfo|leadership|executive|talent)/gi,
  ];
  
  for (const pattern of hiringPatterns) {
    while ((match = pattern.exec(fullText)) !== null) {
      // First group might be person, second might be company - add both and let dedup handle
      if (match[2]) addName(match[2]);
      if (match[1] && /[A-Z][a-z]+[A-Z]|(?:Tech|Labs?|AI|App|Hub|io)$/i.test(match[1])) {
        addName(match[1]); // Only add first if it looks like a company name
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // PRODUCT & VALUE PROPOSITION PATTERNS  
  // ═══════════════════════════════════════════════════════════════════
  
  // Pattern 7: "[X] developed/built/created by [Company]"
  const developedByPatterns = [
    /(?:developed|built|created|made|designed|invented|powered)\s+by\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /(?:product|platform|tool|app|solution|software|service|technology)\s+(?:from|by)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)'?s?\s+(?:new\s+)?(?:product|platform|tool|app|solution|software|service|technology|api|sdk)/gi,
  ];
  
  for (const pattern of developedByPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 8: "[Company] solves/tackles/addresses [problem]"
  const problemSolverPatterns = [
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:solves?|tackles?|addresses?|fixes?|eliminates?|reduces?|automates?|simplifies?|streamlines?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:helps?\s+)?(?:companies?|businesses?|enterprises?|users?|customers?|people|teams?)\s+(?:to\s+)?(?:solve|tackle|address|manage|handle|deal\s+with)/gi,
    /(?:solving|tackling|addressing|fixing)\s+(?:\w+\s+){0,3}(?:with|using|through)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of problemSolverPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 9: "[Company]'s mission/vision/goal" - Value proposition
  const missionPatterns = [
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)'?s?\s+(?:mission|vision|goal|aim|purpose)\s+(?:is|to)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:aims?|seeks?|wants?|plans?|intends?)\s+to/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:is\s+)?(?:disrupting|transforming|revolutionizing|reinventing|reimagining|changing)/gi,
  ];
  
  for (const pattern of missionPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // LAUNCH & GROWTH PATTERNS
  // ═══════════════════════════════════════════════════════════════════
  
  // Pattern 10: "[Company] launches/expands/grows"
  const launchPatterns = [
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:launches?|launched|expands?|expanded|grows?|grew|scales?|scaled|enters?|entered)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:goes?\s+)?(?:live|public|global|international|nationwide)/gi,
    /(?:launch(?:es|ed)?|debut(?:s|ed)?|introduction\s+of|unveil(?:s|ed)?)\s+(?:of\s+)?([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /(?:meet|introducing|welcome)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of launchPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 11: "[Company] partners with / acquires"
  const partnerPatterns = [
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:partners?\s+with|teams?\s+up\s+with|collaborates?\s+with|joins?\s+forces?\s+with)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:acquires?|acquired|buys?|bought|merges?\s+with)/gi,
    /(?:partnership|collaboration|deal|agreement)\s+(?:between|with)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of partnerPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // NAMING CONVENTION PATTERNS
  // ═══════════════════════════════════════════════════════════════════
  
  // Pattern 12: CamelCase names (common for startups)
  const camelCasePattern = /\b([A-Z][a-z]+[A-Z][a-zA-Z0-9]*)\b/g;
  while ((match = camelCasePattern.exec(title)) !== null) addName(match[1]);
  
  // Pattern 13: Names ending with common startup suffixes
  const suffixPattern = /\b([A-Z][a-zA-Z0-9]*(?:ly|fy|sy|zy|io|ai|\.ai|\.io|\.co|\.xyz|Labs?|Tech|Hub|App|Box|Bot|Bit|Pay|Go|Up|Me|It|Us|We|One|Now|Pro|Max|Flex|Flow|Dash|Loop|Wave|Link|Grid|Base|Nest|Mind|Wise|Path|Pulse|Stack|Cloud|Data|Edge|Core|Ware|Soft))\b/gi;
  while ((match = suffixPattern.exec(fullText)) !== null) addName(match[1]);
  
  // Pattern 14: Quoted company names "Company Name"
  const quotedPattern = /["']([A-Z][a-zA-Z0-9\s]+?)["']/g;
  while ((match = quotedPattern.exec(title)) !== null) {
    const name = match[1].trim();
    if (name.length >= 2 && name.length < 30) addName(name);
  }
  
  // Pattern 15: Y Combinator / accelerator mentions
  const acceleratorPatterns = [
    /(?:YC|Y\s*Combinator|Techstars|500\s*Startups|Plug\s*and\s*Play|MassChallenge)\s+(?:startup|company|alum|batch|graduate)\s+([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?),?\s+(?:a|an)?\s*(?:YC|Y\s*Combinator|Techstars|500\s*Startups)\s+(?:startup|company|alum|backed)/gi,
  ];
  
  for (const pattern of acceleratorPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Pattern 16: Industry news patterns - "[Company] in the news"
  const newsPatterns = [
    /(?:watch|spotlight|profile|feature|interview)\s+(?:on|with)?\s*:?\s*([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
    /([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:featured|profiled|spotlighted|highlighted|showcased)\s+(?:in|on|at)/gi,
    /(?:exclusive|breaking|first\s+look)\s*:?\s*([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)/gi,
  ];
  
  for (const pattern of newsPatterns) {
    while ((match = pattern.exec(fullText)) !== null) addName(match[1]);
  }
  
  // Convert found names to startup objects
  for (const name of foundNames) {
    // Capitalize properly
    const properName = name.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    startups.push({
      name: properName,
      description: title,
      sector: sectors[0] || 'Other',
      stage: funding.funding_stage || null,
      amount_raised: funding.funding_amount || null
    });
  }
  
  // 5. Extract investors mentioned - also more aggressive
  if (funding.lead_investor) {
    investors.push({
      name: funding.lead_investor,
      firm: funding.lead_investor,
      type: 'VC'
    });
  }
  
  if (funding.investors_mentioned?.length > 0) {
    for (const inv of funding.investors_mentioned.slice(0, 5)) {
      if (inv !== funding.lead_investor) {
        investors.push({
          name: inv,
          firm: inv,
          type: 'VC'
        });
      }
    }
  }
  
  // Pattern: "led by [Investor]" or "[Investor] led" or "backed by [Investor]"
  const investorPatterns = [
    /led\s+by\s+([A-Z][a-zA-Z\s&]+?)(?:\s+and|\s+with|\s*,|\s*\.|\s*$)/gi,
    /backed\s+by\s+([A-Z][a-zA-Z\s&]+?)(?:\s+and|\s+with|\s*,|\s*\.|\s*$)/gi,
    /(?:from|by)\s+([A-Z][a-zA-Z]+\s+(?:Capital|Ventures|Partners|VC|Fund))/gi,
    /([A-Z][a-zA-Z]+\s+(?:Capital|Ventures|Partners))\s+(?:led|leads?|backs?|invests?)/gi,
  ];
  
  for (const pattern of investorPatterns) {
    let invMatch;
    while ((invMatch = pattern.exec(fullText)) !== null) {
      const invName = invMatch[1].trim();
      if (invName.length >= 3 && !investors.find(i => i.name.toLowerCase() === invName.toLowerCase())) {
        investors.push({
          name: invName,
          firm: invName,
          type: 'VC'
        });
      }
    }
  }
  
  return { startups, investors };
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
      
      // Use LOCAL INFERENCE to extract entities (NO AI - pattern-based, zero-cost!)
      const entities = extractEntitiesWithInference(title, content, source.name);
      
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
  console.log('🧠 Using local inference engine (no AI API required)\n');
  
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
