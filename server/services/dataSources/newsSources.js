/**
 * PYTHH NEWS SOURCE REGISTRY
 *
 * Defines every publication, press wire, VC outlet, and community platform
 * Pythh can pull signal from. Sources are organized into tiers:
 *
 *   TIER 1 — Core (always run): highest signal density, lowest noise
 *   TIER 2 — Extended (run in parallel): good signal, more volume
 *   TIER 3 — Community (run if core is thin): early-stage signals
 *
 * Two source types:
 *   GOOGLE_SITE — company-specific search via Google News site: filter
 *                 Best for: named company lookup, funded startups
 *   DIRECT_RSS  — parse the source's own RSS feed and filter by company name
 *                 Best for: platforms Google doesn't index well (Product Hunt, etc.)
 *
 * Each source entry:
 *   key         — machine identifier
 *   label       — display name for logging
 *   type        — 'GOOGLE_SITE' | 'DIRECT_RSS'
 *   url(name)   — function returning the query URL for a given company name
 *   rssUrl      — (DIRECT_RSS only) static feed URL to parse
 *   timeout     — ms before abandoning this source
 *   tier        — 1 | 2 | 3
 *   category    — signal category hint for logging
 *   strict      — if true, require strong name correlation (default true)
 */

'use strict';

const GN = (query) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

const HN = (name) =>
  `https://hnrss.org/newest?q=${encodeURIComponent(`"${name}"`)}&count=5`;

