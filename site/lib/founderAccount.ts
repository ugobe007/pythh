/**
 * Create a founder account via email login (pythh_session cookie).
 * No password — same path as /login email sign-in.
 */

import { trpcVanilla } from '@/lib/trpcVanilla';

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
