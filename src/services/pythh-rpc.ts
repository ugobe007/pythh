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
import { submitStartup as unifiedSubmit, getSessionId as unifiedGetSessionId } from '@/services/submitStartup';
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
  /** Verified company homepage (null when sourced from publisher URL) */
  company_website?: string;
  /** Original publisher/news URL when website wasn't the company homepage */
  source_url?: string;
  /** False when we only have a publisher URL, not the real company site */
  has_company_site?: boolean;
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

// Session ID management — delegates to unified submitStartup service
const SESSION_KEY = 'pythh_session_id';

function getOrCreateSessionId(): string {
  return unifiedGetSessionId();
}

export const pythhRpc = {
  // Get current session ID
  getSessionId(): string {
    return unifiedGetSessionId();
  },

  // Resolve startup by URL or name
  // DELEGATES to unified submitStartup() service — single source of truth
  // HARD_TIMEOUT: 20s safety net only — the RPC fast path is < 50ms.
  // New startups going through Express backend (scrape+score+match) take 5-15s.
  async resolveStartup(url: string, forceGenerate = false): Promise<ResolverResponse> {
    const HARD_TIMEOUT = 20_000;
    const t0 = Date.now();
    const resultPromise = unifiedSubmit(url, { forceGenerate });
    const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), HARD_TIMEOUT));

    const result = await Promise.race([resultPromise, timeoutPromise]);
    const elapsed = Date.now() - t0;

    if (!result) {
      console.error(`[pythhRpc] resolveStartup HARD TIMEOUT after ${HARD_TIMEOUT / 1000}s for:`, url);
      return { found: false, searched: url };
    }

    // Log resolver diagnostics from the RPC response (branch used + server-side timing)
    const rpcBranch = (result as any)._resolver_branch ?? 'unknown';
    const rpcElapsedMs = (result as any)._elapsed_ms ?? null;
    console.info(
      `[pythhRpc] resolved in ${elapsed}ms | status=${result.status} | branch=${rpcBranch}` +
      (rpcElapsedMs != null ? ` | db=${rpcElapsedMs}ms` : '')
    );

    // Fire-and-forget: write telemetry row (no await, best-effort)
    const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const found = result.status !== 'not_found' && result.status !== 'error';
    supabase.from('resolver_telemetry').insert({
      domain,
      found,
      branch: rpcBranch,
      elapsed_ms: elapsed,
      startup_id: found ? (result.startup_id ?? null) : null,
    }).then(() => {/* intentional no-op */});

    return {
      found,
      startup_id: result.startup_id ?? undefined,
      name: result.name ?? undefined,
      website: result.website ?? undefined,
      company_website: result.company_website ?? undefined,
      source_url: result.source_url ?? undefined,
      has_company_site: result.has_company_site ?? true,
      searched: result.searched,
    };
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
    limitLocked = 50
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

// Detect placeholder/stub contexts created before enrichment completes.
// Pattern: "Startup at domain.tld" written by startupResolver / PythhMatchingEngine.
function isPlaceholderContext(ctx: StartupContext | null): boolean {
  if (!ctx) return false;
  const tagline = ctx.startup?.tagline ?? '';
  // Matches "Startup at clique.tech", "Startup at foo.io", etc.
  if (/^Startup at \S+\.\S+$/.test(tagline)) return true;
  // Also treat as placeholder if neither description nor extracted description exists
  const hasDescription =
    ctx.startup?.description ||
    ctx.startup?.extracted_data?.description ||
    ctx.startup?.extracted_data?.value_proposition;
  if (!hasDescription && (!ctx.signals || ctx.signals.total === 0)) return true;
  return false;
}

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
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setResult(null);
      setLoading(false);
      setIsSlowLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setIsSlowLoading(false);

    // After 5s still loading → tell the UI to show "Still working..."
    // The request is NOT cancelled — results will still arrive.
    const slowTimer = setTimeout(() => {
      if (!cancelled) setIsSlowLoading(true);
    }, 5_000);

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
        if (!cancelled) {
          setLoading(false);
          setIsSlowLoading(false);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [url, forceGenerate]);

  return { result, loading, isSlowLoading, error };
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
    
    // Check cache first — skip if it contains placeholder/stub data
    if (!force) {
      const cached = getCached(cache.startupContext, startupId, CONTEXT_TTL);
      if (cached && !isPlaceholderContext(cached)) {
        setContext(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const data = await pythhRpc.getStartupContext(startupId);
      if (data) {
        // Only cache fully-enriched contexts; placeholders always re-fetch
        if (!isPlaceholderContext(data)) {
          setCache(cache.startupContext, startupId, data);
        } else {
          // Remove any stale placeholder that may have been cached previously
          cache.startupContext.delete(startupId);
        }
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
