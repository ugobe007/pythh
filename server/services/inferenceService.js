/**
 * INFERENCE SERVICE - Reusable News-Based Enrichment
 * 
 * Purpose: Extract missing startup data from news sources using pattern matching
 * Used by: instantSubmit.js (real-time), enrich-sparse-startups.js (batch)
 * 
 * NO AI CALLS - pure pattern matching for speed and cost
 */

const Parser = require('rss-parser');
const {
  extractFunding,
  extractSectors,
  extractExecutionSignals,
  extractTeamSignals
} = require('../../lib/inference-extractor');
const { isJunkUrl } = require('../../lib/junk-url-config');

const parser = new Parser({
  timeout: 4000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)'
  }
});

// Hard-deadline wrapper — parser.timeout is unreliable on TCP stalls;
// this enforces a real cutoff via Promise.race so fallback loops don't hang
function parseWithDeadline(feedUrl, ms = 2500) {
  return Promise.race([
    parser.parseURL(feedUrl),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`RSS timeout after ${ms}ms`)), ms))
  ]);
}

/**
 * Normalize a startup name for matching:
 * - Strip legal suffixes (Inc., LLC, Corp., Ltd., etc.)
 * - Lowercase, trim
 * Returns { full, short } where `short` is first 1-2 significant tokens
 */
function normalizeNameForMatch(name) {
  const legalSuffixes = /\b(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|limited|incorporated|technologies|technology|solutions|labs?|group|ventures?|capital|systems?|networks?|platform|platforms?|software|services?)\b\.?$/gi;
  const full = name.trim().replace(legalSuffixes, '').trim().toLowerCase();
  // "short" = first two words (handles "Acme Technologies" → "Acme")
  const tokens = full.split(/\s+/).filter(Boolean);
  const short = tokens.slice(0, 2).join(' ');
  return { full, short };
}

/**
 * Filter articles to only those that actually mention the startup by name.
 * Keeps an article if its title or content contains the full normalized name
 * OR (if the full name is 2+ words) the first-word short name.
 * Returns the filtered array. If ALL articles get filtered out, returns the
 * original array unchanged (fallback — better some data than none).
 */
function filterArticlesByName(articles, startupName) {
  if (!articles || articles.length === 0) return articles;
  const { full, short } = normalizeNameForMatch(startupName);
  // We need at least 3 chars to avoid false-positive single-char names
  if (full.length < 3) return articles;

  const matches = articles.filter(a => {
    const text = `${a.title} ${a.content}`.toLowerCase();
    if (text.includes(full)) return true;
    // Only use short name match if it's at least 4 chars (avoids "go", "ai", etc.)
    if (short.length >= 4 && text.includes(short)) return true;
    return false;
  });

  // Only apply filter if it kept at least 1 article
  return matches.length > 0 ? matches : articles;
}

// Fast news sources (prioritize speed over depth)
const FAST_SOURCES = {
  googleNews: (query) => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
};

/**
 * Search for startup news articles
 * @param {string} startupName - Company name
 * @param {string} startupWebsite - Company website (optional)
 * @param {number} maxArticles - Max articles to fetch (default: 5)
 * @returns {Promise<Array>} Array of {title, content, link, pubDate, source}
 */
