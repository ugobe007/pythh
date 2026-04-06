/**
 * Heuristics: startup "website" field that is actually a news article URL.
 * Used by data-integrity-check and audit-junk-entries.
 */

const NEWS_DOMAINS = [
  'techcrunch.com',
  'ventureburn.com',
  'cleantechnica.com',
  'pehub.com',
  'reuters.com',
  'bloomberg.com',
  'forbes.com',
  'wsj.com',
  'ft.com',
  'axios.com',
  'cnbc.com',
  'businessinsider.com',
  'fortune.com',
  'crunchbase.com',
  'sifted.eu',
  'eu-startups.com',
  'thenextweb.com',
  'venturebeat.com',
  'wired.com',
  'techeu.com',
  'tech.eu',
  'startupbeat.com',
  'geekwire.com',
  'bizjournals.com',
  'inc.com',
  'fastcompany.com',
  'theregister.com',
  'zdnet.com',
  'mashable.com',
];

const ARTICLE_PATTERNS = [
  /\/\d{4}\/\d{2}\/\d{2}\//,
  /\/blog\//,
  /\/news\//,
  /\/press\//,
  /\/article/,
  /\/story\//,
  /\.html$/,
  /\/\d{5,}/,
];

/**
 * @param {string | null | undefined} website
 * @returns {{ suspicious: boolean, reason: 'news_domain' | 'article_pattern' | null }}
 */
function classifySuspiciousStartupWebsite(website) {
  if (!website || typeof website !== 'string') {
    return { suspicious: false, reason: null };
  }
  const url = website.toLowerCase();
  const isNewsDomain = NEWS_DOMAINS.some((d) => url.includes(d + '/'));
  if (isNewsDomain) return { suspicious: true, reason: 'news_domain' };
  const isArticlePattern = ARTICLE_PATTERNS.some((p) => p.test(url));
  if (isArticlePattern) return { suspicious: true, reason: 'article_pattern' };
  return { suspicious: false, reason: null };
}

module.exports = {
  NEWS_DOMAINS,
  ARTICLE_PATTERNS,
  classifySuspiciousStartupWebsite,
};
