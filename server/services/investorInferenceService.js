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

  return { enrichedData, enrichmentCount };
}

// ── Tech/investment theme keywords for Oracle "next bet" prediction ──
const THESIS_THEME_PATTERNS = [
  { pattern: /\bgenerative\s*ai\b|\bgen[- ]?ai\b|\bllm\b|\bgpt\b|\bchatbot\b/i, label: 'Generative AI' },
  { pattern: /\bfoundation\s*model\b|\bagent(?:ic)?\b|\bai\s*agent\b/i, label: 'AI Agents' },
  { pattern: /\bclimate\b|\bnet[- ]?zero\b|\bcarbon\s*capture\b|\bcleantech\b/i, label: 'Climate Tech' },
  { pattern: /\bdefense\s*tech\b|\bdual[- ]?use\b|\bmilitary\b|\bnational\s*security\b/i, label: 'Defense Tech' },
  { pattern: /\bbioinformatics\b|\bdrug\s*discovery\b|\bprecision\s*medicine\b/i, label: 'Bio/Pharma AI' },
  { pattern: /\binfrastructure\b|\bdev(?:eloper)?\s*tools?\b|\bplatform\s*play\b/i, label: 'Dev Infrastructure' },
  { pattern: /\bfinancial\s*ai\b|\bwealthtech\b|\binsurtech\b|\bregtech\b/i, label: 'FinTech AI' },
  { pattern: /\bspatial\s*computing\b|\baugmented\s*reality\b|\bvirtual\s*reality\b|\bxr\b/i, label: 'Spatial Computing' },
  { pattern: /\bquantum\s*computing\b/i, label: 'Quantum' },
  { pattern: /\bautonomous\s*vehicle\b|\bself[- ]driving\b|\bev\b|\belectric\s*vehicle\b/i, label: 'Autonomous/EV' },
  { pattern: /\bspace\s*tech\b|\bsatellite\b|\borbital\b/i, label: 'Space Tech' },
  { pattern: /\bweb3\b|\bblockchain\b|\bcrypto\b|\bdefi\b|\bnft\b/i, label: 'Web3/Crypto' },
  { pattern: /\bhuman\s*longevity\b|\banti[- ]aging\b|\blifespan\b|\bbiohacking\b/i, label: 'Longevity/Health' },
  { pattern: /\bmanufacturing\b|\bindustrialtech\b|\bindustry\s*4\b|\brobotic\s*process\b/i, label: 'Industrial AI' },
];

// ── Recent deal extraction patterns ──
const RECENT_DEAL_PATTERN = /(?:lead(?:s|ing)?|invests?(?:ing)?|backs?|funded?|announce(?:s|d)?)\s+(?:\$[\d.]+[MKBmkb]?\s+(?:in|round))?\s*([A-Z][A-Za-z0-9\s]{2,35}?)(?:\s*,|\s+(?:a|an|the|in|at|series|seed|round))/g;

/**
 * Build Oracle prediction signals for an investor.
 * 
 * Returns { signals, focus_areas, last_investment_date }
 * - signals[]: array of typed signal objects for Oracle matching/prediction
 * - focus_areas: JSONB summary of investment thesis + current themes
 * - last_investment_date: most recent investment date parsed from news
 */
