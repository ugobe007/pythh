/**
 * URL search service — no-AI web results for a firm or startup homepage.
 *
 * Order:
 *   1. Google Web (`?udm=14` forces the Web tab and skips AI overviews)
 *   2. DuckDuckGo No-AI (https://noai.duckduckgo.com)
 *   3. Mojeek (independent crawl, no generative summary)
 *
 * A blocked or empty engine is skipped. Paid search does not run here.
 * See docs/FUNDING_SEARCH_POLICY.md.
 */

const BLOCKED_HOSTS =
  /^(www\.)?(crunchbase|linkedin|twitter|x|facebook|instagram|youtube|pitchbook|cbinsights|dealroom|tracxn|wellfound|angel|signal|nfx|bloomberg|reuters|techcrunch|venturebeat|forbes|wsj|ft|wikipedia|google|news\.google|gstatic|prnewswire|businesswire|medium|substack|duckduckgo|mojeek)\./i;

const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 PythhUrlRecovery/1.0',
  accept: 'text/html',
};

/**
 * @param {string} html
 * @returns {string[]}
 */
export function urlsFromDuckDuckGoHtml(html) {
  return uniqueOfficialUrls(
    [...String(html || '').matchAll(/uddg=([^&"]+)/g)].map((match) => decodeParam(match[1])),
  );
}

/**
 * Google Web results. `?udm=14` is the Web filter; links are `/url?q=` redirects.
 * @param {string} html
 * @returns {string[]}
 */
export function urlsFromGoogleWebHtml(html) {
  const fromRedirects = [...String(html || '').matchAll(/\/url\?q=(https?[^&"]+)/g)].map((match) =>
    decodeParam(match[1]),
  );
  return uniqueOfficialUrls(fromRedirects);
}

/**
 * Mojeek result anchors. Nav and captcha links on mojeek.com are dropped.
 * @param {string} html
 * @returns {string[]}
 */
export function urlsFromMojeekHtml(html) {
  const hrefs = [...String(html || '').matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  return uniqueOfficialUrls(hrefs);
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeOfficialUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('//')) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.') || BLOCKED_HOSTS.test(url.hostname.toLowerCase()) || BLOCKED_HOSTS.test(host)) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function searchOfficialUrls(name, opts = {}) {
  const label = String(name || '').trim();
  if (!label) return [];
  const limit = opts.limit || 8;
  const q = encodeURIComponent(
    `"${label}" official website -site:linkedin.com -site:crunchbase.com`,
  );
  const engines = [
    {
      url: googleWebSearchUrl(q),
      parse: urlsFromGoogleWebHtml,
    },
    {
      url: `https://noai.duckduckgo.com/html/?q=${q}&noai=1&ia=web`,
      parse: urlsFromDuckDuckGoHtml,
    },
    {
      url: `https://www.mojeek.com/search?q=${q}`,
      parse: urlsFromMojeekHtml,
    },
  ];
  const found = [];
  for (const engine of engines) {
    if (found.length >= limit) break;
    for (const url of await fetchEngine(engine.url, engine.parse)) {
      if (!found.includes(url)) found.push(url);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/** @param {string} encodedQuery */
export function googleWebSearchUrl(encodedQuery) {
  return `https://www.google.com/search?udm=14&q=${encodedQuery}`;
}

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function uniqueOfficialUrls(values) {
  const out = [];
  for (const value of values) {
    const normalized = normalizeOfficialUrl(value);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

async function fetchEngine(url, parse) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: FETCH_HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) return [];
    return parse(await res.text());
  } catch {
    return [];
  }
}
