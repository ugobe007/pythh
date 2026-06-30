/**
 * Create a founder account via email login (pythh_session cookie).
 * No password — same path as /login email sign-in.
 */

import { apiUrl } from '@/lib/apiConfig';
import { trpcVanilla } from '@/lib/trpcVanilla';

export type FounderWelcomeEmailSource =
  | 'founder_signup_page'
  | 'founder_signup_gate'
  | 'activate_gate_skip_scan'
  | 'activate_scan_complete';

/** Day-0 Oracle welcome — gap map, wizard link, trial CTA (fire-and-forget). */
export function sendFounderWelcomeEmail(opts: {
  email: string;
  startupId: string;
  startupName?: string;
  source?: FounderWelcomeEmailSource;
}): void {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes('@') || !opts.startupId) return;

  void fetch(apiUrl('/api/preview/activation-nudge'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email,
      startup_id: opts.startupId,
      startup_name: opts.startupName,
      source: opts.source || 'founder_signup_page',
    }),
  }).catch(() => {});
}

/** Invite email when account exists but no startup scan yet. */
export function sendFounderSignupInviteEmail(opts: {
  email: string;
  source?: string;
}): void {
  const email = opts.email.trim().toLowerCase();
  if (!email.includes('@')) return;

  void fetch(apiUrl('/api/preview/signup-invite'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      email,
      source: opts.source || 'founder_signup_page',
    }),
  }).catch(() => {});
}

export async function createFounderAccount(
  email: string,
  name?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    return { ok: false, error: 'Valid email required' };
  }
  try {
    await trpcVanilla.auth.login.mutate({
      email: trimmed,
      name: name?.trim() || undefined,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create account';
    return { ok: false, error: message };
  }
}

export type InstantResultsPayload = {
  startup_id?: string;
  startup?: Record<string, unknown> | null;
  matches?: unknown[];
  match_count?: number;
};

/** Load existing preview/scan results without re-running the pipeline. */
export async function fetchInstantResults(startupId: string): Promise<InstantResultsPayload | null> {
  try {
    const res = await fetch(`/api/instant/results?startup_id=${encodeURIComponent(startupId)}`);
    const data = (await res.json().catch(() => ({}))) as InstantResultsPayload & { error?: string };
    if (!res.ok || !data.startup_id) return null;
    return data;
  } catch {
    return null;
  }
}
