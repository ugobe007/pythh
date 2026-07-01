/**
 * Peter intro concierge — thesis / messaging / timing help from preview.
 */

import { apiUrl } from '@/lib/apiConfig';
import { trackFunnelEvent } from '@/lib/matchEngagement';
import type { GatedInvestorContext } from '@/lib/founderSignupGate';

export type PeterIntroPayload = {
  email: string;
  startupId: string;
  startupName: string;
  startupUrl?: string;
  investor?: GatedInvestorContext | null;
  note?: string;
  source: string;
};

export async function requestPeterIntroHelp(payload: PeterIntroPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(apiUrl('/api/intro/concierge'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: payload.email.trim(),
        startup_id: payload.startupId,
        startup_name: payload.startupName,
        startup_url: payload.startupUrl,
        investor_id: payload.investor?.id,
        investor_name: payload.investor?.name,
        investor_firm: payload.investor?.firm,
        note: payload.note?.trim() || undefined,
        source: payload.source,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      return { ok: false, error: json.error || 'Request failed' };
    }

    void trackFunnelEvent('intro_concierge_requested', {
      startup_id: payload.startupId,
      startup_name: payload.startupName,
      investor_id: payload.investor?.id,
      investor_name: payload.investor?.name,
      source: payload.source,
      email_provided: true,
    });

    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
