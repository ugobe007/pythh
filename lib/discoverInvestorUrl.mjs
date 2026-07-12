/**
 * Discover investor firm homepage via Google Custom Search + slug probe fallback.
 */

import https from 'node:https';
import http from 'node:http';
import { googleCustomSearch, getCustomSearchConfig } from './googleCustomSearch.mjs';
import { geminiFindFirmUrl, hasGeminiSearch } from './geminiInvestorSearch.mjs';
import { extractDomain, normalizeFirmNameForMatch } from './investorUrlResolver.mjs';
import { resolveVcWebsiteKey, VC_WEBSITES } from './topVcFirms.mjs';

/** Domains we never want as a firm homepage */
const BLOCKED_HOSTS =
  /^(www\.)?(crunchbase|linkedin|twitter|x|facebook|instagram|youtube|pitchbook|cbinsights|dealroom|tracxn|wellfound|angel|signal|nfx|bloomberg|reuters|techcrunch|venturebeat|forbes|wsj|ft|wikipedia|google|news\.google|prnewswire|businesswire|medium|substack)\./i;

const BLOCKED_PATH =
  /\/(news|article|press|blog\/\d|organization\/|company\/|in\/|posts\/)/i;

const VC_SUFFIX_WORDS =
  /\b(capital|ventures?|partners?|group|fund|investments?|advisors?|holdings?|management|accelerator|studio|combinator|vc|llc|inc|lp|ltd)\b/gi;

/**
 * @param {string} firmName
 */
export function firmNameToSlug(firmName) {
  return normalizeFirmNameForMatch(firmName)
    .toLowerCase()
    .replace(VC_SUFFIX_WORDS, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

/**
 * @param {string} host
 * @param {string} slug
 */
function hostMatchesFirm(host, slug, firmName) {
  const h = host.replace(/^www\./, '').toLowerCase();
  if (!slug || slug.length < 3) return false;
  if (h.includes(slug)) return true;
  const tokens = normalizeFirmNameForMatch(firmName)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !VC_SUFFIX_WORDS.test(w));
  const hits = tokens.filter((t) => h.includes(t.replace(/[^a-z0-9]/g, '')));
  return hits.length >= Math.min(2, tokens.length);
}

/**
 * @param {{ link: string, title: string, snippet: string, displayLink: string }} item
 * @param {string} firmName
 * @param {string} slug
 */
export function scoreSearchResult(item, firmName, slug) {
  const link = item.link || '';
  let host;
  try {
    host = new URL(link).hostname;
  } catch {
    return -99;
  }

  if (BLOCKED_HOSTS.test(host)) return -50;
  if (BLOCKED_PATH.test(link)) return -30;

  let score = 0;
  const firmLower = firmName.toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  const snippetLower = (item.snippet || '').toLowerCase();

  if (titleLower.includes(firmLower) || snippetLower.includes(firmLower)) score += 8;
  if (hostMatchesFirm(host, slug, firmName)) score += 12;
  if (/\.(vc|capital|ventures|fund)\b/i.test(host)) score += 4;
  if (/\b(official|homepage|venture capital|vc firm)\b/i.test(snippetLower + titleLower)) score += 3;

  // Penalize deep paths (prefer root / about)
  try {
    const pathDepth = new URL(link).pathname.split('/').filter(Boolean).length;
    score += Math.max(0, 3 - pathDepth);
  } catch {}

  return score;
}

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 */
export function probeUrl(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      resolve(false);
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'HEAD',
        hostname: parsed.hostname,
        path: parsed.pathname || '/',
        timeout: timeoutMs,
        headers: { 'User-Agent': 'Pythh-UrlBot/1.0' },
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * @param {string} firmName
 */
export async function probeSlugDomains(firmName) {
  const slug = firmNameToSlug(firmName);
  if (!slug || slug.length < 3) return null;

  const candidates = [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slug}.vc`,
    `https://${slug}.vc`,
    `https://www.${slug}vc.com`,
    `https://${slug}capital.com`,
    `https://www.${slug}ventures.com`,
  ];

  for (const url of candidates) {
    if (await probeUrl(url)) return url;
  }
  return null;
}

/**
 * @param {string} firmName
 * @param {{ skipSearch?: boolean }} [opts]
 * @returns {Promise<{ url: string|null, source: string, score: number, query?: string }>}
 */
export async function discoverInvestorUrl(firmName, opts = {}) {
  const name = normalizeFirmNameForMatch(firmName);
  if (!name) return { url: null, source: 'empty', score: 0 };

  const registryKey = resolveVcWebsiteKey(name);
  if (registryKey && VC_WEBSITES[registryKey]?.website) {
    return { url: VC_WEBSITES[registryKey].website, source: 'registry', score: 100 };
  }

  const slug = firmNameToSlug(name);

  // Primary: Gemini + Google Search (whole web; works without Programmable Search Engine cx)
  if (!opts.skipSearch && hasGeminiSearch()) {
    try {
      const gem = await geminiFindFirmUrl(name);
      for (const candidate of gem.candidates.slice(0, 3)) {
        if (/vertexaisearch\.cloud\.google|google\.com\/url/i.test(candidate)) continue;
        const base = candidate.split('?')[0].replace(/\/+$/, '');
        if (await probeUrl(base)) {
          return { url: base, source: 'gemini_google_search', score: 80, query: name };
        }
      }
      if (gem.url) {
        const base = gem.url.split('?')[0].replace(/\/+$/, '');
        if (await probeUrl(base)) {
          return { url: base, source: 'gemini_google_search', score: 75, query: name };
        }
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') throw err;
    }
  }

  if (!opts.skipSearch && getCustomSearchConfig()) {
    const query = `"${name}" venture capital official site`;
    try {
      const items = await googleCustomSearch(query, { num: 8 });
      const ranked = items
        .map((item) => ({ item, score: scoreSearchResult(item, name, slug) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

      for (const { item, score } of ranked.slice(0, 3)) {
        const base = item.link.split('?')[0].replace(/\/+$/, '');
        if (await probeUrl(base)) {
          return { url: base, source: 'google_cse', score, query };
        }
      }
    } catch (err) {
      if (err.code === 'QUOTA_EXCEEDED') throw err;
      // fall through to slug probe
    }
  }

  const probed = await probeSlugDomains(name);
  if (probed) {
    return { url: probed, source: 'slug_probe', score: 40 };
  }

  return { url: null, source: 'none', score: 0 };
}
