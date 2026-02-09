// ============================================================================
// UNIFIED STARTUP SUBMISSION SERVICE
// ============================================================================
//
// THE SINGLE SOURCE OF TRUTH for submitting a startup URL anywhere in the app.
//
// Every surface (public URL bar, Find Signals, account profile, admin) MUST
// use this module. No direct fetch('/api/...') calls for submission elsewhere.
//
// Flow:
//   1. FAST: Supabase RPC resolve_startup_by_url (< 500ms for existing)
//   2. If found + ≥ 20 matches + not forced → return immediately
//   3. If found but few matches, or forced → fire /api/instant/submit (async)
//   4. If not found → /api/instant/submit (sync wait — scrape + score + match)
//
// Returns a SubmitResult that every caller can depend on.
// ============================================================================

import { supabase } from '@/lib/supabase';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type SubmitStatus =
  | 'resolved'      // Startup found in DB with enough matches
  | 'generating'    // Startup found but matches being generated
  | 'created'       // New startup created via backend
  | 'not_found'     // Could not resolve or create
  | 'error';        // Something broke

export interface SubmitResult {
  status: SubmitStatus;
  startup_id: string | null;
  name: string | null;
  website: string | null;
  match_count: number;
  /** Original URL or query the user typed */
  searched: string;
  /** Error message when status='error' */
  error?: string;
}

export interface SubmitOptions {
  /** Force regenerate matches even if enough exist */
  forceGenerate?: boolean;
  /** Minimum match count to consider "ready" (default 20) */
  minMatches?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// -----------------------------------------------------------------------------
// SESSION MANAGEMENT
// -----------------------------------------------------------------------------

const SESSION_KEY = 'pythh_session_id';

function getOrCreateSessionId(): string {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getSessionId(): string {
  return getOrCreateSessionId();
}

// -----------------------------------------------------------------------------
// CORE: submitStartup()
// -----------------------------------------------------------------------------

/**
 * Submit a startup URL for matching. This is THE canonical function.
 *
 * @param urlOrQuery - A URL (stripe.com) or company name to resolve
 * @param options    - Optional config (forceGenerate, minMatches, signal)
 * @returns          - SubmitResult with startup_id, status, match_count
 *
 * @example
 *   const result = await submitStartup('stripe.com');
 *   if (result.startup_id) navigate(`/signal-matches?startup=${result.startup_id}`);
 */
export async function submitStartup(
  urlOrQuery: string,
  options: SubmitOptions = {}
): Promise<SubmitResult> {
  const {
    forceGenerate = false,
    minMatches = 20,
    signal,
  } = options;

  const searched = urlOrQuery.trim();
  if (!searched) {
    return { status: 'error', startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Empty URL' };
  }

  const sessionId = getOrCreateSessionId();

  // ── STEP 1: Fast path — Supabase RPC ─────────────────────────────────────
  try {
    const { data, error } = await supabase.rpc('resolve_startup_by_url', {
      p_url: searched,
    });

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.found || row?.startup_id) {
        // Get accurate match count
        let matchCount = row.match_count ?? 0;
        try {
          const { data: countData } = await supabase.rpc('get_match_count', {
            p_startup_id: row.startup_id,
          });
          if (typeof countData === 'number') matchCount = countData;
        } catch { /* fall back to row.match_count */ }

        // If enough matches and not forced → done
        if (matchCount >= minMatches && !forceGenerate) {
          return {
            status: 'resolved',
            startup_id: row.startup_id,
            name: row.startup_name,
            website: row.canonical_url,
            match_count: matchCount,
            searched,
          };
        }

        // Startup exists but needs matches → trigger generation (fire-and-forget)
        console.log(`[submitStartup] Found "${row.startup_name}" with ${matchCount} matches${forceGenerate ? ' (forced)' : ''} — triggering match generation`);
        triggerMatchGeneration(searched, sessionId, forceGenerate, signal);

        return {
          status: 'generating',
          startup_id: row.startup_id,
          name: row.startup_name,
          website: row.canonical_url,
          match_count: matchCount,
          searched,
        };
      }
    }
  } catch (e) {
    console.warn('[submitStartup] RPC fast path failed (non-fatal):', e);
  }

  // Check abort
  if (signal?.aborted) {
    return { status: 'error', startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Aborted' };
  }

  // ── STEP 2: Slow path — Express backend (scrape + score + match) ─────────
  // Race the backend call against a timeout. If backend takes > 8s, check the
  // DB directly (backend may have created the startup but still be matching).
  try {
    const fetchController = new AbortController();
    const combinedSignal = signal
      ? (AbortSignal as any).any?.([signal, fetchController.signal]) ?? fetchController.signal
      : fetchController.signal;

    const fetchPromise = fetch('/api/instant/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
      },
      body: JSON.stringify({
        url: searched,
        session_id: sessionId,
        force_generate: forceGenerate,
      }),
      signal: combinedSignal,
    });

    const TIMEOUT_MS = 8_000; // Backend should early-return in ~1s; 8s allows for Fly.io cold starts
    const timeoutPromise = new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), TIMEOUT_MS));

    const raceResult = await Promise.race([
      fetchPromise.then(r => ({ type: 'response' as const, response: r })),
      timeoutPromise.then(() => ({ type: 'timeout' as const })),
    ]);

    if (raceResult.type === 'response') {
      const response = raceResult.response;
      if (response.ok) {
        const result = await response.json();
        if (result.startup_id) {
          // gen_in_progress means background pipeline is running — show "generating" UI
          const isGenerating = result.gen_in_progress || result.timed_out || (result.is_new && result.match_count === 0);
          return {
            status: isGenerating ? 'generating' : 'created',
            startup_id: result.startup_id,
            name: result.startup?.name || result.name || null,
            website: result.startup?.website || result.website || null,
            match_count: result.match_count || 0,
            searched,
          };
        }
      }

      // Non-OK response
      const errText = await response.text().catch(() => '');
      console.error('[submitStartup] Backend returned', response.status, errText);
      return {
        status: 'not_found',
        startup_id: null,
        name: null,
        website: null,
        match_count: 0,
        searched,
        error: `Backend returned ${response.status}`,
      };
    }

    // ── TIMEOUT: Backend still working — abort fetch, check DB ──────────
    console.log(`[submitStartup] Backend slow (>${TIMEOUT_MS / 1000}s) — aborting fetch, checking DB`);
    // ABORT the fetch immediately — never block UI waiting for backend.
    // Backend has early-return architecture; if it hasn't responded in 8s
    // something is wrong. The background pipeline will still complete.
    fetchController.abort();

    try {
      const { data } = await supabase.rpc('resolve_startup_by_url', { p_url: searched });
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.startup_id) {
        return {
          status: 'generating',
          startup_id: row.startup_id,
          name: row.startup_name ?? null,
          website: row.canonical_url ?? null,
          match_count: row.match_count ?? 0,
          searched,
        };
      }
    } catch { /* ignore */ }

    // Backend hasn't created the startup yet — return not_found.
    // User can retry; SignalMatches will show appropriate UI.
    return {
      status: 'not_found',
      startup_id: null,
      name: null,
      website: null,
      match_count: 0,
      searched,
      error: 'Request timed out — please try again',
    };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { status: 'error', startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Aborted' };
    }
    console.error('[submitStartup] Backend call failed:', e);
    return {
      status: 'error',
      startup_id: null,
      name: null,
      website: null,
      match_count: 0,
      searched,
      error: e?.message || 'Network error',
    };
  }
}

