/**
 * ZeroBounce email validation — pre-send deliverability check.
 * https://www.zerobounce.net/docs/email-validation-api-quickstart/
 */

const API_BASE = 'https://api.zerobounce.net/v2';

function apiKey() {
  return (process.env.ZEROBOUNCE_API_KEY || '').trim();
}

export function hasZeroBounce() {
  return !!apiKey();
}

/** Statuses safe for cold outreach (avoid bounces + spam traps). */
const SENDABLE = new Set(['valid']);

/** Optional: catch-all domains — higher bounce risk; off by default. */
const SENDABLE_WITH_CATCHALL = new Set(['valid', 'catch-all']);

/**
 * @param {string} email
 * @param {{ allowCatchAll?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, status: string, sub_status?: string, reason?: string }>}
 */
export async function validateEmail(email, opts = {}) {
  const key = apiKey();
  if (!key) {
    return { ok: true, status: 'skipped', reason: 'ZEROBOUNCE_API_KEY not set' };
  }

  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { ok: false, status: 'invalid', reason: 'malformed email' };
  }

  const qs = new URLSearchParams({ api_key: key, email: normalized });
  const res = await fetch(`${API_BASE}/validate?${qs}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.error || json?.message || `HTTP ${res.status}`;
    const err = new Error(`ZeroBounce ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }

  const status = String(json.status || 'unknown').toLowerCase();
  const subStatus = json.sub_status ? String(json.sub_status) : undefined;
  const allowed = opts.allowCatchAll ? SENDABLE_WITH_CATCHALL : SENDABLE;
  const ok = allowed.has(status);

  return {
    ok,
    status,
    sub_status: subStatus,
    reason: ok ? undefined : `zerobounce:${status}${subStatus ? `/${subStatus}` : ''}`,
  };
}
