// ============================================================================
// Pythh RPC Service + React Hooks (Bulletproof Version)
// ============================================================================
// 
// Rules:
//   1. No RPC calls without a valid startupId
//   2. Hooks are gated: enabled only when startupId truthy
//   3. Caching with TTL for context/reveal data
//   4. Polling only starts after initial data loaded
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  MatchRow,
  StartupContext,
  InvestorReveal,
  UnlockResponse,
} from '@/lib/pythh-types';

// -----------------------------------------------------------------------------
// RESOLVER RESPONSE
// -----------------------------------------------------------------------------

export interface ResolverResponse {
  found: boolean;
  startup_id?: string;
  name?: string;
  website?: string;
  searched?: string;
}

// Interface for saved match sessions
export interface SavedSession {
  id: string;
  session_id: string;
  startup_id: string;
  startup_name?: string;
  matches: any[];
  top_5_investor_ids: string[];
  top_5_investor_names: string[];
  created_at: string;
  expires_at: string;
  claimed_by_user_id?: string;
}

// -----------------------------------------------------------------------------
// RAW API (no React)
// -----------------------------------------------------------------------------

// Session ID management for match persistence
const SESSION_KEY = 'pythh_session_id';

function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    // Generate UUID v4-like session ID
    sessionId = 'sess_' + crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export const pythhRpc = {
  // Get current session ID
  getSessionId(): string {
    return getOrCreateSessionId();
  },

  // Resolve startup by URL or name
  // FAST PATH: Try Supabase RPC first (always warm, <500ms for existing startups)
  // SLOW PATH: Fall back to Express backend API for new startups (scrape + score)
  async resolveStartup(url: string, forceGenerate = false): Promise<ResolverResponse> {
    const sessionId = getOrCreateSessionId();
    
    // 1. FAST: Try direct Supabase RPC first (no cold start, always available)
    try {
      const { data, error } = await supabase.rpc('resolve_startup_by_url', {
        p_url: url,
      });
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.found || row?.startup_id) {
          // Use lightweight RPC for match count (avoids pulling rows)
          let matchCount = row.match_count ?? 0;
          try {
            const { data: countData } = await supabase.rpc('get_match_count', {
              p_startup_id: row.startup_id,
            });
            if (typeof countData === 'number') matchCount = countData;
          } catch { /* fall back to row.match_count */ }
          
          // If startup exists AND has matches AND not forced → return immediately
          if (matchCount >= 20 && !forceGenerate) {
            return {
              found: true,
              startup_id: row.startup_id,
              name: row.startup_name,
              website: row.canonical_url,
              searched: url,
            };
          }
          
          // Startup exists but has FEW/NO matches (or forced) → call Express backend
          // Express uses try_start_match_gen() lock to prevent thundering herd
          console.log(`[pythhRpc] Startup found but only ${matchCount} matches${forceGenerate ? ' (forced regen)' : ''} — triggering match generation`);
          try {
            const apiUrl = '/api/instant/submit';
            await fetch(apiUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId,
              },
              body: JSON.stringify({ 
                url, 
                session_id: sessionId,
                force_generate: forceGenerate,
              }),
            });
          } catch (e) {
            console.warn('[pythhRpc] Match generation trigger failed (non-fatal):', e);
          }
          
          return {
            found: true,
            startup_id: row.startup_id,
            name: row.startup_name,
            website: row.canonical_url,
            searched: url,
          };
        }
      }
    } catch (e) {
      console.warn('[pythhRpc] RPC fast path failed:', e);
    }
    
    // 2. SLOW: Startup not found in DB — use backend API to scrape + create + score
    try {
      const apiUrl = '/api/instant/submit';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({ url, session_id: sessionId }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.startup_id) {
          return {
            found: true,
            startup_id: result.startup_id,
            name: result.startup?.name,
            website: result.startup?.website,
            searched: url,
          };
        }
      }
    } catch (e) {
      console.warn('[pythhRpc] Backend API failed:', e);
    }
    
    return { found: false, searched: url };
  },

  // Get saved sessions for returning user
  async getSavedSessions(): Promise<SavedSession[] | null> {
    const sessionId = getOrCreateSessionId();
    try {
      const apiUrl = import.meta.env.PROD 
        ? `/api/instant/session/${sessionId}` 
        : `http://localhost:3002/api/instant/session/${sessionId}`;
      
      const response = await fetch(apiUrl);
      if (response.ok) {
        const result = await response.json();
        return result.sessions || [];
      }
      return null;
    } catch (e) {
      console.warn('[pythhRpc] Failed to get saved sessions:', e);
      return null;
    }
  },

  // Claim session after user signs up
  async claimSession(userId: string): Promise<boolean> {
    const sessionId = getOrCreateSessionId();
    try {
      const apiUrl = import.meta.env.PROD 
        ? '/api/instant/claim-session' 
        : 'http://localhost:3002/api/instant/claim-session';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, user_id: userId }),
      });
      
      return response.ok;
    } catch (e) {
      console.warn('[pythhRpc] Failed to claim session:', e);
      return false;
    }
  },

  // Get startup context (GOD, signals, comparison, entitlements)
  async getStartupContext(startupId: string): Promise<StartupContext | null> {
    const { data, error } = await supabase.rpc('get_startup_context', {
      p_startup_id: startupId,
    });
    if (error) throw error;
    if (data?.error) return null;
    return data as StartupContext;
  },

  // Get match table rows
  async getMatchTable(
    startupId: string,
    limitUnlocked = 5,
    limitLocked = 100
  ): Promise<MatchRow[]> {
    const { data, error } = await supabase.rpc('get_live_match_table', {
      p_startup_id: startupId,
      p_limit_unlocked: limitUnlocked,
      p_limit_locked: limitLocked,
    });
    if (error) throw error;
    return (data || []) as MatchRow[];
  },

  // Unlock an investor
  async unlockInvestor(
    startupId: string,
    investorId: string,
    source = 'free_daily'
  ): Promise<UnlockResponse> {
    const { data, error } = await supabase.rpc('perform_unlock', {
      p_startup_id: startupId,
      p_investor_id: investorId,
      p_source: source,
    });
    if (error) throw error;
    return data as UnlockResponse;
  },

  // Get investor reveal
  async getInvestorReveal(
    startupId: string,
    investorId: string
  ): Promise<InvestorReveal> {
    const { data, error } = await supabase.rpc('get_investor_reveal', {
      p_startup_id: startupId,
      p_investor_id: investorId,
    });
    if (error) throw error;
    return data as InvestorReveal;
  },
};

