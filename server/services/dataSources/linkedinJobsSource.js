/**
 * LINKEDIN JOBS DATA SOURCE
 *
 * Discovers hiring signals by querying Google's search index for LinkedIn job
 * postings associated with a company. No LinkedIn API key needed — uses the
 * same Google News RSS infrastructure already in inferenceService.js.
 *
 * Additionally queries the Hacker News "Who is Hiring" threads for mentions
 * of the company, and Google search for general "is hiring" mentions.
 *
 * Signals produced (all from HIRING_* and COMPENSATION_* categories):
 *   GENERAL_HIRING        — company has open roles
 *   UPMARKET_MOVE         — enterprise sales roles
 *   SALES_PUSH            — sales / AE / SDR roles
 *   INFRA_SCALING         — devops / platform / SRE roles
 *   PEOPLE_SCALING        — HR / talent / recruiting roles
 *   FUNDRAISE_PREP_HIRE   — CFO / FP&A / investor relations
 *   ACQUISITION_PREP_HIRE — corp dev roles
 *   AI_PUSH               — ML / AI engineer roles
 *   CLEVEL_HIRE           — CXO / VP-level announcement
 *   HIRING_FREEZE         — "no longer hiring" / "paused hiring" mentions
 *   COMPETITIVE_COMP      — "competitive equity" / "above market" comp
 *
 * Each signal carries { signal, category, strength, detectedAt, source, evidence }
 */

'use strict';

const Parser = require('rss-parser');

const TIMEOUT_MS = 15_000;
const parser = new Parser({
  timeout: TIMEOUT_MS,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PythhBot/1.0; +https://pythh.ai)' },
});

// Job title → signal mapping (ordered: more specific first)
const ROLE_SIGNAL_MAP = [
  // Finance / fundraise signals (highest value)
  { patterns: ['investor relations', 'vp finance', 'head of finance', 'chief financial', 'fp&a', 'financial planning', 'controller'], signal: 'FUNDRAISE_PREP_HIRE', strength: 0.85 },
  // Corp dev / M&A
  { patterns: ['corporate development', 'corp dev', 'mergers and acquisitions', 'm&a'], signal: 'ACQUISITION_PREP_HIRE', strength: 0.88 },
  // C-suite / VP
  { patterns: ['chief executive', 'chief technology', 'chief operating', 'chief revenue', 'vp of engineering', 'vp engineering', 'vp of product', 'vice president'], signal: 'CLEVEL_HIRE', strength: 0.85 },
  // Enterprise sales
  { patterns: ['enterprise account', 'enterprise sales', 'enterprise ae', 'strategic account', 'vp of sales', 'vp sales', 'chief revenue'], signal: 'UPMARKET_MOVE', strength: 0.85 },
  // Sales
  { patterns: ['account executive', 'sales development', 'sdr', 'business development', 'revenue operations'], signal: 'SALES_PUSH', strength: 0.78 },
  // ML / AI
  { patterns: ['machine learning', 'ml engineer', 'ai engineer', 'research scientist', 'llm', 'deep learning'], signal: 'AI_PUSH', strength: 0.78 },
  // Infrastructure
  { patterns: ['devops', 'site reliability', 'sre', 'platform engineer', 'infrastructure engineer', 'cloud engineer'], signal: 'INFRA_SCALING', strength: 0.75 },
  // People / recruiting
  { patterns: ['head of people', 'vp of people', 'chief people', 'talent acquisition', 'recruiting lead', 'hr director'], signal: 'PEOPLE_SCALING', strength: 0.80 },
  // General hiring (broad)
  { patterns: ['software engineer', 'product manager', 'designer', 'data engineer', 'data scientist', 'marketing manager'], signal: 'GENERAL_HIRING', strength: 0.65 },
];

// Freeze / negative hiring signals
const FREEZE_PATTERNS = [
  'hiring freeze', 'pausing hiring', 'no longer hiring', 'pause on hiring',
  'hiring on hold', 'restructuring team', 'rightsizing',
];

// Compensation signals
const COMP_POSITIVE_PATTERNS = [
  'competitive equity', 'above market', 'top of market', 'generous equity',
  'pre-ipo equity', 'signing bonus', 'rsu', 'restricted stock',
];

/**
 * Classify job text into a signal.
 */
