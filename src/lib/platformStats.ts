/**
 * Platform-wide counts for marketing UI (home hero, submit flow, etc.).
 * Tries RPC first, then head-count queries — same strategy as PlatformPage.
 */

import { supabase } from './supabase';

export type PlatformStats = { startups: number; investors: number; matches: number };

function normalizeRpcPayload(data: unknown): PlatformStats | null {
  if (data == null) return null;
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    return {
      startups: Number(o.startups ?? 0) || 0,
      investors: Number(o.investors ?? 0) || 0,
      matches: Number(o.matches ?? 0) || 0,
    };
  }
  return null;
}

/**
 * Returns live counts. Uses `get_platform_stats` when healthy; otherwise
 * exact head counts on core tables (respects RLS — same as user-facing queries).
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await supabase.rpc('get_platform_stats');
      if (res.error) throw res.error;
      const p = normalizeRpcPayload(res.data);
      if (p && ((p.startups || 0) > 0 || (p.matches || 0) > 0)) {
        return p;
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[platformStats] RPC attempt failed', e);
      }
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  try {
    const [s, i, m] = await Promise.all([
      supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('investors').select('*', { count: 'exact', head: true }),
      supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
    ]);
    return {
      startups: s.count ?? 0,
      investors: i.count ?? 0,
      matches: m.count ?? 0,
    };
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[platformStats] head-count fallback failed', e);
    }
    return { startups: 0, investors: 0, matches: 0 };
  }
}