const REDDIT = (sub, name) =>
  `https://www.reddit.com/r/${sub}/search.rss?q=${encodeURIComponent(name)}&restrict_sr=1&sort=relevance&limit=5`;

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — Core sources (always queried)
// Highest signal density: press releases, major tech publications, HN
// ─────────────────────────────────────────────────────────────────────────────
const TIER1 = [
  {
    key: 'prnewswire', label: 'PR Newswire', tier: 1,
    category: 'press_release', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:prnewswire.com`),
  },
  {
    key: 'businesswire', label: 'Business Wire', tier: 1,
    category: 'press_release', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:businesswire.com`),
  },
  {
    key: 'globenewswire', label: 'GlobeNewswire', tier: 1,
    category: 'press_release', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:globenewswire.com`),
  },
  {
    key: 'techcrunch', label: 'TechCrunch', tier: 1,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:techcrunch.com`),
  },
  {
    key: 'venturebeat', label: 'VentureBeat', tier: 1,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:venturebeat.com`),
  },
  {
    key: 'hackerNews', label: 'Hacker News', tier: 1,
    category: 'dev_community', timeout: 6000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => HN(name),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — Extended sources (queried in parallel with Tier 1)
// Broader coverage: VC newsletters, regional, enterprise, more press outlets
// ─────────────────────────────────────────────────────────────────────────────
const TIER2 = [

  // ── VC & Deal Intelligence ────────────────────────────────────────────────
  {
    key: 'axios', label: 'Axios Pro Rata', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:axios.com`),
  },
  {
    key: 'fortune', label: 'Fortune Term Sheet', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:fortune.com`),
  },
  {
    key: 'crunchbase', label: 'Crunchbase News', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:news.crunchbase.com`),
  },
  {
    key: 'pitchbook', label: 'PitchBook', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:pitchbook.com`),
  },
  {
    key: 'peHub', label: 'PE Hub', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:pehub.com`),
  },
  {
    key: 'strictlyvc', label: 'StrictlyVC', tier: 2,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:strictlyvc.com`),
  },

  // ── Enterprise / Deep Tech Publications ──────────────────────────────────
  {
    key: 'siliconangle', label: 'SiliconANGLE', tier: 2,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:siliconangle.com`),
  },
  {
    key: 'theregister', label: 'The Register', tier: 2,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:theregister.com`),
  },
  {
    key: 'informationweek', label: 'InformationWeek', tier: 2,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:informationweek.com`),
  },

  // ── Regional Startup News ─────────────────────────────────────────────────
  {
    key: 'geekwire', label: 'GeekWire', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:geekwire.com`),
  },
  {
    key: 'alleywatch', label: 'AlleyWatch', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:alleywatch.com`),
  },
  {
    key: 'sifted', label: 'Sifted', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:sifted.eu`),
  },
  {
    key: 'eustartups', label: 'EU-Startups', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:eu-startups.com`),
  },
  {
    key: 'refreshmiami', label: 'Refresh Miami', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:refreshmiami.com`),
  },
  {
    key: 'builtin', label: 'Built In', tier: 2,
    category: 'regional', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:builtin.com`),
  },
  {
    key: 'startupbeat', label: 'StartupBeat', tier: 2,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:startupbeat.com`),
  },

  // ── Newsletters & Substacks ────────────────────────────────────────────────
  {
    key: 'substack', label: 'Substack', tier: 2,
    category: 'newsletter', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:substack.com`),
  },
  {
    key: 'notboring', label: 'Not Boring', tier: 2,
    category: 'newsletter', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:notboring.co`),
  },

  // ── Community Sources ─────────────────────────────────────────────────────
  {
    key: 'reddit', label: 'Reddit', tier: 2,
    category: 'community', timeout: 8000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => `https://www.reddit.com/search.rss?q=${encodeURIComponent(`"${name}" startup`)}&sort=relevance&limit=5&t=all`,
  },
  {
    key: 'redditYC', label: 'Reddit/YC', tier: 2,
    category: 'community', timeout: 8000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => REDDIT('YCombinator', name),
  },
  {
    key: 'redditStartups', label: 'Reddit/startups', tier: 2,
    category: 'community', timeout: 8000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => REDDIT('startups', name),
  },
  {
    key: 'hnWhoIsHiring', label: 'HN Who Is Hiring', tier: 2,
    category: 'community', timeout: 6000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => `https://hnrss.org/whoishiring?q=${encodeURIComponent(name)}&count=5`,
  },
  {
    key: 'hnShowHN', label: 'HN Show HN', tier: 2,
    category: 'community', timeout: 6000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => `https://hnrss.org/show?q=${encodeURIComponent(name)}&count=5`,
  },
  {
    key: 'hnLaunches', label: 'HN Launches', tier: 2,
    category: 'community', timeout: 6000, strict: true,
    type: 'DIRECT_RSS',
    url: (name) => `https://hnrss.org/launches?q=${encodeURIComponent(name)}&count=5`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — Early-stage / deep enrichment sources
// Run when: company is early-stage, or explicitly requested, or Tier 1+2 thin
// ─────────────────────────────────────────────────────────────────────────────
const TIER3 = [

  // ── Launch Platforms ───────────────────────────────────────────────────────
  {
    key: 'producthunt', label: 'Product Hunt', tier: 3,
    category: 'launch', timeout: 8000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:producthunt.com`),
    // Note: Product Hunt's own RSS returns 403. Google News index is reliable.
  },
  {
    key: 'betalist', label: 'BetaList', tier: 3,
    category: 'launch', timeout: 8000, strict: false,
    type: 'DIRECT_RSS',
    url: (name) => `https://betalist.com/feed`,
    // Static feed — filter by company name client-side
    rssUrl: 'https://betalist.com/feed',
  },
  {
    key: 'indiehackers', label: 'Indie Hackers', tier: 3,
    category: 'community', timeout: 8000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:indiehackers.com`),
  },
  {
    key: 'wip', label: 'WIP.co', tier: 3,
    category: 'community', timeout: 8000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:wip.co`),
  },

  // ── Additional VC / Investor Blogs ────────────────────────────────────────
  {
    key: 'a16zblog', label: 'a16z Blog', tier: 3,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:a16z.com`),
  },
  {
    key: 'sequoia', label: 'Sequoia', tier: 3,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:sequoiacap.com`),
  },
  {
    key: 'ycombinator', label: 'Y Combinator', tier: 3,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:ycombinator.com`),
  },
  {
    key: 'firstround', label: 'First Round Review', tier: 3,
    category: 'vc_deals', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:review.firstround.com`),
  },

  // ── Additional Media ───────────────────────────────────────────────────────
  {
    key: 'wsj', label: 'WSJ Tech', tier: 3,
    category: 'major_media', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:wsj.com startup funding`),
  },
  {
    key: 'bloomberg', label: 'Bloomberg Technology', tier: 3,
    category: 'major_media', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:bloomberg.com startup funding`),
  },
  {
    key: 'forbes', label: 'Forbes Startups', tier: 3,
    category: 'major_media', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:forbes.com startup`),
  },
  {
    key: 'wired', label: 'Wired', tier: 3,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:wired.com`),
  },
  {
    key: 'theverge', label: 'The Verge', tier: 3,
    category: 'startup_news', timeout: 10000, strict: true,
    type: 'GOOGLE_SITE',
    url: (name) => GN(`"${name}" site:theverge.com`),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — pre-built collections for each use case
// ─────────────────────────────────────────────────────────────────────────────

const ALL_SOURCES = [...TIER1, ...TIER2, ...TIER3];

module.exports = {
  TIER1,
  TIER2,
  TIER3,
  ALL_SOURCES,

  /**
   * Get sources for standard enrichment (Tier 1 + Tier 2).
   * This is the default for batch enrichment of existing startups.
   */
  getStandardSources: () => [...TIER1, ...TIER2],

  /**
   * Get sources for deep enrichment (all tiers).
   * Use for: early-stage companies, high-value targets, explicit deep scan.
   */
  getDeepSources: () => ALL_SOURCES,

  /**
   * Get only press release sources (fastest, highest signal for funded companies).
   */
  getPressSources: () => ALL_SOURCES.filter(s => s.category === 'press_release'),

  /**
   * Get sources for a specific category.
   */
  getByCategory: (category) => ALL_SOURCES.filter(s => s.category === category),
};