// -----------------------------------------------------------------------------
// CACHING
// -----------------------------------------------------------------------------

const cache = {
  startupContext: new Map<string, { data: StartupContext; ts: number }>(),
  investorReveal: new Map<string, { data: InvestorReveal; ts: number }>(),
};

const CONTEXT_TTL = 5 * 60 * 1000; // 5 min
const REVEAL_TTL = 30 * 60 * 1000; // 30 min (unlocked = stable)

function getCached<T>(
  map: Map<string, { data: T; ts: number }>,
  key: string,
  ttl: number
): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) {
    map.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(
  map: Map<string, { data: T; ts: number }>,
  key: string,
  data: T
) {
  map.set(key, { data, ts: Date.now() });
}

// -----------------------------------------------------------------------------
// HOOK: useResolveStartup
// -----------------------------------------------------------------------------
// Resolves startup ID from URL query param

export function useResolveStartup(url: string | null, forceGenerate = false) {
  const [result, setResult] = useState<ResolverResponse | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setResult(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    pythhRpc.resolveStartup(url, forceGenerate)
      .then(data => {
        if (!cancelled) {
          setResult(data);
          setError(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url, forceGenerate]);

  return { result, loading, error };
}

// -----------------------------------------------------------------------------
// HOOK: useStartupContext
// -----------------------------------------------------------------------------
// Loads once, caches, refreshes on focus. GATED: no fetch if no startupId.

export function useStartupContext(startupId: string | null) {
  const [context, setContext] = useState<StartupContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchContext = useCallback(async (force = false) => {
    if (!startupId) return;
    
    // Check cache first
    if (!force) {
      const cached = getCached(cache.startupContext, startupId, CONTEXT_TTL);
      if (cached) {
        setContext(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await pythhRpc.getStartupContext(startupId);
      if (data) {
        setCache(cache.startupContext, startupId, data);
        setContext(data);
      }
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  // Initial fetch when startupId becomes available
  useEffect(() => {
    if (startupId) {
      setLoading(true);
      fetchContext();
    } else {
      setContext(null);
      setLoading(false);
    }
  }, [startupId, fetchContext]);

  // Refresh on window focus
  useEffect(() => {
    if (!startupId) return;
    const onFocus = () => fetchContext(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [startupId, fetchContext]);

  return { context, loading, error, refresh: () => fetchContext(true) };
}

// -----------------------------------------------------------------------------
// HOOK: useLiveMatchTable
// -----------------------------------------------------------------------------
// Production-safe polling with:
//   - enabled/pausePolling gates
//   - abort + inflight dedupe (no overlapping requests)
//   - keep stale data on error
//   - jitter + backoff (prevents thundering herd)
//   - onUpdated callback for heartbeat UI

interface UseLiveMatchTableOptions {
  pollIntervalMs?: number | null;
  pausePolling?: boolean;
  onUpdated?: (meta: { at: Date; count: number; stale: boolean }) => void;
}

export function useLiveMatchTable(
  startupId: string | null,
  optionsOrInterval: number | null | undefined | UseLiveMatchTableOptions = 10000
) {
  // Normalize options (backward compat: can pass just interval number)
  const options: UseLiveMatchTableOptions = 
    typeof optionsOrInterval === 'object' && optionsOrInterval !== null
      ? optionsOrInterval
      : { pollIntervalMs: optionsOrInterval as number | null | undefined };
  
  const {
    pollIntervalMs = 10000,
    pausePolling = false,
    onUpdated,
  } = options;

  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Prevent overlapping fetches
  const inflightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<{ cancelled: boolean } | null>(null);
  
  // Backoff state (only used after errors)
  const backoffRef = useRef<number>(0);
  
  // Track startupId to detect changes mid-flight
  const startupIdRef = useRef<string | null>(startupId);
  startupIdRef.current = startupId;

  const enabled = !!startupId;

  const doFetch = useCallback(async (force = false) => {
    const currentStartupId = startupIdRef.current;
    if (!currentStartupId) return;
    
    // De-dupe: if already fetching and not forced, skip
    if (inflightRef.current && !force) return;
    
    // Cancel any previous request
    if (abortRef.current) {
      abortRef.current.cancelled = true;
    }
    
    const thisRequest = { cancelled: false };
    abortRef.current = thisRequest;

    const task = (async () => {
      try {
        const data = await pythhRpc.getMatchTable(currentStartupId, 5, 100);
        
        // Check if this request is still relevant
        if (thisRequest.cancelled || startupIdRef.current !== currentStartupId) {
          return;
        }
        
        // Success
        setRows(data);
        setError(null);
        setIsStale(false);
        
        const now = new Date();
        setLastFetch(now);
        onUpdated?.({ at: now, count: data.length, stale: false });
        
        // Reset backoff on success
        backoffRef.current = 0;
      } catch (e) {
        // Check if cancelled
        if (thisRequest.cancelled || startupIdRef.current !== currentStartupId) {
          return;
        }
        
        console.error('[useLiveMatchTable] Fetch error:', e);
        setError(e as Error);
        
        // Keep stale data visible
        setIsStale(true);
        const now = new Date();
        setLastFetch(now);
        onUpdated?.({ at: now, count: rows.length, stale: true });
        
        // Exponential backoff (caps at 2 minutes)
        const interval = pollIntervalMs || 10000;
        backoffRef.current = Math.min(
          backoffRef.current ? backoffRef.current * 2 : interval,
          120000
        );
      } finally {
        setLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = task;
    return task;
  }, [onUpdated, rows.length, pollIntervalMs]);

  // Initial fetch when startupId becomes available
  useEffect(() => {
    if (startupId) {
      setLoading(true);
      backoffRef.current = 0; // Reset backoff on new startup
      void doFetch(true); // Force fetch on startupId change
    } else {
      setRows([]);
      setLoading(false);
      setLastFetch(null);
      setError(null);
      setIsStale(false);
    }
  }, [startupId]); // Intentionally not including doFetch to avoid loops

  // Polling loop (jitter + pause + backoff)
  useEffect(() => {
    if (!enabled) return;
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    if (pausePolling) return;

    let timer: NodeJS.Timeout | null = null;
    let mounted = true;

    const scheduleNext = () => {
      if (!mounted) return;
      
      const base = backoffRef.current || pollIntervalMs;
      
      // Add jitter (+/- 15%) to avoid herd behavior
      const jitter = Math.round(base * 0.15 * (Math.random() * 2 - 1));
      const next = Math.max(2000, base + jitter);

      timer = setTimeout(async () => {
        if (!mounted) return;
        await doFetch();
        scheduleNext();
      }, next);
    };

    // Start polling after initial fetch completes
    scheduleNext();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, pollIntervalMs, pausePolling, doFetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.cancelled = true;
      }
    };
  }, []);

  // Manual refresh (ignores pausePolling)
  const refresh = useCallback(() => {
    if (startupIdRef.current) {
      void doFetch(true);
    }
  }, [doFetch]);

  // Optimistic row update (for immediate UI feedback after unlock)
  const optimisticUnlock = useCallback((investorId: string) => {
    setRows(prev => prev.map(row => 
      row.investor_id === investorId 
        ? { ...row, is_locked: false }
        : row
    ));
  }, []);

  // Rollback optimistic update (on true failure, not already_unlocked)
  const rollbackUnlock = useCallback((investorId: string) => {
    setRows(prev => prev.map(row => 
      row.investor_id === investorId 
        ? { ...row, is_locked: true }
        : row
    ));
  }, []);

  return { rows, loading, error, lastFetch, refresh, optimisticUnlock, rollbackUnlock, isStale };
}

// -----------------------------------------------------------------------------
// HOOK: useUnlock
// -----------------------------------------------------------------------------
// Handles unlock with ROW-LEVEL pending state. GATED.

export function useUnlock(startupId: string | null) {
  const [pendingSet, setPendingSet] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<UnlockResponse | null>(null);

  // Expose whether ANY unlock is in flight (for pausing polls)
  const isAnyPending = pendingSet.size > 0;

  const unlock = useCallback(async (investorId: string): Promise<UnlockResponse> => {
    if (!startupId) throw new Error('No startup ID');
    
    // Mark THIS investor as pending
    setPendingSet(prev => new Set(prev).add(investorId));
    
    try {
      const result = await pythhRpc.unlockInvestor(startupId, investorId);
      setLastResult(result);
      return result;
    } finally {
      setPendingSet(prev => {
        const next = new Set(prev);
        next.delete(investorId);
        return next;
      });
    }
  }, [startupId]);

  // Check if a SPECIFIC investor is pending
  const isPending = useCallback((investorId: string) => pendingSet.has(investorId), [pendingSet]);

  return { unlock, isPending, isAnyPending, lastResult };
}

// -----------------------------------------------------------------------------
// HOOK: useInvestorReveal
// -----------------------------------------------------------------------------
// Fetches investor reveal, caches indefinitely once unlocked. GATED.

export function useInvestorReveal(
  startupId: string | null,
  investorId: string | null
) {
  const [reveal, setReveal] = useState<InvestorReveal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = startupId && investorId ? `${startupId}:${investorId}` : null;

  const fetchReveal = useCallback(async (force = false) => {
    if (!startupId || !investorId || !cacheKey) return;
    
    // Check cache first
    if (!force) {
      const cached = getCached(cache.investorReveal, cacheKey, REVEAL_TTL);
      if (cached && !cached.unlock_required) {
        setReveal(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await pythhRpc.getInvestorReveal(startupId, investorId);
      if (!data.unlock_required) {
        setCache(cache.investorReveal, cacheKey, data);
      }
      setReveal(data);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [startupId, investorId, cacheKey]);

  useEffect(() => {
    if (startupId && investorId) {
      setLoading(true);
      fetchReveal();
    } else {
      setReveal(null);
      setLoading(false);
    }
  }, [startupId, investorId, fetchReveal]);

  return { reveal, loading, error, refresh: () => fetchReveal(true) };
}

// -----------------------------------------------------------------------------
// INVALIDATION HELPERS
// -----------------------------------------------------------------------------

export function invalidateStartupContext(startupId: string) {
  cache.startupContext.delete(startupId);
}

export function invalidateInvestorReveal(startupId: string, investorId: string) {
  cache.investorReveal.delete(`${startupId}:${investorId}`);
}