function buildOracleSignals(investor, articles) {
  const allText = articles.map(a => `${a.title} ${a.content}`).join(' ');
  const allTextLower = allText.toLowerCase();
  const signals = [];
  const now = new Date().toISOString();

  // ── 1. Active sector signals (from news + existing investor data) ──
  const activeSectors = new Set(investor.sectors || []);
  for (const sp of SECTOR_PATTERNS) {
    if (sp.keywords.some(kw => allTextLower.includes(kw))) {
      activeSectors.add(sp.label);
    }
  }
  for (const sector of activeSectors) {
    // Measure intensity: how often mentioned in news
    const mentions = (allTextLower.match(new RegExp(sector.toLowerCase().replace(/[/]/g, '.'), 'gi')) || []).length;
    signals.push({
      type: 'active_sector',
      label: sector,
      confidence: Math.min(0.95, 0.5 + mentions * 0.05),
      source: investor.sectors?.includes(sector) ? 'profile' : 'news',
      detected_at: now,
    });
  }

  // ── 2. Investment stage signals ──
  const activeStages = new Set(investor.stage || []);
  for (const sp of STAGE_PATTERNS) {
    if (sp.pattern.test(allText)) activeStages.add(sp.label);
  }
  for (const stage of activeStages) {
    signals.push({
      type: 'investment_stage',
      label: stage,
      confidence: investor.stage?.includes(stage) ? 0.90 : 0.65,
      source: investor.stage?.includes(stage) ? 'profile' : 'news',
      detected_at: now,
    });
  }

  // ── 3. Thesis theme signals (Oracle "next bet" predictors) ──
  const detectedThemes = [];
  for (const tp of THESIS_THEME_PATTERNS) {
    if (tp.pattern.test(allText)) {
      const mentions = (allText.match(tp.pattern) || []).length;
      detectedThemes.push({ label: tp.label, mentions });
      signals.push({
        type: 'thesis_theme',
        label: tp.label,
        confidence: Math.min(0.95, 0.55 + mentions * 0.08),
        source: 'news',
        detected_at: now,
      });
    }
  }

  // ── 4. Recent deal signals ──
  const recentDeals = [];
  const dealMatches = allText.matchAll(RECENT_DEAL_PATTERN);
  for (const match of dealMatches) {
    const company = match[1]?.trim();
    if (company && company.length > 2 && company.length < 40 &&
        !/^(the|a|an|in|at|for|with|by|and|or|its|this|that|their)$/i.test(company)) {
      recentDeals.push(company);
    }
  }
  const uniqueDeals = [...new Set(recentDeals)].slice(0, 5);
  for (const deal of uniqueDeals) {
    signals.push({
      type: 'recent_deal',
      company: deal,
      confidence: 0.6,
      source: 'news',
      detected_at: now,
    });
  }

  // ── 5. Deployment/activity signal ──
  const deployVelocity = investor.deployment_velocity_index;
  const capitalPower = investor.capital_power_score;
  if (deployVelocity || capitalPower) {
    signals.push({
      type: 'deployment_signal',
      label: deployVelocity > 0.7 ? 'actively_deploying' : deployVelocity > 0.4 ? 'moderate_pace' : 'selective',
      velocity_index: deployVelocity || null,
      capital_power: capitalPower || null,
      source: 'computed',
      detected_at: now,
    });
  } else if (articles.length > 2) {
    // News implies activity
    signals.push({
      type: 'deployment_signal',
      label: 'news_active',
      confidence: 0.5,
      source: 'news',
      detected_at: now,
    });
  }

  // ── 6. Geographic focus signal ──
  const geoMap = {
    'US': ['united states','silicon valley','san francisco','new york','us-based','american','boston','austin','los angeles'],
    'Europe': ['europe','london','berlin','paris','european','uk-based','amsterdam','stockholm'],
    'Global': ['global','worldwide','international','cross-border'],
    'Asia': ['asia','singapore','india','china','southeast asia','tokyo','seoul'],
    'LatAm': ['latin america','latam','brazil','mexico','colombia'],
  };
  for (const [region, keywords] of Object.entries(geoMap)) {
    if (keywords.some(kw => allTextLower.includes(kw))) {
      signals.push({ type: 'geographic_focus', label: region, source: 'news', detected_at: now });
    }
  }

  // ── Build focus_areas summary ──
  const sectorSignals = signals.filter(s => s.type === 'active_sector');
  const stageSignals = signals.filter(s => s.type === 'investment_stage');
  const geoSignals = signals.filter(s => s.type === 'geographic_focus');
  const themeSignals = signals.filter(s => s.type === 'thesis_theme').sort((a,b) => b.confidence - a.confidence);

  const focus_areas = {
    primary_sectors: sectorSignals.sort((a,b) => b.confidence - a.confidence).slice(0,5).map(s=>s.label),
    preferred_stages: stageSignals.slice(0,4).map(s=>s.label),
    geographic_focus: geoSignals.map(s=>s.label),
    trending_themes: themeSignals.slice(0,5).map(s=>s.label),
    recent_portfolio: uniqueDeals,
    avg_check_size_usd: (investor.check_size_min && investor.check_size_max)
      ? Math.round((investor.check_size_min + investor.check_size_max) / 2)
      : null,
    thesis_keywords: detectedThemes.sort((a,b)=>b.mentions-a.mentions).slice(0,8).map(t=>t.label),
    last_computed: now,
  };

  // ── Last investment date — look for date patterns in articles ──
  let last_investment_date = null;
  const datePatterns = [
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}/gi,
    /\d{4}[-/]\d{2}[-/]\d{2}/g,
  ];
  const articleDates = [];
  for (const a of articles) {
    // Prefer pubDate from RSS
    if (a.pubDate) {
      try {
        const d = new Date(a.pubDate);
        if (!isNaN(d.getTime())) articleDates.push(d);
      } catch{}
    }
    for (const pattern of datePatterns) {
      for (const match of (`${a.title} ${a.content}`).matchAll(pattern)) {
        try {
          const d = new Date(match[0]);
          if (!isNaN(d.getTime()) && d.getFullYear() >= 2020) articleDates.push(d);
        } catch{}
      }
    }
  }
  if (articleDates.length > 0) {
    articleDates.sort((a,b) => b.getTime() - a.getTime());
    last_investment_date = articleDates[0].toISOString().split('T')[0];
  }

  return { signals, focus_areas, last_investment_date };
}

module.exports = {
  searchInvestorNews,
  extractInvestorDataFromArticles,
  buildOracleSignals,
};
