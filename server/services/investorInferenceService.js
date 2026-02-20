/**
 * Investor Inference Service
 * ============================================================================
 * 
 * Parallel to inferenceService.js (for startups), this service enriches
 * sparse investor profiles by correlating their name/firm with news sources.
 * 
 * Strategy:
 * 1. Search Google News RSS for "[Investor Name] [Firm] investment"
 * 2. Extract: sectors invested, portfolio companies, check sizes, thesis signals
 * 3. Fill missing fields: sectors, stage, bio, investment_thesis, portfolio_companies
 * 
 * Used by:
 * - scripts/enrich-sparse-investors.js (batch backfill)
 * - server/routes/investors.js (real-time on new investor submission)
 * 
 * ============================================================================
 */

'use strict';

const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// ── Sector keywords → normalized sector labels ──
const SECTOR_PATTERNS = [
  { keywords: ['artificial intelligence', 'machine learning', 'deep learning', ' ai ', 'ai/ml', 'llm', 'generative ai'], label: 'AI/ML' },
  { keywords: ['fintech', 'financial technology', 'payments', 'banking', 'crypto', 'blockchain', 'defi', 'neobank'], label: 'FinTech' },
  { keywords: ['healthtech', 'health tech', 'digital health', 'medtech', 'biotech', 'therapeutics', 'clinical'], label: 'HealthTech' },
  { keywords: ['climate tech', 'cleantech', 'clean energy', 'sustainability', 'carbon', 'renewable', 'net zero'], label: 'ClimaTech' },
  { keywords: ['saas', 'enterprise software', 'b2b software', 'platform', 'cloud software'], label: 'SaaS' },
  { keywords: ['cybersecurity', 'infosec', 'security', 'zero trust', 'identity'], label: 'Cybersecurity' },
  { keywords: ['robotics', 'autonomous', 'automation', 'hardware', 'drone'], label: 'Robotics/Hardware' },
  { keywords: ['edtech', 'education technology', 'learning', 'e-learning'], label: 'EdTech' },
  { keywords: ['proptech', 'real estate tech', 'property technology'], label: 'PropTech' },
  { keywords: ['logistics', 'supply chain', 'freight', 'last mile', 'delivery'], label: 'Logistics' },
  { keywords: ['consumer', 'd2c', 'marketplace', 'e-commerce', 'retail tech'], label: 'Consumer/Commerce' },
  { keywords: ['space', 'aerospace', 'satellite'], label: 'Space' },
  { keywords: ['quantum', 'quantum computing'], label: 'Quantum' },
  { keywords: ['developer tools', 'devtools', 'infrastructure', 'developer platform'], label: 'DevTools' },
  { keywords: ['agtech', 'agriculture', 'food tech', 'farming'], label: 'AgTech' },
];

// ── Stage keywords ──
const STAGE_PATTERNS = [
  { pattern: /\bpre[- ]?seed\b/i, label: 'Pre-Seed' },
  { pattern: /\bseed\b(?! round| stage)/i, label: 'Seed' },
  { pattern: /\bseries\s*a\b/i, label: 'Series A' },
  { pattern: /\bseries\s*b\b/i, label: 'Series B' },
  { pattern: /\bgrowth\s*(stage|equity|round)?\b/i, label: 'Growth' },
  { pattern: /\bearly[- ]stage\b/i, label: 'Early Stage' },
  { pattern: /\blate[- ]stage\b/i, label: 'Late Stage' },
];

// ── Check size extraction ($5M, $50M, etc.) ──
const CHECK_SIZE_PATTERN = /\$(\d+(?:\.\d+)?)\s*(k|m|b|million|billion|thousand)?\b/gi;

function parseUSD(amount, unit) {
  const n = parseFloat(amount);
  if (!unit) return n;
  const u = unit.toLowerCase();
  if (u === 'b' || u === 'billion') return n * 1e9;
  if (u === 'm' || u === 'million') return n * 1e6;
  if (u === 'k' || u === 'thousand') return n * 1e3;
  return n;
}

/**
 * Search Google News for investor mentions
 * Returns array of { title, content, link, pubDate }
 */
async function searchInvestorNews(investorName, firm) {
  const articles = [];

  // Build contextual queries
  const queries = [
    `"${investorName}" VC investment`,
    firm ? `"${firm}" portfolio investment` : null,
    `${investorName} ${firm || ''} startup funding`.trim(),
  ].filter(Boolean);

  const query = queries[0]; // Fast: use first query only
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const feed = await parser.parseURL(feedUrl);
    const recent = feed.items.slice(0, 6);

    for (const item of recent) {
      articles.push({
        title: item.title || '',
        content: item.contentSnippet || item.content || '',
        link: item.link || '',
        pubDate: item.pubDate || '',
        source: 'Google News'
      });
    }

    // Also try firm-specific search if first returned few results and firm differs
    if (articles.length < 3 && firm && firm !== investorName) {
      const firmQuery = `"${firm}" venture capital portfolio`;
      const firmFeed = await parser.parseURL(
        `https://news.google.com/rss/search?q=${encodeURIComponent(firmQuery)}&hl=en-US&gl=US&ceid=US:en`
      );
      for (const item of firmFeed.items.slice(0, 4)) {
        articles.push({
          title: item.title || '',
          content: item.contentSnippet || item.content || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          source: 'Google News (firm)'
        });
      }
    }
  } catch (e) {
    // Network error, return empty
  }

  return articles;
}

