/**
 * SOURCE QUALITY FILTER
 * ======================
 * Filters out low-quality RSS feeds and headlines that aren't startup-related
 */

// Publishers known to have too much noise (not startup-focused)
const NOISY_PUBLISHERS = [
  'hacker news',
  'reddit',
  'tech news general',
  'yahoo finance',
  'msn',
  'benzinga',
  'prnewswire' // Press releases often too generic
];

// Headline patterns that are NEVER startup events
const NON_STARTUP_PATTERNS = [
  /^ask hn:/i,
  /^show hn:/i,
  /^tell hn:/i,
  /\b(trump|biden|election|congress|senate)\b/i,  // Politics
  /\b(nfl|nba|mlb|fifa|soccer|football|basketball)\b/i,  // Sports
  /\b(celebrity|kardashian|taylor swift|kanye)\b/i,  // Entertainment
  /\?$/,  // Questions
  /^(why|how|what|opinion|analysis|commentary|podcast|interview)/i,
  /\b(recipe|diet|workout|fitness|health tips)\b/i,  // Lifestyle
  /\b(tour|concert|album|movie|netflix|hbo)\b/i,  // Entertainment
];

// Patterns that indicate established companies (not startups)
const ESTABLISHED_COMPANY_PATTERNS = [
  /\b(apple|google|microsoft|amazon|meta|facebook|netflix|tesla)\b/i,
  /\b(ibm|oracle|sap|salesforce|adobe|intel|nvidia)\b/i,
  /\b(jpmorgan|goldman sachs|bank of america|wells fargo)\b/i,
  /\b(walmart|target|costco|kroger)\b/i,
];

/**
 * Check if a publisher is too noisy for startup signals
 */
function isNoisyPublisher(publisher) {
  if (!publisher) return false;
  const lower = publisher.toLowerCase();
  return NOISY_PUBLISHERS.some(noisy => lower.includes(noisy));
}

/**
 * Check if a headline is clearly not a startup event
 */
function isNonStartupHeadline(title) {
  if (!title) return true;
  return NON_STARTUP_PATTERNS.some(pattern => pattern.test(title));
}

/**
 * Check if headline is about established company (not startup)
 */
function isEstablishedCompany(title) {
  if (!title) return false;
  return ESTABLISHED_COMPANY_PATTERNS.some(pattern => pattern.test(title));
}

/**
 * Main filter function - returns true if event should be KEPT
 */
function shouldProcessEvent(title, publisher) {
  // Filter out noisy publishers
  if (isNoisyPublisher(publisher)) {
    return { keep: false, reason: 'NOISY_PUBLISHER' };
  }
  
  // Filter out non-startup headlines
  if (isNonStartupHeadline(title)) {
    return { keep: false, reason: 'NON_STARTUP_HEADLINE' };
  }
  
  // Filter out established companies (unless it's about acquisitions)
  if (isEstablishedCompany(title) && !/\b(acquires|acquisition|buys|purchases)\b/i.test(title)) {
    return { keep: false, reason: 'ESTABLISHED_COMPANY' };
  }
  
  return { keep: true, reason: 'PASSED_FILTERS' };
}

module.exports = {
  shouldProcessEvent,
  isNoisyPublisher,
  isNonStartupHeadline,
  isEstablishedCompany,
  NOISY_PUBLISHERS,
  NON_STARTUP_PATTERNS,
  ESTABLISHED_COMPANY_PATTERNS
};
