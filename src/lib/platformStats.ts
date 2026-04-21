/**
 * Platform-wide counts for marketing UI (home hero, submit flow, etc.).
 * 1) Same-origin GET /api/platform-stats (server uses service role — reliable in Safari / strict browsers).
 * 2) Direct Supabase RPC + head counts as fallback (local dev without API).
 */

import { supabase } from './supabase';
import { apiUrl } from './apiConfig';

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
 * Returns live counts.
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  try {
    const res = await fetch(apiUrl('/api/platform-stats'), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const j = (await res.json()) as Partial<PlatformStats & { source?: string }>;
      if (
        j &&
        typeof j.startups === 'number' &&
        typeof j.investors === 'number' &&
        typeof j.matches === 'number'
      ) {
        return {
          startups: j.startups,
          investors: j.investors,
          matches: j.matches,
        };
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[platformStats] /api/platform-stats failed, using Supabase client', e);
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await supabase.rpc('get_platform_stats');
      if (res.error) throw res.error;
      const p = normalizeRpcPayload(res.data);
      // Return any successful RPC payload (including all zeros) — avoids falling through to
      // client head-count queries that can 400 in edge cases and spams the network tab.
      if (p) return p;
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
      supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('investors').select('id', { count: 'exact', head: true }),
      supabase.from('startup_investor_matches').select('id', { count: 'exact', head: true }),
    ]);
    if (s.error || i.error || m.error) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[platformStats] head-count fallback errors', s.error, i.error, m.error);
      }
      return { startups: 0, investors: 0, matches: 0 };
    }
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
