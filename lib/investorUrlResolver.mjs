/**
 * Resolve team / portfolio / blog URLs for investor enrichment.
 *
 * Priority:
 *   1. VC_WEBSITES registry (~100 curated firms + fuzzy name match)
 *   2. investors.url → derive /team, /portfolio, /blog paths
 *   3. investors.blog_url → infer site root from domain
 */

import { VC_WEBSITES, resolveVcWebsiteKey } from './topVcFirms.mjs';

/** @typedef {{ website?: string; teamPage?: string; portfolioPage?: string; blogUrl?: string; rssUrl?: string }} InvestorUrlConfig */

/**
 * @param {string} [url]
 * @returns {string|null}
 */
export function extractDomain(url) {
  if (!url || !String(url).trim()) return null;
  try {
    const raw = String(url).trim();
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @returns {string}
 */
function normalizeBaseUrl(url) {
  const raw = String(url).trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

/**
 * Build scrape targets from a firm homepage.
 * @param {string} baseUrl
 * @returns {InvestorUrlConfig}
 */
export function buildUrlsFromBase(baseUrl) {
  const base = normalizeBaseUrl(baseUrl);
  return {
    website: base,
    teamPage: `${base}/team`,
    portfolioPage: `${base}/portfolio`,
    blogUrl: `${base}/blog`,
  };
}

/**
 * @param {string} name
 */
export function normalizeFirmNameForMatch(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(Entrackr|YourStory|Inc42|TechCrunch|VentureBeat|Crunchbase|PitchBook)\s*$/i, '')
    .replace(/^(Former|Builder|News|Of)\s+/i, '')
    .trim();
}

/**
 * @param {{ name?: string; firm?: string; url?: string|null; blog_url?: string|null; website?: string|null }} investor
 * @returns {{ source: 'registry'|'database'|'blog_url'|'none'; key: string|null; config?: InvestorUrlConfig }}
 */
export function resolveInvestorUrls(investor) {
  const name = normalizeFirmNameForMatch(investor?.name || investor?.firm || '');
  const registryKey = name ? resolveVcWebsiteKey(name) : null;
  if (registryKey && VC_WEBSITES[registryKey]) {
    return { source: 'registry', key: registryKey, config: { ...VC_WEBSITES[registryKey] } };
  }

  const homepage = investor?.url || investor?.website;
  if (homepage && String(homepage).trim().length > 4) {
    const config = buildUrlsFromBase(homepage);
    if (investor.blog_url && String(investor.blog_url).trim()) {
      config.blogUrl = normalizeBaseUrl(investor.blog_url);
    }
    return { source: 'database', key: null, config };
  }

  if (investor?.blog_url && String(investor.blog_url).trim()) {
    const blog = normalizeBaseUrl(investor.blog_url);
    const domain = extractDomain(blog);
    if (domain) {
      const config = buildUrlsFromBase(`https://${domain}`);
      config.blogUrl = blog;
      return { source: 'blog_url', key: null, config };
    }
    return { source: 'blog_url', key: null, config: { blogUrl: blog } };
  }

  return { source: 'none', key: null, config: undefined };
}
