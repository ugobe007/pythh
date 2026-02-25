/**
 * JUNK URL CONFIG — Shared across all scrapers and enrichment scripts
 *
 * This is the SINGLE SOURCE OF TRUTH for "what domains are NOT startup websites."
 * URLs from these domains are article links, news coverage, directories, or
 * social media — NOT the startup's own website.
 *
 * RULE: Any script that writes to `startup_uploads.website` or uses a URL for
 * HTML scraping MUST filter through `isJunkUrl()` before storing/fetching.
 *
 * Used by:
 *   - scripts/core/ssot-rss-scraper.js  (PUBLISHER_DOMAINS set)
 *   - scripts/enrich-sparse-startups.js (fetchWebsiteHtml gate)
 *   - server/services/inferenceService.js (news query cleanup)
 *
 * HOW TO MAINTAIN:
 *   1. When a new news/aggregator site keeps appearing in the website field,
 *      add it here — NOT to the individual scripts.
 *   2. Run `node scripts/test-enrichment-pipeline.js` after making changes.
 */

'use strict';

// All known publisher / aggregator / social / job-board domains.
// Stored as a Set for O(1) lookup.
const JUNK_DOMAINS = new Set([
  // — Major tech & business news —
  'techcrunch.com',
  'venturebeat.com',
  'forbes.com',
  'bloomberg.com',
  'reuters.com',
  'cnbc.com',
  'wsj.com',
  'nytimes.com',
  'theverge.com',
  'wired.com',
  'businessinsider.com',
  'inc.com',
  'axios.com',
  'fastcompany.com',
  'arstechnica.com',
  'theregister.com',
  'zdnet.com',
  'engadget.com',
  'gizmodo.com',
  'mashable.com',
  'techmeme.com',
  'bbc.com',
  'cnn.com',
  'theguardian.com',
  'entrepreneur.com',

  // — Wire services / press releases —
  'businesswire.com',
  'prnewswire.com',
  'globenewswire.com',
  'cision.com',
  'einpresswire.com',
  'accesswire.com',

  // — Crypto / fintech news —
  'decrypt.co',
  'coindesk.com',
  'cointelegraph.com',
  'theblock.co',
  'pymnts.com',

  // — Regional & funding news —
  'contxto.com',
  'euronews.com',
  'sifted.eu',
  'startupnews.fyi',
  'techeu.eu',
  'silicon.co.uk',
  'analyticsindiamag.com',
  'arcticstartup.com',
  'techfundingnews.com',
  'finsmes.com',
  'geekwire.com',
  'eu-startups.com',
  'tech.eu',
  'strictlyvc.com',
  'pulse2.com',
  'inc42.com',
  'startupbeat.com',

  // — Startup directories & databases —
  'crunchbase.com',
  'pitchbook.com',
  'angellist.com',
  'ycombinator.com',
  'news.ycombinator.com',
  'producthunt.com',
  'betalist.com',
  'f6s.com',
  'startupblink.com',
  'dealroom.co',
  'mattermark.com',
  'avc.com',
  'strictlyvc.com',

  // — Content platforms —
  'medium.com',
  'substack.com',
  'mirror.xyz',

  // — Social & video —
  'linkedin.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'threads.net',
  'reddit.com',
  'youtube.com',
  'twitch.tv',

  // — Tech giants (not startups) —
  'google.com',
  'google.co',
  'apple.com',
  'amazon.com',
  'microsoft.com',
  'ibm.com',

  // — App stores & marketplaces —
  'apps.apple.com',
  'play.google.com',
  'chrome.google.com',

  // — Code platforms —
  'github.com',
  'gitlab.com',
  'stackoverflow.com',

  // — Job boards —
  'venturefizz.com',
  'lever.co',
  'greenhouse.io',
  'workable.com',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
  'wellfound.com',
  'indeed.com',
  'glassdoor.com',

  // — Other major consumer brands —
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'costco.com',
  'spotify.com',
  'netflix.com',
]);

/**
 * Returns true if the URL is a news article, aggregator, social, or job-board link
 * and should NOT be treated as a startup's official website.
 *
 * Two detection strategies:
 *   1. Domain in JUNK_DOMAINS lookup (O(1))
 *   2. Deep article path: 3+ path segments (e.g. /2026/01/26/title-of-article)
 *
 * @param {string} url
 * @returns {boolean}
 */
function isJunkUrl(url) {
  if (!url || typeof url !== 'string') return false;
  // Normalise: add scheme if missing so URL parser works
  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  try {
    const u = new URL(fullUrl);
    const hostname = u.hostname.replace(/^www\./, '').toLowerCase();

    // 1. Known junk domain
    if (JUNK_DOMAINS.has(hostname)) return true;

    // 2. Domain ends with a known junk domain (e.g. tech.some-news.com)
    for (const junk of JUNK_DOMAINS) {
      if (hostname.endsWith('.' + junk)) return true;
    }

    // 3. Deep article-style path: 3+ non-empty segments
    //    e.g. /2026/01/26/some-story or /en/funding/company-raises-5m
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length >= 3) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Sanitise a URL that came from an RSS feed item's `link` field.
 * Returns the URL if it's a real startup website, or null if it should be discarded.
 *
 * @param {string} link - RSS article link
 * @returns {string|null}
 */
function sanitiseWebsiteUrl(link) {
  if (!link) return null;
  if (isJunkUrl(link)) return null;
  return link;
}

module.exports = { JUNK_DOMAINS, isJunkUrl, sanitiseWebsiteUrl };
