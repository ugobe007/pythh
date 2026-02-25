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
  // ── Major tech news ───────────────────────────────────────────────────────
  'techcrunch.com',
  'venturebeat.com',
  'wired.com',
  'theverge.com',
  'arstechnica.com',
  'engadget.com',
  'cnet.com',
  'zdnet.com',
  'thenextweb.com',
  'mashable.com',
  'fastcompany.com',
  'inc.com',
  'entrepreneur.com',
  'businessinsider.com',

  // ── Startup / VC news ─────────────────────────────────────────────────────
  'pulse2.com',
  'techfundingnews.com',
  'sifted.eu',
  'technode.com',
  'inc42.com',
  'contxto.com',
  'venturefizz.com',
  'techcabal.com',
  'vccafe.com',
  'startupbeat.com',
  'eu-startups.com',
  'geekwire.com',
  'axios.com',
  'pymnts.com',
  'finsmes.com',
  'sfstandard.com',
  'strictlyvc.com',
  'disruptafrica.com',
  'old.disruptafrica.com',
  'yourstory.com',
  'analyticsindiamag.com',
  'brandlabs.inc42.com',
  'mattermark.com',

  // ── General financial / business news ─────────────────────────────────────
  'bloomberg.com',
  'reuters.com',
  'wsj.com',
  'ft.com',
  'forbes.com',
  'fortune.com',
  'cnbc.com',
  'nytimes.com',
  'washingtonpost.com',
  'economist.com',

  // ── Tech / science media ──────────────────────────────────────────────────
  'technologyreview.com',
  'statnews.com',
  'medcitynews.com',
  'theblock.co',
  'decrypt.co',
  'cointelegraph.com',
  'cleantechnica.com',
  'actu.epita.fr',
  'betakit.com',
  'biztoc.com',
  'arcticstartup.com',
  'techmeme.com',

  // ── News aggregators ──────────────────────────────────────────────────────
  'news.google.com',
  'msn.com',
  'yahoo.com',
  'apple.news',

  // ── Developer / community ─────────────────────────────────────────────────
  'stackoverflow.blog',
  'discuss.python.org',
  'dev.to',
  'hackernews.com',
  'news.ycombinator.com',

  // ── Social / video ────────────────────────────────────────────────────────
  'twitter.com',
  'x.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'threads.net',
  'reddit.com',
  'youtube.com',
  'gaming.youtube.com',
  'twitch.tv',
  'tiktok.com',
  'mirror.xyz',

  // ── Startup directories / job boards ────────────────────────────────────
  'ycombinator.com',
  'producthunt.com',
  'wellfound.com',
  'angellist.com',
  'crunchbase.com',
  'ventureradar.com',
  'lever.co',
  'jobs.ashbyhq.com',
  'workable.com',
  'greenhouse.io',

  // ── Publisher / media properties ─────────────────────────────────────────
  'about.gitlab.com',
  'medium.com',
  'post.substack.com',
  'marketplace.atlassian.com',

  // ── App stores ────────────────────────────────────────────────────────────
  'apps.apple.com',
  'play.google.com',
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
