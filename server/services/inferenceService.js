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

const parser = new Parser({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)'
  }
});

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
async function searchStartupNews(startupName, startupWebsite = null, maxArticles = 5) {
  const articles = [];
  
  // Build search queries (name + context)
  const queries = [
    `"${startupName}" startup funding`,
  ];
  
  // Add domain-based query if website provided
  if (startupWebsite) {
    try {
      const domain = new URL(startupWebsite).hostname.replace('www.', '');
      queries.push(`${domain} startup`);
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  // Try first query only (fast approach)
  const query = queries[0];
  const feedUrl = FAST_SOURCES.googleNews(query);
  
  try {
    const feed = await parser.parseURL(feedUrl);
    
    // Limit to maxArticles most recent
    const recent = feed.items.slice(0, maxArticles);
    
    for (const item of recent) {
      articles.push({
        title: item.title || '',
        content: item.contentSnippet || item.content || '',
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: 'Google News'
      });
    }
  } catch (error) {
    console.log(`[inference] Search failed for "${query}": ${error.message}`);
  }
  
  return articles;
}

/**
 * Extract data from news articles using pattern matching
 * @param {Array} articles - Array of {title, content, link, pubDate, source}
 * @param {Object} currentData - Current startup data (extracted_data object)
 * @returns {Object} {enrichedData, enrichmentCount, fieldsEnriched: []}
 */
function extractDataFromArticles(articles, currentData = {}) {
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
      const result = extractDataFromArticles(articles, currentData);
      
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
  isDataSparse
};