/**
 * Extract enrichment data from news articles for an investor
 * Returns { enrichedData, enrichmentCount }
 */
function extractInvestorDataFromArticles(articles, currentInvestor) {
  const allText = articles.map(a => `${a.title} ${a.content}`).join(' ').toLowerCase();
  const enrichedData = {};
  let enrichmentCount = 0;

  // ── 1. Sectors ──
  if (!currentInvestor.sectors || currentInvestor.sectors.length === 0) {
    const foundSectors = new Set();
    for (const sp of SECTOR_PATTERNS) {
      if (sp.keywords.some(kw => allText.includes(kw))) {
        foundSectors.add(sp.label);
      }
    }
    if (foundSectors.size > 0) {
      enrichedData.sectors = Array.from(foundSectors).slice(0, 5);
      enrichmentCount++;
    }
  }

  // ── 2. Stage ──
  if (!currentInvestor.stage || currentInvestor.stage.length === 0) {
    const foundStages = new Set();
    for (const sp of STAGE_PATTERNS) {
      if (sp.pattern.test(allText)) foundStages.add(sp.label);
    }
    if (foundStages.size > 0) {
      enrichedData.stage = Array.from(foundStages).slice(0, 4);
      enrichmentCount++;
    }
  }

  // ── 3. Check size ──
  if (!currentInvestor.check_size_min && !currentInvestor.check_size_max) {
    const amounts = [];
    for (const match of allText.matchAll(/\$(\d+(?:\.\d+)?)\s*(k|m|b|million|billion|thousand)/gi)) {
      const usd = parseUSD(match[1], match[2]);
      if (usd >= 50000 && usd <= 500000000) amounts.push(usd); // $50K to $500M range
    }
    if (amounts.length >= 2) {
      enrichedData.check_size_min = Math.min(...amounts);
      enrichedData.check_size_max = Math.max(...amounts);
      enrichmentCount++;
    } else if (amounts.length === 1) {
      // Single mention — use as midpoint estimate
      const a = amounts[0];
      enrichedData.check_size_min = Math.round(a * 0.5);
      enrichedData.check_size_max = Math.round(a * 2);
      enrichmentCount++;
    }
  }

  // ── 4. Portfolio companies from article text ──
  if (!currentInvestor.portfolio_companies || currentInvestor.portfolio_companies.length === 0) {
    // Extract company names mentioned alongside "invested in", "portfolio", "backed", "lead"
    const portfolioPattern = /(?:invested in|backed|portfolio|lead(?:s)? (?:a )?round(?: for)?|co-invested)(?: in)?\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/g;
    const found = new Set();
    const origText = articles.map(a => `${a.title} ${a.content}`).join(' ');
    for (const match of origText.matchAll(portfolioPattern)) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 40) found.add(company);
    }
    if (found.size > 0) {
      enrichedData.portfolio_companies = Array.from(found).slice(0, 10);
      enrichmentCount++;
    }
  }

  // ── 5. Investment thesis signal (if bio/thesis empty) ──
  if (!currentInvestor.investment_thesis && !currentInvestor.bio) {
    // Build a summary from article snippets that mention the investor
    const relevantSnippets = articles
      .filter(a => a.content && a.content.length > 50)
      .map(a => a.content.substring(0, 200))
      .slice(0, 2);
    if (relevantSnippets.length > 0) {
      enrichedData.inferred_bio = relevantSnippets.join(' ').replace(/\s+/g, ' ').trim();
      enrichmentCount++;
    }
  }

  // ── 6. Geographic focus ──
  if (!currentInvestor.geography_focus || currentInvestor.geography_focus.length === 0) {
    const geoMap = {
      'US': ['united states', 'silicon valley', 'san francisco', 'new york', 'us-based', 'american'],
      'Europe': ['europe', 'london', 'berlin', 'paris', 'european', 'uk-based'],
      'Global': ['global', 'worldwide', 'international'],
      'Asia': ['asia', 'singapore', 'india', 'china', 'southeast asia'],
      'LatAm': ['latin america', 'latam', 'brazil', 'mexico', 'colombia'],
    };
    const foundGeo = [];
    for (const [region, keywords] of Object.entries(geoMap)) {
      if (keywords.some(kw => allText.includes(kw))) foundGeo.push(region);
    }
    if (foundGeo.length > 0) {
      enrichedData.geography_focus = foundGeo.slice(0, 3);
      enrichmentCount++;
    }
  }

  // Metadata
  if (enrichmentCount > 0) {
    enrichedData.last_enrichment_date = new Date().toISOString();
    enrichedData.enrichment_sources = articles.slice(0, 3).map(a => ({
      title: a.title,
      url: a.link,
      date: a.pubDate
    }));
  }

  return { enrichedData, enrichmentCount };
}

module.exports = {
  searchInvestorNews,
  extractInvestorDataFromArticles,
};
