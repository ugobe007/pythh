/**
 * Core funding / launch news feeds for the scraper-first search policy.
 * Homepages the operator pasted; RSS URLs are the fetchable equivalents.
 *
 * Dealroom first-party pages are Cloudflare-blocked. AngelList has no RSS
 * (blog/rss.xml is an HTML catch-all). Those two use Google News site: feeds.
 */
export const CORE_FUNDING_RSS_SOURCES = [
  {
    name: 'Crunchbase News',
    homepage: 'https://news.crunchbase.com',
    url: 'https://news.crunchbase.com/feed/',
    category: 'vc_deals',
    priority: 10,
    firstParty: true,
  },
  {
    name: 'TechCrunch – Startups',
    homepage: 'https://techcrunch.com/category/startups/',
    url: 'https://techcrunch.com/category/startups/feed/',
    category: 'startup_news',
    priority: 10,
    firstParty: true,
  },
  {
    name: 'Product Hunt Daily',
    homepage: 'https://www.producthunt.com',
    url: 'https://www.producthunt.com/feed',
    category: 'early_stage',
    priority: 8,
    firstParty: true,
  },
  {
    name: 'Dealroom via Google News',
    homepage: 'https://dealroom.co/news/',
    url: 'https://news.google.com/rss/search?q=site:dealroom.co+(funding+OR+raises+OR+startup)&hl=en-US&gl=US&ceid=US:en',
    category: 'vc_deals',
    priority: 7,
    firstParty: false,
  },
  {
    name: 'AngelList via Google News',
    homepage: 'https://www.angellist.com',
    url: 'https://news.google.com/rss/search?q=site:angellist.com+OR+site:wellfound.com+(startup+OR+funding)&hl=en-US&gl=US&ceid=US:en',
    category: 'vc_insights',
    priority: 6,
    firstParty: false,
  },
];

export const CORE_FUNDING_INFERENCE_SITE_QUERY =
  '(site:news.crunchbase.com OR site:techcrunch.com OR site:dealroom.co OR site:producthunt.com OR site:angellist.com OR site:wellfound.com) (raises OR funding OR series OR launch)';

export const BROKEN_FIRST_PARTY_CORE_FEEDS = [
  'https://dealroom.co/blog/feed',
  'https://www.angellist.com/blog/rss.xml',
  'https://blog.angel.co/feed/',
];