function classifyJobText(text) {
  const lower = text.toLowerCase();

  // Check freeze signals first
  if (FREEZE_PATTERNS.some(p => lower.includes(p))) {
    return { signal: 'HIRING_FREEZE', category: 'HIRING_TROUBLE', strength: 0.85 };
  }

  // Compensation signals
  if (COMP_POSITIVE_PATTERNS.some(p => lower.includes(p))) {
    return { signal: 'COMPETITIVE_COMP', category: 'COMPENSATION_POSITIVE', strength: 0.72 };
  }

  // Role signals
  for (const { patterns, signal, strength } of ROLE_SIGNAL_MAP) {
    if (patterns.some(p => lower.includes(p))) {
      // Map signal to category
      const category = signal.startsWith('HIRING') ? 'HIRING_TROUBLE'
                     : ['FUNDRAISE_PREP_HIRE', 'ACQUISITION_PREP_HIRE'].includes(signal) ? 'HIRING_ROLE_SIGNAL'
                     : signal === 'CLEVEL_HIRE' ? 'TALENT_INBOUND'
                     : signal === 'UPMARKET_MOVE' ? 'HIRING_GROWTH'
                     : signal === 'SALES_PUSH' ? 'HIRING_GROWTH'
                     : signal === 'AI_PUSH' ? 'HIRING_ROLE_SIGNAL'
                     : signal === 'INFRA_SCALING' ? 'HIRING_GROWTH'
                     : signal === 'PEOPLE_SCALING' ? 'HIRING_GROWTH'
                     : 'HIRING_GROWTH';
      return { signal, category, strength };
    }
  }

  return null;
}

/**
 * Build Google search RSS URL for LinkedIn job postings.
 */
function buildLinkedInSearchUrl(companyName) {
  const q = encodeURIComponent(`site:linkedin.com/jobs "${companyName}" hiring`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Build Google News search for hiring announcements.
 */
function buildHiringNewsUrl(companyName) {
  const q = encodeURIComponent(`"${companyName}" hiring OR "joins as" OR "appointed" OR "named VP"`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

/**
 * Build Hacker News "Who is Hiring" search URL.
 */
function buildHNHiringUrl(companyName) {
  const q = encodeURIComponent(`${companyName}`);
  return `https://hnrss.org/whoishiring?q=${q}&count=10`;
}

async function parseFeed(url) {
  try {
    return await Promise.race([
      parser.parseURL(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('feed timeout')), TIMEOUT_MS)
      ),
    ]);
  } catch {
    return { items: [] };
  }
}

/**
 * Main entry point.
 *
 * @param {string} companyName
 * @returns {Promise<Array<SignalResult>>}
 */
async function fetchLinkedinJobSignals(companyName) {
  const now     = Date.now();
  const signals = [];

  const [linkedInFeed, newsFeed, hnFeed] = await Promise.allSettled([
    parseFeed(buildLinkedInSearchUrl(companyName)),
    parseFeed(buildHiringNewsUrl(companyName)),
    parseFeed(buildHNHiringUrl(companyName)),
  ]);

  const allItems = [
    ...((linkedInFeed.status === 'fulfilled' ? linkedInFeed.value.items : []) || []),
    ...((newsFeed.status    === 'fulfilled' ? newsFeed.value.items    : []) || []),
    ...((hnFeed.status      === 'fulfilled' ? hnFeed.value.items      : []) || []),
  ];

  if (allItems.length === 0) return signals;

  // Track which signals have been produced to avoid duplicates
  const produced = new Set();
  let generalHiringCount = 0;

  for (const item of allItems) {
    const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;

    // Only process items that mention the company
    if (!text.toLowerCase().includes(companyName.toLowerCase().slice(0, 6))) continue;

    const classification = classifyJobText(text);
    if (!classification) {
      generalHiringCount++;
      continue;
    }

    const key = classification.signal;
    if (produced.has(key)) continue;
    produced.add(key);

    signals.push({
      signal:     classification.signal,
      category:   classification.category,
      strength:   classification.strength,
      detectedAt: item.pubDate ? new Date(item.pubDate).getTime() : now,
      source:     item.link?.includes('linkedin') ? 'linkedin' : item.link?.includes('ycombinator') ? 'hackernews' : 'news',
      evidence:   (item.title || '').slice(0, 120),
    });
  }

  // General hiring signal if multiple unclassified hiring mentions
  if (generalHiringCount >= 3 && !produced.has('GENERAL_HIRING')) {
    signals.push({
      signal:     'GENERAL_HIRING',
      category:   'HIRING_GROWTH',
      strength:   0.70,
      detectedAt: now,
      source:     'news',
      evidence:   `${generalHiringCount} hiring-related articles found`,
    });
  }

  if (process.env.DEBUG_INFERENCE === '1' && signals.length > 0) {
    console.log(`[linkedinJobsSource] ${companyName}: ${signals.length} hiring signals`);
  }

  return signals;
}

module.exports = { fetchLinkedinJobSignals };
