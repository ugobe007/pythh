/**
 * Google Custom Search JSON API.
 *
 * Auth (either works):
 *   A) Service account JSON — GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *      OAuth scope: https://www.googleapis.com/auth/cse
 *   B) API key — GOOGLE_API_KEY=AIza...
 *
 * Both also require Programmable Search Engine ID:
 *   GOOGLE_CUSTOM_SEARCH_CX=...  from https://programmablesearchengine.google.com/
 *
 * @see https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
 */

import { getServiceAccountAccessToken, getServiceAccountPath } from './googleServiceAccount.mjs';

const API = 'https://customsearch.googleapis.com/customsearch/v1';
const CSE_SCOPE = 'https://www.googleapis.com/auth/cse';

/**
 * @returns {{ cx: string, apiKey?: string, serviceAccount?: boolean } | null}
 */
export function getCustomSearchConfig() {
  const cx = (process.env.GOOGLE_CUSTOM_SEARCH_CX || process.env.GOOGLE_CSE_CX || '').trim();
  if (!cx) return null;

  const apiKey = (
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_CUSTOM_SEARCH_API_KEY ||
    process.env.GOOGLE_CSE_API_KEY ||
    ''
  ).trim();

  const saPath = getServiceAccountPath();
  if (apiKey) return { cx, apiKey };
  if (saPath) return { cx, serviceAccount: true };
  return null;
}

/**
 * @param {URLSearchParams} params
 * @param {{ cx: string, apiKey?: string, serviceAccount?: boolean }} cfg
 */
async function authorizedFetch(params, cfg) {
  const headers = { Accept: 'application/json' };

  if (cfg.apiKey) {
    params.set('key', cfg.apiKey);
    return fetch(`${API}?${params}`, { headers, signal: AbortSignal.timeout(15_000) });
  }

  const token = await getServiceAccountAccessToken([CSE_SCOPE]);
  if (!token) {
    throw new Error('Service account token unavailable');
  }
  headers.Authorization = `Bearer ${token}`;
  return fetch(`${API}?${params}`, { headers, signal: AbortSignal.timeout(15_000) });
}

/**
 * @param {string} query
 * @param {{ num?: number, start?: number }} [opts]
 * @returns {Promise<Array<{ link: string, title: string, snippet: string, displayLink: string }>>}
 */
export async function googleCustomSearch(query, opts = {}) {
  const cfg = getCustomSearchConfig();
  if (!cfg) {
    const hasSa = !!getServiceAccountPath();
    const hasKey = !!(process.env.GOOGLE_API_KEY || '').trim();
    throw new Error(
      'Custom Search not configured. Need GOOGLE_CUSTOM_SEARCH_CX (search engine ID from ' +
        'https://programmablesearchengine.google.com/) plus either ' +
        (hasSa ? 'valid service account file' : hasKey ? 'API key' : 'GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_API_KEY')
    );
  }

  const params = new URLSearchParams({
    cx: cfg.cx,
    q: query,
    num: String(Math.min(Math.max(opts.num ?? 5, 1), 10)),
  });
  if (opts.start) params.set('start', String(opts.start));

  const res = await authorizedFetch(params, cfg);

  if (res.status === 429) {
    const err = new Error('Google Custom Search daily quota exceeded (100 free/day)');
    err.code = 'QUOTA_EXCEEDED';
    throw err;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Custom Search HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return (data.items || []).map((item) => ({
    link: item.link || '',
    title: item.title || '',
    snippet: item.snippet || '',
    displayLink: item.displayLink || '',
  }));
}
