#!/usr/bin/env node
/**
 * Simple RSS Feed Scraper
 * 
 * Scrapes RSS feeds WITHOUT AI - just extracts headlines and links.
 * Then we can enrich later with AI when credits are available.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const path = require('path');

// Import Phase-Change frame parser for entity extraction fallback
let frameParser;
try {
  const frameParserPath = path.join(__dirname, '../../src/services/rss/frameParser.ts');
  // Use tsx to load TypeScript directly
  frameParser = require('tsx/cjs').require(frameParserPath);
} catch (err) {
  console.warn('⚠️  Phase-Change frame parser not available, using legacy extraction only');
  frameParser = null;
}

// Import v2 Inference Extractor for better sector detection (18 categories vs 5)
let v2ExtractSectors, extractInferenceData;
try {
  const inferenceExtractor = require('../../lib/inference-extractor');
  v2ExtractSectors = inferenceExtractor.extractSectors;
  extractInferenceData = inferenceExtractor.extractInferenceData;
  console.log('✅ Inference extractor v2 loaded (18-category sectors)');
} catch (e) {
  console.log('⚠️  Inference extractor not available, using basic 10-category sectors');
  v2ExtractSectors = null;
  extractInferenceData = null;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  }
});

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  DEFAULT_DELAY: 3000,  // 3 seconds between sources
  RATE_LIMITED_SOURCES: {
    'hacker news': 45000,      // 45 seconds for HN (strict rate limiting)
    'hackernews': 45000,
    'hn': 45000,
    'show hn': 45000,
    'crunchbase': 20000,       // 20 seconds for Crunchbase
    'techcrunch': 10000,       // 10 seconds for TechCrunch
  },
  BACKOFF: {
    initial: 5000,
    max: 180000,               // 3 minutes max
    multiplier: 2,
  }
};

// Track backoff state per source
const sourceBackoffState = {};

// Helper to get delay for a source
function getSourceDelay(sourceName) {
  const lower = sourceName.toLowerCase();
  for (const [key, delay] of Object.entries(RATE_LIMIT_CONFIG.RATE_LIMITED_SOURCES)) {
    if (lower.includes(key)) return delay;
  }
  return RATE_LIMIT_CONFIG.DEFAULT_DELAY;
}

// Helper to check if source should be skipped due to backoff
function shouldSkipSource(sourceName) {
  const state = sourceBackoffState[sourceName.toLowerCase()];
  if (!state) return false;
  
  const timeSinceError = Date.now() - state.lastError;
  if (timeSinceError < state.backoff) {
    return { skip: true, waitTime: Math.ceil((state.backoff - timeSinceError) / 1000) };
  }
  return false;
}

// Helper to record error for a source
function recordSourceError(sourceName, isRateLimit = false) {
  const lower = sourceName.toLowerCase();
  const state = sourceBackoffState[lower] || { backoff: RATE_LIMIT_CONFIG.BACKOFF.initial, errorCount: 0 };
  
  const newBackoff = isRateLimit 
    ? Math.min(state.backoff * RATE_LIMIT_CONFIG.BACKOFF.multiplier, RATE_LIMIT_CONFIG.BACKOFF.max)
    : state.backoff;
    
  sourceBackoffState[lower] = {
    backoff: newBackoff,
    lastError: Date.now(),
    errorCount: state.errorCount + 1
  };
  
  return newBackoff;
}

// Helper to reset backoff on success
function resetSourceBackoff(sourceName) {
  delete sourceBackoffState[sourceName.toLowerCase()];
}

// Keywords that indicate startup/funding news
const STARTUP_KEYWORDS = [
  'startup', 'funding', 'raised', 'series', 'seed', 'venture', 'launches',
  'founded', 'valuation', 'investment', 'investor', 'accelerator', 'incubator',
  'ai startup', 'fintech', 'healthtech', 'saas', 'million', 'billion'
];

// ============================================================================
// 4-STAGE EXTRACTION GATE (Canonical Fix)
// ============================================================================
// Stage 1: Candidate Generation (Loose)
// Stage 2: Hard Reject Rules
// Stage 3: Positive Company Heuristics
// Stage 4: Publisher-Style Normalization
// ============================================================================

// Known brand dictionary (rolling in-memory from prior matches)
const KNOWN_BRANDS = new Set([
  'tesla', 'google', 'nvidia', 'databricks', 'flipkart', 'waymo', 'zipline',
  'xiaomi', 'lemonade', 'antler', 'workday', 'luminar', 'kpay', 'goodfin',
  'ethernovia', 'sakana ai', 'bucket robotics', 'ola electric', 'general catalyst',
  'openai', 'anthropic', 'stripe', 'notion', 'figma', 'canva', 'airtable'
]);

// Common first names for person-name rejection
const COMMON_FIRST_NAMES = new Set([
  'charles', 'helen', 'adam', 'john', 'jane', 'michael', 'sarah', 'david',
  'emily', 'james', 'mary', 'robert', 'patricia', 'jennifer', 'linda',
  'william', 'elizabeth', 'richard', 'susan', 'joseph', 'jessica', 'thomas',
  'karen', 'christopher', 'nancy', 'daniel', 'betty', 'matthew', 'margaret'
]);

function extractCompanyName(title) {
  if (!title || title.length < 5) return null;
  
  // STAGE 1: CANDIDATE GENERATION (Loose)
  // ======================================
  const candidates = [];
  
  // Pattern 1: Funding/raise patterns (highest confidence)
  const fundingPatterns = [
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?)\s+(raises|lands|secures|closes|bags|completes)\s+(\$|€|£)/i,
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?),?\s+(?:a|an|the)?\s*[^,]+,?\s+(raises|secures|lands)\s+(\$|€|£)/i,
    /(\$|€|£)[\d.]+[MBK]?\s+(?:for|to|in)\s+([A-Z][A-Za-z0-9&.\-\s]{1,40})/i,
    // NEW: "The X/Y..." headlines
    /^The\s+([A-Z][A-Za-z0-9&.\-\s/]{1,50}?)\s+(raises?|closes?|secures?|lands?|bags?)\s+/i,
  ];
  
  // Pattern 2: Launch/announcement patterns
  const launchPatterns = [
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?)\s+(launches|unveils|announces|introduces)/i,
  ];
  
  // Pattern 3: M&A patterns
  const maPatterns = [
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?)\s+(acquires|snaps up|buys|merges with)/i,
    // NEW: "X To Buy Y" and "X To Acquire Y" patterns
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?)\s+[Tt]o\s+(?:Buy|Acquire|Purchase)\s+/i,
    /\s+(?:Buy|Acquire|Purchase)s?\s+(?:Fintech\s+Startup\s+|Startup\s+)?([A-Z][A-Za-z0-9&.\-\s]{1,40})/i,
  ];
  
  // Pattern 4: IPO/listing patterns
  const ipoPatterns = [
    /^([A-Z][A-Za-z0-9&.\-\s]{1,50}?)\s+(eyes|seeks|files for|plans)\s+(?:an?\s+)?IPO/i,
  ];
  
  // Pattern 5: Title-case sequences (1-4 words)
  const titleCasePattern = /\b([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,3})\b/g;
  
  // Collect all candidates
  [...fundingPatterns, ...launchPatterns, ...maPatterns, ...ipoPatterns].forEach(pattern => {
    const match = title.match(pattern);
    if (match && match[1]) {
      candidates.push({ text: match[1].trim(), source: 'pattern', confidence: 0.7 });
    } else if (match && match[2]) {
      candidates.push({ text: match[2].trim(), source: 'pattern', confidence: 0.7 });
    }
  });
  
  // Add title-case sequences as low-confidence candidates
  let tcMatch;
  while ((tcMatch = titleCasePattern.exec(title)) !== null) {
    candidates.push({ text: tcMatch[1].trim(), source: 'titlecase', confidence: 0.3 });
  }
  
  if (candidates.length === 0) return null;
  
  // STAGE 2: HARD REJECT RULES
  // ===========================
  function shouldHardReject(candidate) {
    const lower = candidate.toLowerCase();
    const words = candidate.split(/\s+/);
    
    // ❌ Stop-Fragment Rules
    const stopFragments = new Set([
      'the', 'a', 'an', 'and', 'for', 'with', 'as', 'on', 'in', 'by', 'to', 'from', 'of',
      'interview', 'focus', 'names', 'launches', 'calls', 'says', 'adds', 'scraps',
      'boost', 'plummeted', 'tumbles', 'merges', 'is', 'are', 'was', 'were',
      'over', 'under', 'about', 'around', 'nearly', 'almost'
    ]);
    
    if (words.length === 1 && stopFragments.has(lower)) {
      return { reject: true, reason: 'stop_fragment' };
    }
    
    // ❌ Quote-Fragment Rules
    if (/^['"`''""']/.test(candidate) || /['"`''""']$/.test(candidate)) {
      return { reject: true, reason: 'quote_fragment' };
    }
    
    // Count quotes - if unmatched, reject
    const quoteCount = (candidate.match(/['"`''""']/g) || []).length;
    if (quoteCount % 2 !== 0) {
      return { reject: true, reason: 'unmatched_quotes' };
    }
    
    // ❌ Job-Title Contamination
    const jobTitlePattern = /(CEO|CFO|CTO|Chief|Founder|Managing Partner|President|Chairman|Director|Names|Appoints|Resigns|\sAs$)/i;
    if (jobTitlePattern.test(candidate)) {
      return { reject: true, reason: 'job_title_contamination' };
    }
    
    // ❌ Obvious Person Names (two capitalized words + first name match)
    if (words.length === 2) {
      const [first, last] = words;
      if (COMMON_FIRST_NAMES.has(first.toLowerCase()) && 
          /^[A-Z][a-z]+$/.test(last)) {
        return { reject: true, reason: 'person_name' };
      }
    }
    
    // ❌ Verb-heavy phrases (emerging markets plummeted by, focus on soaring)
    const verbHeavy = /(emerging|plummeted|tumbles|soaring|focus on|for multibillion)/i;
    if (verbHeavy.test(candidate)) {
      return { reject: true, reason: 'verb_heavy_phrase' };
    }
    
    // ❌ Too short or too long
    if (candidate.length < 2 || candidate.length > 60) {
      return { reject: true, reason: 'length_invalid' };
    }
    
    // ❌ Contains no letters
    if (!/[a-z]/i.test(candidate)) {
      return { reject: true, reason: 'no_letters' };
    }
    
    // ❌ Starts with number or special char
    if (/^[\d$€£]/.test(candidate)) {
      return { reject: true, reason: 'starts_with_number' };
    }
    
    return { reject: false };
  }
  
  // STAGE 3: POSITIVE COMPANY HEURISTICS
  // =====================================
  function calculateConfidence(candidate, context) {
    let score = context.confidence || 0.3; // Base from pattern match
    const lower = candidate.toLowerCase();
    
    // ✅ Known Brand Dictionary Hit
    if (KNOWN_BRANDS.has(lower)) {
      score += 0.4;
    }
    
    // ✅ Suffix / Form Indicators
    const companySuffixes = /(AI|Labs?|Technologies|Systems?|Group|Holdings?|Robotics?|Energy|Electric|Capital|Ventures?|Networks?|Finance|Analytics?|Health|Bio|Therapeutics?|Logistics?|Cloud|Payments?|Software|Solutions?|Platform|Inc\.?|Corp\.?|LLC|Ltd\.?)$/i;
    if (companySuffixes.test(candidate)) {
      score += 0.3;
    }
    
    // ✅ Fundraising / Deal Context Present
    const dealContext = /(raises?|funding|series|seed|round|acquires?|acquisition|invests?|backed|valued|IPO|closes?|secures?|lands?|bags?)/i;
    if (dealContext.test(title)) {
      score += 0.3;
    }
    
    return score;
  }
  
  // STAGE 4: PUBLISHER-STYLE NORMALIZATION
  // =======================================
  function normalizeCandidate(candidate) {
    let normalized = candidate;
    
    // Remove possessives
    normalized = normalized.replace(/'s$/i, '');
    
    // Remove trailing action verbs that got captured
    normalized = normalized.replace(/\s+(raises?|secures?|lands?|closes?|bags?|launches?|announces?|snaps?|buys?|merges?|acquires?|eyes|seeks|files?|plans?|completes?|says?|adds?|calls?|names?).*$/i, '');
    
    // Remove "startup" prefix if present ("fintech startup Acme" → "Acme")
    normalized = normalized.replace(/^(?:fintech|healthtech|edtech|ai|ml|saas|biotech|cleantech)\s+(?:startup|firm|company)\s+/i, '');
    normalized = normalized.replace(/^(?:startup|firm|company|platform)\s+/i, '');
    
    // Remove location adjectives ("Finnish Rundit" → "Rundit")
    normalized = normalized.replace(/^(?:finnish|swedish|estonian|danish|indian|german|french|british|american|chinese)\s+/i, '');
    
    // Remove conjunctions if captured ("Acme and Zeal" → "Acme")
    normalized = normalized.replace(/\s+(?:and|or|with|&)\s+.*$/i, '');
    
    // Remove "for", "by", "from" prefixes
    normalized = normalized.replace(/^(?:for|by|from|with|in|at|on)\s+/i, '');
    
    // Trim and clean
    normalized = normalized.trim();
    
    return normalized;
  }
  
  // PROCESS ALL CANDIDATES
  // ======================
  const validCandidates = [];
  
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate.text);
    if (!normalized || normalized.length < 2) continue;
    
    // Stage 2: Hard reject
    const rejectCheck = shouldHardReject(normalized);
    if (rejectCheck.reject) {
      continue; // Skip this candidate
    }
    
    // Stage 3: Calculate confidence
    const confidence = calculateConfidence(normalized, candidate);
    
    // Only accept if confidence >= 0.6
    if (confidence >= 0.6) {
      validCandidates.push({ name: normalized, confidence });
      
      // Add to known brands for future matches
      KNOWN_BRANDS.add(normalized.toLowerCase());
    }
  }
  
  // Return highest confidence candidate
  if (validCandidates.length === 0) {
    // FALLBACK: Try Phase-Change frame parser (Jisst-Lite V2)
    if (frameParser && frameParser.parseFrameFromTitle) {
      try {
        const frame = frameParser.parseFrameFromTitle(title);
        if (frame && frame.slots) {
          // Extract subject (primary actor) from frame
          if (frame.slots.subject && frame.slots.subject.length > 2) {
            const subject = normalizeCandidate(frame.slots.subject);
            const rejectCheck = shouldHardReject(subject);
            if (!rejectCheck.reject) {
              // Add to known brands for future matches
              KNOWN_BRANDS.add(subject.toLowerCase());
              return subject;
            }
          }
          // Try object if subject failed
          if (frame.slots.object && frame.slots.object.length > 2) {
            const object = normalizeCandidate(frame.slots.object);
            const rejectCheck = shouldHardReject(object);
            if (!rejectCheck.reject) {
              KNOWN_BRANDS.add(object.toLowerCase());
              return object;
            }
          }
        }
      } catch (err) {
        // Silent fallback failure - don't break scraper
      }
    }
    return null;
  }
  
  return validCandidates[0].name;
}

// Detect sectors from text
function detectSectors(text) {
  // Prefer v2 inference extractor (18 categories) over inline (10 categories)
  if (v2ExtractSectors) {
    const v2Sectors = v2ExtractSectors(text);
    if (v2Sectors && v2Sectors.length > 0) return v2Sectors;
  }

  // Fallback: inline detection (10 categories)
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'deep learning', 'llm', 'gpt'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments', 'neobank', 'crypto'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'biotech', 'health tech'],
    'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon', 'renewable'],
    'EdTech': ['edtech', 'education', 'e-learning', 'online learning'],
    'E-Commerce': ['ecommerce', 'e-commerce', 'retail tech', 'marketplace'],
    'Cybersecurity': ['cybersecurity', 'security', 'infosec', 'cyber'],
    'Developer Tools': ['developer', 'devtools', 'api', 'infrastructure'],
    'Consumer': ['consumer', 'b2c', 'direct to consumer', 'd2c'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors : ['Technology'];
}

// Check if title is about startup/funding (more lenient)
function isStartupNews(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // More lenient: if it has any startup keyword OR if it's from a startup-focused source
  const hasKeyword = STARTUP_KEYWORDS.some(kw => text.includes(kw));
  
  // Also accept if it mentions company names (capitalized words that look like company names)
  const hasCompanyName = /[A-Z][a-z]+ (raises|launches|secures|closes|announces|hires|partners)/i.test(text);
  
  // Accept funding-related numbers
  const hasFundingAmount = /\$[\d.]+[MB]|million|billion|funding|raised|investment/i.test(text);
  
  return hasKeyword || hasCompanyName || hasFundingAmount;
}

async function scrapeRssFeeds() {
  console.log('📡 Simple RSS Feed Scraper (with Smart Rate Limiting)\n');
  
  // Get active RSS sources (increased limit to handle hundreds of sources)
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, url, category')
    .eq('active', true)
    .order('last_scraped', { ascending: true, nullsFirst: true }) // Scrape oldest first
    .limit(200); // Process up to 200 sources per run (covers all 84+ active sources)
  
  console.log(`Found ${sources?.length || 0} active RSS sources\n`);
  
  let totalDiscovered = 0;
  let totalAdded = 0;
  let sourcesSkipped = 0;
  
  for (const source of sources || []) {
    // Check if source should be skipped due to backoff
    const skipCheck = shouldSkipSource(source.name);
    if (skipCheck && skipCheck.skip) {
      console.log(`⏳ Skipping ${source.name} (in backoff: ${skipCheck.waitTime}s remaining)`);
      sourcesSkipped++;
      continue;
    }
    
    // Apply rate limiting delay
    const delay = getSourceDelay(source.name);
    if (delay > RATE_LIMIT_CONFIG.DEFAULT_DELAY) {
      console.log(`⏱️ Rate-limited source: ${source.name} - waiting ${delay / 1000}s`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`\n📰 ${source.name}`);
    console.log(`   ${source.url}`);
    
    try {
      // Add timeout protection for individual feeds (30 seconds max per feed)
      const feedPromise = parser.parseURL(source.url);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Feed timeout after 30s')), 30000)
      );
      
      const feed = await Promise.race([feedPromise, timeoutPromise]);
      
      // Success - reset backoff for this source
      resetSourceBackoff(source.name);
      
      // Increased from 10 to 50 items per feed to scale to 200-500 startups/day
      const items = feed.items?.slice(0, 50) || [];
      
      console.log(`   Found ${items.length} items`);
      
      let added = 0;
      let skipped = 0;
      for (const item of items) {
        totalDiscovered++;
        
        // Skip if not startup-related
        if (!isStartupNews(item.title || '', item.contentSnippet || item.content || '')) {
          skipped++;
          continue;
        }
        
        // Try to extract company name (more lenient)
        let companyName = extractCompanyName(item.title || '');
        
        // Debug: Log first few extraction attempts
        if (!companyName && skipped < 3) {
          console.log(`   🔍 Debug: Title: "${(item.title || '').substring(0, 70)}..."`);
          console.log(`   🔍 Debug: No company name extracted`);
        }
        
        if (!companyName || companyName.length < 2) {
          skipped++;
          continue;
        }
        
        // Check if already exists in discovered_startups
        const { data: existingDiscovered } = await supabase
          .from('discovered_startups')
          .select('id')
          .ilike('name', companyName)
          .limit(1);
        
        if (existingDiscovered && existingDiscovered.length > 0) {
          skipped++;
          continue;
        }
        
        // Also check if already in startup_uploads
        const { data: existingUploaded } = await supabase
          .from('startup_uploads')
          .select('id')
          .ilike('name', companyName)
          .limit(1);
        
        if (existingUploaded && existingUploaded.length > 0) {
          skipped++;
          continue;
        }
        
        // Detect sectors + run inference extraction
        const articleText = `${item.title} ${item.contentSnippet || ''}`;
        const sectors = detectSectors(articleText);
        
        // Run v2 inference to enrich discovered startup data
        let inferenceData = {};
        if (extractInferenceData) {
          try {
            inferenceData = extractInferenceData(articleText, item.link);
          } catch (e) { /* silent */ }
        }
        
        // Insert - using correct column names (with timeout handling)
        try {
          const insertPromise = supabase.from('discovered_startups').insert({
            name: companyName,
            description: (item.contentSnippet || item.title || '').slice(0, 500),
            website: item.link,
            source: 'rss',            // ✅ For tracking discovery source
            rss_source: source.name,  // ✅ CORRECT - not "source"
            article_url: item.link,   // ✅ CORRECT - not "source_url"
            article_title: item.title || '',
            article_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            sectors: sectors,
            discovered_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            // v2 inference enrichment
            funding_amount: inferenceData.funding_amount || null,
            funding_stage: inferenceData.funding_stage || null,
            value_proposition: inferenceData.value_proposition || null,
            team_signals: inferenceData.team_signals || null,
            execution_signals: inferenceData.execution_signals || null,
            metadata: Object.keys(inferenceData).length > 0 ? { inference: inferenceData } : null,
          });
          
          // Add 10-second timeout for database operations
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database timeout after 10s')), 10000)
          );
          
          const { error } = await Promise.race([insertPromise, timeoutPromise]);
          
          if (!error) {
            console.log(`   ✅ ${companyName} (${sectors.join(', ')})`);
            added++;
            totalAdded++;
          } else {
            console.log(`   ⚠️  ${companyName}: ${error.message}`);
            skipped++;
          }
        } catch (dbError) {
          console.log(`   ⚠️  ${companyName}: ${dbError.message}`);
          skipped++;
        }
      }
      
      if (skipped > 0 && added === 0) {
        console.log(`   ℹ️  ${skipped} items skipped (no company name found or duplicates)`);
      }
      
      // Update last_scraped (with timeout protection)
      try {
        await Promise.race([
          supabase.from('rss_sources')
            .update({ last_scraped: new Date().toISOString() })
            .eq('id', source.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 5000))
        ]);
      } catch (updateError) {
        // Silently fail - don't hang on DB updates
      }
      
      if (added > 0) {
        console.log(`   Added: ${added}`);
      }
      
    } catch (err) {
      // Check error type
      const isRateLimit = err.message.includes('429') || 
                          err.message.includes('Too Many') ||
                          err.message.includes('rate limit');
      const isTimeout = err.message.includes('timeout') || 
                        err.message.includes('ETIMEDOUT') || 
                        err.message.includes('Feed timeout');
      const isConnectionError = err.message.includes('ECONNRESET') ||
                                err.message.includes('ENOTFOUND');
      
      // Record error and get new backoff time
      const newBackoff = recordSourceError(source.name, isRateLimit);
      
      if (isRateLimit) {
        console.log(`   🚫 Rate limited (429) - backing off for ${newBackoff / 1000}s`);
      } else if (isTimeout) {
        console.log(`   ⏱️  Timeout: Feed took too long, backing off for ${newBackoff / 1000}s`);
      } else if (isConnectionError) {
        console.log(`   🔌 Connection error - backing off for ${newBackoff / 1000}s`);
      } else {
        console.log(`   ❌ Error: ${err.message}`);
      }
      
      // Update last_scraped even on error (with timeout protection)
      try {
        await Promise.race([
          supabase.from('rss_sources')
            .update({ last_scraped: new Date().toISOString() })
            .eq('id', source.id),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Update timeout')), 5000))
        ]);
      } catch (updateError) {
        // Silently fail - continue to next feed
      }
      
      // Continue to next feed - don't let one broken feed stop everything
      continue;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total discovered: ${totalDiscovered}`);
  console.log(`Total added: ${totalAdded}`);
  console.log(`Sources skipped (backoff): ${sourcesSkipped}`);
  console.log('='.repeat(50));
}

// Run
scrapeRssFeeds().catch(console.error);