// Fire-and-forget match generation trigger (non-blocking)
function triggerMatchGeneration(
  url: string,
  sessionId: string,
  forceGenerate: boolean,
  signal?: AbortSignal
): void {
  fetch('/api/instant/submit', {
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
    signal,
  }).catch((e) => {
    console.warn('[submitStartup] Background match generation failed (non-fatal):', e);
  });
}

// -----------------------------------------------------------------------------
// REACT HOOK: useSubmitStartup()
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

export type SubmitPhase = 'idle' | 'submitting' | 'done' | 'error';

export interface UseSubmitStartupResult {
  /** Current phase of submission */
  phase: SubmitPhase;
  /** Submission result (available when phase='done') */
  result: SubmitResult | null;
  /** Error message (available when phase='error') */
  error: string | null;
  /** The resolved startup_id (shortcut) */
  startupId: string | null;
  /** Trigger submission imperatively */
  submit: (url: string, opts?: SubmitOptions) => Promise<SubmitResult>;
  /** Reset to idle */
  reset: () => void;
}

/**
 * React hook for startup submission.
 *
 * Can be used in two modes:
 *   1. Auto-submit: pass initialUrl and it fires on mount
 *   2. Manual: call submit(url) from a button handler
 *
 * @param initialUrl - If provided, auto-submits on mount
 * @param options    - SubmitOptions (forceGenerate, minMatches)
 *
 * @example
 *   // Auto-submit from URL query param
 *   const url = searchParams.get('url');
 *   const { phase, startupId, result } = useSubmitStartup(url);
 *
 *   // Manual submit from form
 *   const { submit, phase, startupId } = useSubmitStartup();
 *   <button onClick={() => submit(inputValue)}>Find Matches</button>
 */
export function useSubmitStartup(
  initialUrl?: string | null,
  options?: SubmitOptions
) {
  const [phase, setPhase] = useState<SubmitPhase>(initialUrl ? 'submitting' : 'idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Cancel on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const submit = useCallback(async (url: string, opts?: SubmitOptions): Promise<SubmitResult> => {
    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (mountedRef.current) {
      setPhase('submitting');
      setError(null);
      setResult(null);
    }

    const mergedOpts: SubmitOptions = {
      ...options,
      ...opts,
      signal: controller.signal,
    };

    const res = await submitStartup(url, mergedOpts);

    if (!mountedRef.current) return res;

    if (res.status === 'error' || res.status === 'not_found') {
      setPhase('error');
      setError(res.error || 'Startup not found');
      setResult(res);
    } else {
      setPhase('done');
      setResult(res);
      setError(null);
    }

    return res;
  }, [options]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setResult(null);
    setError(null);
  }, []);

  // Auto-submit on initialUrl
  useEffect(() => {
    if (initialUrl) {
      submit(initialUrl);
    }
  }, [initialUrl]); // intentionally not including submit to avoid loops

  const startupId = result?.startup_id ?? null;

  return { phase, result, error, startupId, submit, reset };
}

// -----------------------------------------------------------------------------
// NAVIGATION HELPER
// -----------------------------------------------------------------------------

/**
 * Build the canonical URL path for viewing matches.
 * Use this everywhere instead of hardcoding paths.
 */
export function matchesPath(startupIdOrUrl: string, isUrl = false): string {
  if (isUrl) {
    return `/signal-matches?url=${encodeURIComponent(startupIdOrUrl)}`;
  }
  return `/signal-matches?startup=${encodeURIComponent(startupIdOrUrl)}`;
}
