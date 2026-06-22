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

export function trackFunnelEvent(
  operation: string,
  output: Record<string, unknown> = {},
): void {
  void fetch(apiUrl('/api/analytics/flush'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{ operation, status: 'tracked', output }],
    }),
  }).catch(() => {});
}
