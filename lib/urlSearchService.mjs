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
  /^(www\.)?(crunchbase|linkedin|twitter|x|facebook|instagram|youtube|pitchbook|cbinsights|dealroom|tracxn|wellfound|angelinvestorforum|angelinvestors|angelinvest|angel|signal|nfx|bloomberg|reuters|techcrunch|venturebeat|forbes|wsj|ft|wikipedia|google|news\.google|gstatic|prnewswire|businesswire|medium|substack|duckduckgo|mojeek|faa)\./i;

const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 PythhUrlRecovery/1.0',
  accept: 'text/html',
};

const GOOGLE_WEB_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'en-US,en;q=0.9',
};

/**
 * @param {string} html
 * @returns {string[]}
 */
export function urlsFromDuckDuckGoHtml(html) {
  const text = String(html || '');
  const fromRedirects = [...text.matchAll(/uddg=([^&"]+)/g)].map((match) => decodeParam(match[1]));
  const fromResults = [...text.matchAll(/class="result__a"[^>]*href="(https?:\/\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  return uniqueOfficialUrls([...fromRedirects, ...fromResults]);
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
 * Google News RSS `<source url>` values. Publishers are dropped by the host blocklist.
 * @param {string} xml
 * @returns {string[]}
 */
export function urlsFromNewsRss(xml, label = '') {
  const text = String(xml || '');
  const pairs = [...text.matchAll(/<source url="([^"]+)">([^<]*)<\/source>/g)];
  const rows = pairs.length
    ? pairs.map((match) => [match[1], match[2]])
    : [...text.matchAll(/<source url="([^"]+)"/g)].map((match) => [match[1], '']);
  const urls = [];
  for (const [raw, sourceName] of rows) {
    const normalized = normalizeOfficialUrl(raw);
    if (!normalized || urls.includes(normalized)) continue;
    if (label && !newsSourceIsHomepage(sourceName, label, normalized)) continue;
    urls.push(normalized);
  }
  return urls;
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
    if (!host.includes('.') || host.endsWith('.gov') || host.endsWith('.mil')) return null;
    if (BLOCKED_HOSTS.test(url.hostname.toLowerCase()) || BLOCKED_HOSTS.test(host)) return null;
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
  const webQuery = encodeURIComponent(label);
  const q = encodeURIComponent(
    `"${label}" official website -site:linkedin.com -site:crunchbase.com`,
  );
  const engines = [
    {
      url: googleWebSearchUrl(webQuery),
      headers: GOOGLE_WEB_HEADERS,
      parse: urlsFromGoogleWebHtml,
    },
    {
      url: 'https://noai.duckduckgo.com/html/',
      method: 'POST',
      body: `q=${q}&b=`,
      parse: urlsFromDuckDuckGoHtml,
    },
    {
      url: `https://www.mojeek.com/search?q=${q}`,
      parse: urlsFromMojeekHtml,
    },
    {
      url: `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
      parse: (xml) => urlsFromNewsRss(xml, label),
    },
  ];
  const found = [];
  for (const engine of engines) {
    if (found.length >= limit) break;
    for (const url of await fetchEngine(engine)) {
      if (!hostAligns(url, label) || found.includes(url)) continue;
      found.push(url);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/**
 * Classic Google Web results. `?udm=14` is the first parameter so the Web tab
 * loads and AI Overviews stay off. Same shortcut as a browser custom search:
 * https://google.com/search?udm=14&q=%s
 * @param {string} encodedQuery
 */
export function googleWebSearchUrl(encodedQuery) {
  return `https://google.com/search?udm=14&q=${encodedQuery}`;
}

/**
 * Google News tab. `?udm=12` is the raw News view, with no AI overview.
 * @param {string} encodedQuery
 */
export function googleNewsSearchUrl(encodedQuery) {
  return `https://google.com/search?udm=12&q=${encodedQuery}`;
}

/**
 * News-tab anchors. Publisher hosts stay; Google's own links are dropped.
 * @param {string} html
 * @returns {{ title: string, link: string }[]}
 */
export function articlesFromGoogleNewsHtml(html) {
  const out = [];
  const pattern = /href="(?:https:\/\/(?:www\.)?google\.com)?\/url\?q=([^"&]+)[^"]*"[^>]*>([^<]+)</g;
  for (const match of String(html || '').matchAll(pattern)) {
    const link = decodeParam(match[1]);
    const title = decodeHtml(match[2]).replace(/\s+/g, ' ').trim();
    if (!link || !title || /google\.|gstatic\./i.test(link)) continue;
    if (out.some((item) => item.link === link)) continue;
    out.push({ title, link });
  }
  return out;
}

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const GENERIC_TOKENS = new Set([
  'capital', 'ventures', 'venture', 'partners', 'partner', 'investments', 'investment',
  'fund', 'funds', 'group', 'management', 'holdings', 'advisors', 'advisory', 'global',
  'strategic', 'equity', 'equities', 'labs', 'lab', 'the', 'and', 'for', 'llc', 'inc', 'lp', 'vc', 'of',
]);

function words(value) {
  return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function distinctiveTokens(value) {
  return words(value).filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token));
}

function sourceNameMatches(sourceName, label) {
  const sourceTokens = distinctiveTokens(sourceName);
  const labelTokens = distinctiveTokens(label);
  if (!labelTokens.length || sourceTokens.length !== labelTokens.length) return false;
  return labelTokens.every((token, index) => token === sourceTokens[index]);
}

function hostAligns(url, label) {
  const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
  const tokens = distinctiveTokens(label);
  if (tokens.some((token) => host === token || host.startsWith(token) || host.endsWith(token))) return true;
  const initials = words(label)
    .filter((token) => !['the', 'and', 'of', 'for'].includes(token))
    .map((token) => token[0])
    .join('');
  return initials.length >= 2 && host === initials;
}

function newsSourceIsHomepage(sourceName, label, url) {
  return sourceNameMatches(sourceName, label) && hostAligns(url, label);
}

function uniqueOfficialUrls(values) {
  const out = [];
  for (const value of values) {
    const normalized = normalizeOfficialUrl(value);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

async function fetchEngine(engine) {
  try {
    const res = await fetch(engine.url, {
      method: engine.method || 'GET',
      body: engine.body,
      signal: AbortSignal.timeout(12000),
      headers: {
        ...(engine.headers || FETCH_HEADERS),
        ...(engine.body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      redirect: 'follow',
    });
    if (!res.ok && res.status !== 202) return [];
    const text = await res.text();
    if (
      res.status === 202 ||
      /anomaly-modal|enablejs|JavaScript is required to complete this challenge|google\.com\/sorry\/|unusual traffic/i.test(text)
    ) {
      return [];
    }
    return engine.parse(text);
  } catch {
    return [];
  }
}