async function searchStartupNews(startupName, startupWebsite = null, maxArticles = 6) {
  const articles = [];

  // Detect "ambiguous" names: single word, ≤7 chars (Branch, Arc, Bolt, Vibe, etc.)
  // These produce noisy results against unrelated companies — prefer domain queries.
  const nameWords = startupName.trim().split(/\s+/);
  const isAmbiguousName = nameWords.length === 1 && startupName.trim().length <= 7;

  let domain = null;
  if (startupWebsite) {
    try { domain = new URL(startupWebsite).hostname.replace('www.', ''); } catch (e) {}
  }

  // Build contextual queries — domain-first for ambiguous names
  const queries = isAmbiguousName && domain
    ? [
        // Lead with the domain so results are unambiguous
        `"${domain}" funding`,
        `"${domain}" startup`,
        `"${startupName}" raises series funding`,
        `"${startupName}" customers revenue`,
      ]
    : [
        `"${startupName}" startup funding`,
        `"${startupName}" raises series`,
        `"${startupName}" customers revenue growth`,
        `"${startupName}" launches product`,
        // Domain fallback for non-ambiguous names too
        ...(domain ? [`"${domain}" startup`] : []),
      ];

  // Primary query
  const query = queries[0];
  const feedUrl = FAST_SOURCES.googleNews(query);

  try {
    const feed = await parseWithDeadline(feedUrl);
    const rawItems = feed.items.slice(0, maxArticles);

    const rawArticles = rawItems.map(item => ({
      title: item.title || '',
      content: item.contentSnippet || item.content || '',
      link: item.link || '',
      pubDate: item.pubDate || new Date().toISOString(),
      source: 'Google News'
    }));

    // Name-correlation filter: only keep articles that actually mention this startup
    const filtered = filterArticlesByName(rawArticles, startupName);
    articles.push(...filtered);

    // Fallback: try broader queries if primary returned few relevant results
    if (articles.length < 3) {
      for (let i = 1; i < queries.length && articles.length < 3; i++) {
        try {
          const fallbackFeed = await parseWithDeadline(FAST_SOURCES.googleNews(queries[i]));
          const fallbackRaw = fallbackFeed.items.slice(0, 4).map(item => ({
            title: item.title || '',
            content: item.contentSnippet || item.content || '',
            link: item.link || '',
            pubDate: item.pubDate || new Date().toISOString(),
            source: `Google News (${i === 1 ? 'series' : i === 2 ? 'product' : 'domain'})`
          }));
          const fallbackFiltered = filterArticlesByName(fallbackRaw, startupName);
          articles.push(...fallbackFiltered);
        } catch (e) {
          // Skip failed fallback
        }
      }
    }
  } catch (error) {
    console.log(`[inference] Search failed for "${query}": ${error.message}`);
  }

  return articles;
}

