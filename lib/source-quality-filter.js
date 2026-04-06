/**
 * SOURCE QUALITY FILTER
 * ======================
 * Filters out low-quality RSS feeds and headlines that aren't startup-related.
 *
 * Integrated into:
 *   - scripts/core/ssot-rss-scraper.js (before startup_events upsert; metrics.source_quality)
 *   - scripts/core/simple-rss-scraper.js + scrapers/simple-rss-scraper.js (discovered_startups)
 *   - scripts/fetch-rss-articles.js (long-form bodies → discovered_startups)
 *   - scripts/enrich-from-rss-news.js (skip low-quality startup_events when matching startups)
 *   - scripts/ingest-discovered-signals.js (second line of defense before pythh_signal_events)
 *
 * Escape hatch (debug / A-B): SKIP_SOURCE_QUALITY_FILTER=1
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
  /\b(ibm|oracle|sap|salesforce|adobe|intel|nvidia|qualcomm|amd)\b/i,
  /\b(jpmorgan|goldman sachs|bank of america|wells fargo|citigroup|morgan stanley)\b/i,
  /\b(walmart|target|costco|kroger|home depot|lowes|cvs|walgreens)\b/i,
  /\b(uber|lyft|airbnb|doordash|instacart|grubhub|postmates)\b/i,
  /\b(linkedin|twitter|x\.com|snapchat|pinterest|reddit|discord|slack)\b/i,
  /\b(shopify|squarespace|wix|wordpress|godaddy|hubspot|zendesk)\b/i,
  /\b(cloudflare|fastly|akamai|twilio|sendgrid|okta|datadog|splunk)\b/i,
  /\b(coinbase|robinhood|chime|venmo|zelle|cash app|paypal)\b/i,
  /\b(snowflake|databricks|palantir|servicenow|workday|atlassian)\b/i,
  /\b(grindr|bumble|tinder|hinge|match\.com)\b/i,
  /\b(statista|crunchbase|pitchbook|cb insights)\b/i,
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

function isSourceQualityFilterDisabled() {
  const v = process.env.SKIP_SOURCE_QUALITY_FILTER;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Main filter function — returns { keep, reason } if event should be KEPT for pipelines.
 */
function shouldProcessEvent(title, publisher) {
  if (isSourceQualityFilterDisabled()) {
    return { keep: true, reason: 'FILTER_DISABLED' };
  }
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
  isSourceQualityFilterDisabled,
  NOISY_PUBLISHERS,
  NON_STARTUP_PATTERNS,
  ESTABLISHED_COMPANY_PATTERNS
};
