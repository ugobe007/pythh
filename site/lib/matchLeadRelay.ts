import { apiUrl } from '@/lib/apiConfig';

export type LeadUnlockState = {
  investorIds: string[];
};

export async function fetchLeadUnlocks(startupId: string): Promise<string[]> {
  const res = await fetch(apiUrl(`/api/matches/lead/unlocks?startup_id=${encodeURIComponent(startupId)}`), {
    credentials: 'same-origin',
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error('Could not load unlocks');
  const data = await res.json();
  return Array.isArray(data.investor_ids) ? data.investor_ids.filter(Boolean) : [];
}

export async function unlockMatchLead(startupId: string, investorId: string): Promise<{
  unlocked: boolean;
  contactable: boolean;
}> {
  const res = await fetch(apiUrl('/api/matches/lead/unlock'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startup_id: startupId, investor_id: investorId }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const err = new Error('sign_in_required');
    throw err;
  }
  if (res.status === 403) {
    const err = new Error(data.error === 'plan_required' ? 'plan_required' : (data.error || data.message || 'access_denied'));
    throw err;
  }
  if (!res.ok) throw new Error(data.error || data.message || 'Could not unlock');
  return {
    unlocked: Boolean(data.unlocked),
    contactable: Boolean(data.contactable),
  };
}

export async function sendLeadEmail(payload: {
  startupId: string;
  investorId: string;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<{ sent: boolean; contactable: boolean; error?: string }> {
  const res = await fetch(apiUrl('/api/matches/lead/email'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startup_id: payload.startupId,
      investor_id: payload.investorId,
      subject: payload.subject,
      body: payload.body,
      reply_to: payload.replyTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('sign_in_required');
  if (res.status === 403) throw new Error(data.error === 'plan_required' ? 'plan_required' : (data.error || data.message || 'access_denied'));
  if (!res.ok) {
    return {
      sent: false,
      contactable: data.contactable !== false,
      error: data.error || data.message || 'Could not send through Pythh',
    };
  }
  return { sent: Boolean(data.sent), contactable: data.contactable !== false };
}

export async function fetchDeckOutline(startupId: string): Promise<{
  startup_name: string;
  positioning: { thesis: string; say: string[]; avoid: string[] };
  slides: Array<{ n: number; title: string; shouldSay: string; position: string }>;
}> {
  const res = await fetch(apiUrl('/api/matches/lead/deck-outline'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startup_id: startupId }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('sign_in_required');
  if (res.status === 403) throw new Error(data.error === 'plan_required' ? 'plan_required' : (data.error || data.message || 'access_denied'));
  if (!res.ok) throw new Error(data.error || 'Could not build deck outline');
  return data.outline;
}
