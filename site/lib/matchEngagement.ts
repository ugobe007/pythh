/**
 * Match engagement — production site (pythh.ai).
 */

import { apiUrl } from './apiConfig';

export type MatchEngageAction = 'view' | 'intro' | 'contact';

export async function recordMatchEngagement(
  startupId: string,
  investorId: string,
  action: MatchEngageAction,
  source?: string,
): Promise<boolean> {
  if (!startupId || !investorId) return false;
  try {
    const res = await fetch(apiUrl('/api/matches/engage'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        startup_id: startupId,
        investor_id: investorId,
        action,
        source: source || 'production_ui',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const viewedKey = (startupId: string, investorId: string) =>
  `pythh_match_view:${startupId}:${investorId}`;

export function recordMatchViewOnce(
  startupId: string,
  investorId: string,
  source?: string,
): void {
  const key = viewedKey(startupId, investorId);
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  void recordMatchEngagement(startupId, investorId, 'view', source);
}

function flushPayload(operation: string, output: Record<string, unknown>): string {
  return JSON.stringify({
    rows: [{ operation, status: 'tracked', output }],
  });
}

/** Persist funnel event — keepalive/beacon so redirects (Stripe) do not abort the request. */
export function trackFunnelEvent(
  operation: string,
  output: Record<string, unknown> = {},
): Promise<void> {
  const url = apiUrl('/api/analytics/flush');
  const body = flushPayload(operation, output);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) {
        return Promise.resolve();
      }
    } catch {
      /* fall through to fetch */
    }
  }

  return fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Once per browser session (e.g. pricing_viewed). */
export function trackFunnelEventOnce(
  sessionKey: string,
  operation: string,
  output: Record<string, unknown> = {},
): Promise<void> {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) {
    return Promise.resolve();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(sessionKey, '1');
  }
  return trackFunnelEvent(operation, output);
}