// ─── HTML entity decode map for common encodings in RSS content ─────────────
const HTML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&#x27;': "'" };
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str.replace(/&[#a-z0-9]+;/gi, e => HTML_ENTITIES[e] || e);
}

/**
 * WORD-PROXIMITY ASSOCIATION
 * Scan text for domain-like tokens that appear within ±N words of the startup name.
 * Handles bare domains ("brief.ai"), hyphenated slugs, and encoded content.
 *
 * @param {string} text - Raw article text (HTML entities NOT yet stripped)
 * @param {string} startupName - Company name to anchor proximity scan
 * @returns {string|null} Best matching domain or null
 */
function extractUrlByWordProximity(text, startupName) {
  if (!text || !startupName) return null;
  const decoded = decodeHtmlEntities(text);

  // Build a slug of the startup name for proximity scoring
  const slug = startupName.toLowerCase()
    .replace(/\b(inc|llc|corp|ltd|co|limited|technologies|tech|labs?|group|ventures?|ai|app|platform|software|systems?)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');

  // Domain regex: catches bare TLD domains that sanitizeTextForAnalysis would strip
  const DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{1,40})\.(com|io|ai|app|co|xyz|dev|tech|vc|health|finance|me|so|run|sh|org|net|us|eu|uk)\b/gi;

  const tokens = decoded.split(/\s+/);
  const candidates = [];

  // Find the startup name position(s) in the token stream
  const nameLower = startupName.toLowerCase();
  const nameTokens = nameLower.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const windowStr = tokens.slice(Math.max(0, i - 15), Math.min(tokens.length, i + 15)).join(' ');

    // Check if this window contains the startup name
    if (!windowStr.toLowerCase().includes(nameTokens[0])) continue;

    let m;
    DOMAIN_RE.lastIndex = 0;
    while ((m = DOMAIN_RE.exec(windowStr)) !== null) {
      const domain = m[0].toLowerCase();
      if (isJunkUrl(`https://${domain}`)) continue;
      // Score: +3 if slug matches domain stem, +1 otherwise
      const domainStem = m[1].replace(/-/g, '');
      const score = slug.length >= 3 && (domainStem.includes(slug.slice(0, 8)) || slug.slice(0, 8).includes(domainStem)) ? 3 : 1;
      candidates.push({ domain, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].domain;
}

/**
 * NAME→DOMAIN SLUG INFERENCE with HTTP HEAD verification.
 * Derives candidate domains from the startup name and verifies which resolves.
 * Respects a tight timeout to stay fast in batch enrichment.
 *
 * @param {string} startupName - Company name
 * @param {number} timeoutMs - Per-candidate HEAD request timeout
 * @returns {Promise<string|null>} Verified domain or null
 */
async function inferDomainFromName(startupName, timeoutMs = 2000) {
  if (!startupName) return null;

  // Normalize: strip legal/generic suffixes, lowercase, collapse to slug
  const cleaned = startupName
    .replace(/\b(inc\.?|llc\.?|corp\.?|ltd\.?|technologies|technology|solutions|labs?|group|ventures?|capital|systems?|networks?|platform|platforms?|software|services?|ai|app)\b\.?/gi, '')
    .trim();

  const slug = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hyphenSlug = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (slug.length < 3) return null;

  // Candidate list — ordered by real-world startup domain likelihood
  // .com first (most established companies), then .ai/.io (modern startups)
  const candidates = [
    `${slug}.com`,
    `${slug}.ai`,
    `${slug}.io`,
    `${slug}.app`,
    `${slug}.co`,
    `${hyphenSlug}.com`,
    `${hyphenSlug}.ai`,
    `${hyphenSlug}.io`,
    `try${slug}.com`,
    `get${slug}.com`,
    `use${slug}.com`,
    `${slug}.dev`,
    `${slug}.xyz`,
  ].filter((d, i, a) => a.indexOf(d) === i); // dedupe

  // Verify candidates in sequence — return first that resolves
  for (const domain of candidates) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`https://${domain}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)' }
      });
      clearTimeout(timer);
      // Any non-error response (even 4xx) means the domain resolves
      if (res.status < 500) return domain;
    } catch { /* domain doesn't resolve — try next */ }
  }
  return null;
}

/**
 * Extract the startup's own website URL from article text/content.
 * Strategy (in order):
 *   1. Full http(s):// URLs in text  (regex scan on raw content)
 *   2. www. prefixed domains
 *   3. Word-proximity association    (domain tokens near startup name)
 *   4. Bare startup-TLD domains      (.ai, .io, .app, etc.)
 * Filters all candidates through isJunkUrl().
 *
 * @param {Array} articles - [{title, content, link, pubDate, source}]
 * @param {string} startupName - Company name for heuristic matching
 * @returns {string|null} Clean domain (no protocol/path) or null
 */
function extractCompanyUrlFromArticles(articles, startupName = '') {
  // Match: https?:// URLs or bare www. domains or domains with tech-startup TLDs
  const URL_RE = /(?:https?:\/\/(?:www\.)?|(?:^|[\s(])www\.)([a-z0-9][a-z0-9-]{0,61}[a-z0-9]?\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?/gi;
  // Also catch bare startup-style domains: "name.io", "name.ai", "name.app" etc.
  const BARE_DOMAIN_RE = /\b([a-z0-9][a-z0-9-]{2,30})\.(io|ai|app|co|xyz|dev|tech|vc|fund|health|finance|me|so|run|sh)\b/gi;

  const nameLower = startupName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [];

  for (const article of articles) {
    const rawText = decodeHtmlEntities(`${article.title || ''} ${article.content || ''}`);

    // Pass 1: full URLs (https:// or www.)
    const urlMatches = rawText.match(URL_RE) || [];
    for (const rawUrl of urlMatches) {
      const normalized = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`;
      if (isJunkUrl(normalized)) continue;
      try {
        const domain = new URL(normalized).hostname.replace(/^www\./, '').toLowerCase();
        if (!domain || domain.length < 3) continue;
        const score = nameLower.length >= 3 && domain.replace(/\.[^.]+$/, '').includes(nameLower.slice(0, Math.min(nameLower.length, 10))) ? 2 : 1;
        candidates.push({ domain, score });
      } catch { /* malformed */ }
    }

    // Pass 2: bare startup-TLD domains like "serval.ai", "acme.io"
    BARE_DOMAIN_RE.lastIndex = 0;
    let m;
    while ((m = BARE_DOMAIN_RE.exec(rawText)) !== null) {
      const domain = `${m[1]}.${m[2]}`.toLowerCase();
      if (isJunkUrl(`https://${domain}`)) continue;
      const score = nameLower.length >= 3 && domain.startsWith(nameLower.slice(0, Math.min(nameLower.length, 8))) ? 3 : 1;
      candidates.push({ domain, score });
    }

    // Pass 3: word-proximity — domain tokens within ±15 words of startup name
    const proximityUrl = extractUrlByWordProximity(rawText, startupName);
    if (proximityUrl) candidates.push({ domain: proximityUrl, score: 2 });
  }

  if (candidates.length === 0) return null;
  // Return best-scoring candidate (name-match prioritised)
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].domain;
}

