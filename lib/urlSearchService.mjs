/**
 * URL search service — DuckDuckGo HTML lookup for a firm or startup homepage.
 *
 * Free. Used by startup URL recovery and investor URL discovery.
 * Paid search (Anthropic, OpenAI, Gemini) does not run here.
 * See docs/FUNDING_SEARCH_POLICY.md.
 */

const BLOCKED_HOSTS =
  /^(www\.)?(crunchbase|linkedin|twitter|x|facebook|instagram|youtube|pitchbook|cbinsights|dealroom|tracxn|wellfound|angel|signal|nfx|bloomberg|reuters|techcrunch|venturebeat|forbes|wsj|ft|wikipedia|google|news\.google|prnewswire|businesswire|medium|substack|duckduckgo)\./i;

/**
 * @param {string} html
 * @returns {string[]}
 */
export function urlsFromDuckDuckGoHtml(html) {
  const hrefs = [...String(html || '').matchAll(/uddg=([^&"]+)/g)].map((match) => {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  });
  const out = [];
  for (const href of hrefs) {
    const normalized = normalizeOfficialUrl(href);
    if (normalized) out.push(normalized);
  }
  return [...new Set(out)];
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeOfficialUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!host.includes('.') || BLOCKED_HOSTS.test(host)) return null;
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
    `"${label}" official website startup OR company -site:linkedin.com -site:crunchbase.com`,
  );
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'user-agent': 'Mozilla/5.0 PythhUrlRecovery/1.0',
        accept: 'text/html',
      },
    });
    if (!res.ok) return [];
    return urlsFromDuckDuckGoHtml(await res.text()).slice(0, limit);
  } catch {
    return [];
  }
}
