/**
 * Hunter.io email discovery — domain search + email finder.
 * https://hunter.io/api-documentation/v2
 */

const API_BASE = 'https://api.hunter.io/v2';

function apiKey() {
  return (process.env.HUNTER_API_KEY || process.env.HUNTER_IO_API_KEY || '').trim();
}

export function hasHunterIo() {
  return !!apiKey();
}

/**
 * @param {string} path e.g. '/domain-search'
 * @param {Record<string, string>} params
 */
async function hunterGet(path, params = {}) {
  const key = apiKey();
  if (!key) throw new Error('HUNTER_API_KEY not set');

  const qs = new URLSearchParams({ ...params, api_key: key });
  const url = `${API_BASE}${path}?${qs}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const json = await res.json();

  if (!res.ok) {
    const msg = json?.errors?.[0]?.details || json?.message || JSON.stringify(json).slice(0, 200);
    const err = new Error(`Hunter ${res.status}: ${msg}`);
    err.status = res.status;
    if (res.status === 429) err.code = 'RATE_LIMIT';
    throw err;
  }
  return json.data || json;
}


export function isFounderPosition(position) {
  const p = String(position || '').toLowerCase().trim();
  if (!p) return false;
  if (/\b(co-?founder|founder)\b/.test(p)) return true;
  if (/\bceo\b/.test(p) || /\bchief executive officer\b/.test(p)) return true;
  if (/\bchief technology officer\b/.test(p) || /\bcto\b/.test(p)) return true;
  if (/\bowner\b/.test(p)) return true;
  if (/\bpresident\b/.test(p) && !/\bvice\s+president\b/.test(p)) return true;
  return false;
}

/**
 * Find best founder/CEO email for a domain.
 * @param {string} domain
 * @returns {Promise<{ email: string, firstName: string|null, lastName: string|null, position: string|null, confidence: number, source: string }|null>}
 */
export async function findFounderEmail(domain) {
  if (!domain || !hasHunterIo()) return null;
  const clean = domain.replace(/^www\./, '').toLowerCase();

  try {
    const data = await hunterGet('/domain-search', {
      domain: clean,
      type: 'personal',
      limit: '10',
    });

    const emails = data?.emails || [];
    const ranked = emails
      .filter((e) => e.value && e.confidence >= 70 && isFounderPosition(e.position))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    let best = ranked[0];
    if (!best) {
      // Hunter often omits title for real founders (e.g. stani@aave.com).
      const untitled = emails
        .filter((e) => e.value && e.confidence >= 98 && !String(e.position || '').trim())
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
      best = untitled[0];
    }
    if (!best) return null;

    return {
      email: best.value.toLowerCase(),
      firstName: best.first_name || null,
      lastName: best.last_name || null,
      position: best.position || null,
      confidence: best.confidence || 0,
      source: 'hunter_domain_search',
    };
  } catch (err) {
    if (err.code === 'RATE_LIMIT') throw err;
    return null;
  }
}

/**
 * @param {string} domain
 * @param {string} firstName
 * @param {string} lastName
 */
export async function findEmailByName(domain, firstName, lastName) {
  if (!domain || !firstName || !hasHunterIo()) return null;
  try {
    const data = await hunterGet('/email-finder', {
      domain: domain.replace(/^www\./, '').toLowerCase(),
      first_name: firstName,
      last_name: lastName || '',
    });
    if (!data?.email || (data.score != null && data.score < 70)) return null;
    return {
      email: data.email.toLowerCase(),
      firstName,
      lastName: lastName || null,
      position: data.position || null,
      confidence: data.score || 0,
      source: 'hunter_email_finder',
    };
  } catch {
    return null;
  }
}