/**
 * Extract data from news articles using pattern matching
 * @param {Array} articles - Array of {title, content, link, pubDate, source}
 * @param {Object} currentData - Current startup data (extracted_data object)
 * @param {string} startupName - Used for company URL heuristic matching
 * @returns {Object} {enrichedData, enrichmentCount, fieldsEnriched: []}
 */
function extractDataFromArticles(articles, currentData = {}, startupName = '') {
  const enrichedData = { ...currentData };
  const fieldsEnriched = [];
  
  if (!articles || articles.length === 0) {
    return { enrichedData, enrichmentCount: 0, fieldsEnriched };
  }
  
  // Combine all article text for analysis
  const allText = articles.map(a => `${a.title} ${a.content}`).join('\n\n');
  
  // Extract funding information
  if (!enrichedData.raise_amount || enrichedData.raise_amount === '') {
    const funding = extractFunding(allText);
    if (funding.amount > 0) {
      enrichedData.raise_amount = `$${funding.amount}`;
      enrichedData.raise_type = funding.round;
      enrichedData.funding_amount = funding.amount;
      enrichedData.funding_stage = funding.round;
      fieldsEnriched.push('funding');
    }
  }
  
  // Extract sectors if missing
  if (!enrichedData.sectors || enrichedData.sectors.length === 0) {
    const sectors = extractSectors(allText);
    if (sectors.length > 0) {
      enrichedData.sectors = sectors;
      enrichedData.industries = sectors;
      fieldsEnriched.push('sectors');
    }
  }
  
  // Extract execution signals (traction, customers, revenue)
  const execution = extractExecutionSignals(allText);
  
  if (execution.customer_count > 0 && !enrichedData.customer_count) {
    enrichedData.customer_count = execution.customer_count;
    enrichedData.customers = execution.customer_count;
    fieldsEnriched.push('customers');
  }
  
  if (execution.revenue > 0 && !enrichedData.arr) {
    enrichedData.arr = execution.revenue;
    enrichedData.revenue = execution.revenue;
    fieldsEnriched.push('revenue');
  }
  
  if (execution.mrr > 0 && !enrichedData.mrr) {
    enrichedData.mrr = execution.mrr;
    fieldsEnriched.push('mrr');
  }
  
  // Extract team signals
  const teamSignals = extractTeamSignals(allText);
  if (teamSignals.length > 0) {
    enrichedData.team_signals = [...(enrichedData.team_signals || []), ...teamSignals];
    fieldsEnriched.push('team_signals');
  }
  
// Extract company website URL from article content (if not already known)
  if (!enrichedData.website && !enrichedData.company_url) {
    const discoveredUrl = extractCompanyUrlFromArticles(articles, startupName);
    if (discoveredUrl) {
      enrichedData.company_url = discoveredUrl;
      fieldsEnriched.push('company_url');
    }
  }

  // Store article references for transparency
  if (articles.length > 0) {
    enrichedData.enrichment_sources = articles.map(a => ({
      title: a.title,
      url: a.link,
      date: a.pubDate,
      source: a.source
    }));
    enrichedData.last_enrichment_date = new Date().toISOString();
  }
  
  return {
    enrichedData,
    enrichmentCount: fieldsEnriched.length,
    fieldsEnriched
  };
}

