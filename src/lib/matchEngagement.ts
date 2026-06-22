/**
 * Match engagement — view → intro → contact funnel tracking.
 */

import { apiUrl } from './apiConfig';

export type MatchEngageAction = 'view' | 'intro' | 'contact';

export interface MatchEngageParams {
  startupId: string;
  investorId: string;
  action: MatchEngageAction;
  source?: string;
}

/** Resolve startup+investor pair and record engagement (non-blocking). */
export async function recordMatchEngagement({
  startupId,
  investorId,
  action,
  source,
}: MatchEngageParams): Promise<boolean> {
  if (!startupId || !investorId) return false;
  if (investorId.startsWith('demo-')) return false;

  try {
    const res = await fetch(apiUrl('/api/matches/engage'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        startup_id: startupId,
        investor_id: investorId,
        action,
        source: source || 'ui',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Dedupe view events per session for startup+investor pair. */
const viewedKey = (startupId: string, investorId: string) =>
  `pythh_match_view:${startupId}:${investorId}`;

export function recordMatchViewOnce(
  startupId: string,
  investorId: string,
  source?: string,
): void {
  if (typeof sessionStorage === 'undefined') return;
  const key = viewedKey(startupId, investorId);
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  void recordMatchEngagement({ startupId, investorId, action: 'view', source });
}

export function recordMatchIntro(
  startupId: string,
  investorId: string,
  source?: string,
): void {
  void recordMatchEngagement({ startupId, investorId, action: 'intro', source });
}

export function recordMatchContact(
  startupId: string,
  investorId: string,
  source?: string,
): void {
  void recordMatchEngagement({ startupId, investorId, action: 'contact', source });
}