/**
 * Quick enrichment: Search + Extract in one call (for real-time use)
 * @param {string} startupName - Company name
 * @param {Object} currentData - Current startup data
 * @param {string} startupWebsite - Company website (optional)
 * @param {number} timeoutMs - Max time to spend (default: 3000ms = 3s)
 * @returns {Promise<Object>} {enrichedData, enrichmentCount, fieldsEnriched, articlesFound}
 */
async function quickEnrich(startupName, currentData = {}, startupWebsite = null, timeoutMs = 3000) {
  const startTime = Date.now();
  
  try {
    // Race against timeout
    const enrichmentPromise = (async () => {
      // Step 1: Search news (2-3 seconds typical)
      const articles = await searchStartupNews(startupName, startupWebsite, 5);
      
      if (articles.length === 0) {
        return {
          enrichedData: currentData,
          enrichmentCount: 0,
          fieldsEnriched: [],
          articlesFound: 0
        };
      }
      
      // Step 2: Extract data (< 100ms typical)
      const result = extractDataFromArticles(articles, currentData, startupName);

      // Step 3: If still no company URL found in articles, try name→domain inference
      if (!result.enrichedData.company_url && !currentData.website && !currentData.company_url) {
        const inferred = await inferDomainFromName(startupName, Math.max(200, timeoutMs - (Date.now() - startTime) - 500));
        if (inferred) {
          result.enrichedData.company_url = inferred;
          result.enrichedData.company_url_source = 'name_inference';
          result.fieldsEnriched.push('company_url');
          result.enrichmentCount++;
        }
      }
      
      return {
        ...result,
        articlesFound: articles.length
      };
    })();
    
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({
        enrichedData: currentData,
        enrichmentCount: 0,
        fieldsEnriched: [],
        articlesFound: 0,
        timedOut: true
      }), timeoutMs);
    });
    
    const result = await Promise.race([enrichmentPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    console.log(`[inference] Quick enrichment for "${startupName}": ${result.enrichmentCount} fields in ${elapsed}ms` +
                (result.timedOut ? ' (timed out)' : ''));
    
    return result;
  } catch (error) {
    console.error(`[inference] Quick enrichment failed for "${startupName}":`, error.message);
    return {
      enrichedData: currentData,
      enrichmentCount: 0,
      fieldsEnriched: [],
      articlesFound: 0,
      error: error.message
    };
  }
}

/**
 * Check if startup data is sparse (needs enrichment)
 * @param {Object} startup - Startup object with extracted_data
 * @returns {boolean} True if sparse (< 5 data signals)
 */
function isDataSparse(startup) {
  const extracted = startup.extracted_data || {};
  let signalCount = 0;
  
  // Count key data signals
  if (extracted.raise_amount || extracted.funding_amount) signalCount++;
  if (extracted.sectors && extracted.sectors.length > 0) signalCount++;
  if (extracted.customer_count || extracted.customers) signalCount++;
  if (extracted.arr || extracted.revenue || extracted.mrr) signalCount++;
  if (extracted.team_signals && extracted.team_signals.length > 0) signalCount++;
  
  return signalCount < 5;
}

module.exports = {
  searchStartupNews,
  extractDataFromArticles,
  quickEnrich,
  isDataSparse,
  inferDomainFromName,
};
