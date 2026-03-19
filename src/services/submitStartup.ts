// ============================================================================
// UNIFIED STARTUP SUBMISSION SERVICE — SINGLE ORCHESTRATION LAYER
// ============================================================================
//
// Single source of truth for:
//   - URL normalization
//   - Existing startup resolution
//   - Workflow submission
//   - Status polling
//   - Final result shape
//
// Canonical flow:
//   A) normalize input
//   B) resolve existing startup via RPC
//   C) if sufficient matches exist, return resolved
//   D) if startup exists but matches are insufficient, trigger generation
//   E) if startup does not exist, submit workflow
//   F) poll until startup appears / processing advances
//
// Every surface (PythhMain, SignalMatches, legacy redirects, etc.) should call
// this module rather than re-implementing flow logic.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiUrl } from '@/lib/apiConfig';
import { normalizeStartupUrl, canonicalizeStartupUrl } from '@/utils/normalizeUrl';

// Re-export for consumers
export { normalizeStartupUrl } from '@/utils/normalizeUrl';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type SubmitStatus =
  | 'resolved'
  | 'generating'
  | 'created'
  | 'not_found'
  | 'error';

export interface SubmitResult {
  status: SubmitStatus;
  startup_id: string | null;
  name: string | null;
  website: string | null;
  match_count: number;
  searched: string;
  error?: string;
  _resolver_branch?: string;
  _elapsed_ms?: number;
  company_website?: string | null;
  source_url?: string | null;
  has_company_site?: boolean;
}

export interface SubmitOptions {
  forceGenerate?: boolean;
  minMatches?: number;
  signal?: AbortSignal;
}

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

const SESSION_KEY = 'pythh_session_id';
const SUBMIT_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 2_000;
const DEFAULT_POLL_TIMEOUT_MS = 20_000;

// -----------------------------------------------------------------------------
// SESSION MANAGEMENT
// -----------------------------------------------------------------------------

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;

  const sessionId = `sess_${crypto.randomUUID()}`;
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

export function getSessionId(): string {
  return getOrCreateSessionId();
}

// -----------------------------------------------------------------------------
// INTERNAL HELPERS
// -----------------------------------------------------------------------------

type ResolveRow = {
  startup_id?: string | null;
  startup_name?: string | null;
  canonical_url?: string | null;
  company_website?: string | null;
  source_url?: string | null;
  has_company_site?: boolean | null;
  match_count?: number | null;
  resolved?: boolean | null;
  found?: boolean | null;
  resolver_branch?: string | null;
  reason?: string | null;
  elapsed_ms?: number | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function combineAbortSignals(signalA?: AbortSignal, signalB?: AbortSignal): AbortSignal | undefined {
  if (!signalA && !signalB) return undefined;
  if (!signalA) return signalB;
  if (!signalB) return signalA;

  const controller = new AbortController();

  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  if (signalA.aborted || signalB.aborted) {
    abort();
    return controller.signal;
  }

  signalA.addEventListener('abort', abort, { once: true });
  signalB.addEventListener('abort', abort, { once: true });

  return controller.signal;
}

async function resolveStartupRow(searched: string): Promise<ResolveRow | null> {
  const rpcResult = await supabase.rpc('resolve_startup_by_url', { p_url: searched });

  if (rpcResult.error) {
    throw rpcResult.error;
  }

  const data = rpcResult.data;
  if (!data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as ResolveRow | null;
}

async function countSuggestedMatches(startupId: string): Promise<number> {
  const { count, error } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId)
    .eq('status', 'suggested');

  if (error) {
    console.warn('[FindSignals] count matches failed:', error);
    return 0;
  }

  return count ?? 0;
}

function buildResolvedResult(
  row: ResolveRow,
  searched: string,
  status: Extract<SubmitStatus, 'resolved' | 'generating'>
): SubmitResult {
  return {
    status,
    startup_id: row.startup_id ?? null,
    name: row.startup_name ?? null,
    website: row.canonical_url ?? row.company_website ?? row.source_url ?? null,
    match_count: typeof row.match_count === 'number' ? row.match_count : 0,
    searched,
    _resolver_branch: row.resolver_branch ?? row.reason ?? 'rpc',
    _elapsed_ms: typeof row.elapsed_ms === 'number' ? row.elapsed_ms : undefined,
    company_website: row.company_website ?? null,
    source_url: row.source_url ?? null,
    has_company_site: row.has_company_site ?? true,
  };
}

async function pollQueuedStatus(
  searchValue: string,
  signal?: AbortSignal,
  timeoutMs = DEFAULT_POLL_TIMEOUT_MS
): Promise<SubmitResult | null> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (signal?.aborted) return null;

    // 1) Try status endpoint
    try {
      const statusRes = await fetch(
        apiUrl(`/api/instant/status?url=${encodeURIComponent(searchValue)}`),
        { signal }
      );

      if (statusRes.ok) {
        const status = await statusRes.json();
        const startupId = status?.startupId ?? status?.startup_id ?? null;

        if (startupId) {
          console.log('[FindSignals] poll:done', { startupId });

          return {
            status: status?.status === 'ready' ? 'created' : 'generating',
            startup_id: startupId,
            name: status?.startup?.name ?? status?.name ?? null,
            website: status?.startup?.website ?? status?.website ?? null,
            match_count: status?.match_count ?? 0,
            searched: searchValue,
          };
        }
      }
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err?.name !== 'AbortError') {
        console.warn('[FindSignals] status poll failed (continuing):', error);
      }
    }

    // 2) Also try RPC resolution during polling
    try {
      const row = await resolveStartupRow(searchValue);
      if (row?.startup_id) {
        const matchCount = typeof row.match_count === 'number' ? row.match_count : 0;
        const result = {
          ...buildResolvedResult(
            { ...row, match_count: matchCount },
            searchValue,
            matchCount > 0 ? 'created' : 'generating'
          ),
        };
        console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
        return result;
      }
    } catch (error) {
      console.warn('[FindSignals] RPC poll failed (continuing):', error);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return null;
}

function fireAndForgetMatchGeneration(
  url: string,
  sessionId: string,
  forceGenerate: boolean
): void {
  const canonical = canonicalizeStartupUrl(url);

  fetch(apiUrl('/api/instant/submit'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
    body: JSON.stringify({
      url,
      session_id: sessionId,
      force_generate: forceGenerate,
      ...(canonical?.domain ? { domain_hint: canonical.domain } : {}),
      ...(canonical?.companyName ? { company_name_hint: canonical.companyName } : {}),
    }),
  }).catch((error) => {
    console.warn('[submitStartup] Background match generation failed:', error);
  });
}

// -----------------------------------------------------------------------------
// CORE: submitStartup()
// -----------------------------------------------------------------------------

export async function submitStartup(
  urlOrQuery: string,
  options: SubmitOptions = {}
): Promise<SubmitResult> {
  const { forceGenerate = false, minMatches = 20, signal } = options;

  const rawInput = urlOrQuery.trim();
  const normalizedUrl = normalizeStartupUrl(rawInput);

  if (!normalizedUrl) {
    console.log('[FindSignals] normalize', { rawUrl: rawInput, normalizedUrl: '' });
    const result = { status: 'error' as const, startup_id: null, name: null, website: null, match_count: 0, searched: rawInput, error: 'Please enter a valid startup URL.' };
    console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
    return result;
  }

  const canonical = canonicalizeStartupUrl(rawInput);
  const searched = canonical?.canonicalUrl ?? `https://${normalizedUrl.split('/')[0]}/`;
  const domainHint = canonical?.domain ?? null;
  const companyNameHint = canonical?.companyName ?? null;
  const sessionId = getOrCreateSessionId();

  console.log('[FindSignals] normalize', {
    rawUrl: rawInput,
    normalizedUrl,
    searched,
    domainHint,
    companyNameHint,
  });

  if (signal?.aborted) {
    const result = { status: 'error' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Aborted' };
    console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Phase B: Resolve existing via RPC
  // ---------------------------------------------------------------------------
  try {
    console.log('[FindSignals] resolve_existing:start', { searched });

    const row = await resolveStartupRow(searched);
    const found = !!(row?.resolved || row?.found || row?.startup_id);

    if (found && row?.startup_id) {
      const matchCount = typeof row.match_count === 'number' ? row.match_count : 0;

      console.log('[FindSignals] resolve_existing:done', {
        startupId: row.startup_id,
        matchCount,
      });

      if (matchCount >= minMatches && !forceGenerate) {
        const result = buildResolvedResult(
          { ...row, match_count: matchCount },
          searched,
          'resolved'
        );
        console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
        return result;
      }

      // Do not block the UI on a direct match-count query.
      // If match_count is unknown or low, return immediately and let the page load rows.
      console.log('[FindSignals] submit:start', {
        searched,
        reason: 'needs_matches_or_unknown_count',
      });

      fireAndForgetMatchGeneration(searched, sessionId, forceGenerate);

      const result = buildResolvedResult(
        { ...row, match_count: matchCount },
        searched,
        'generating'
      );
      console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
      return result;
    }
  } catch (error) {
    console.warn('[FindSignals] resolve failed (non-fatal):', error);
  }

  if (signal?.aborted) {
    const result = { status: 'error' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Aborted' };
    console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
    return result;
  }

  // ---------------------------------------------------------------------------
  // Phase C + D: Submit workflow, then poll if needed
  // ---------------------------------------------------------------------------
  try {
    console.log('[FindSignals] submit:start', { searched });

    const timeoutController = new AbortController();
    const combinedSignal = combineAbortSignals(signal, timeoutController.signal);

    const timeoutHandle = window.setTimeout(() => {
      timeoutController.abort();
    }, SUBMIT_TIMEOUT_MS);

    let response: Response | null = null;

    try {
      response = await fetch(apiUrl('/api/instant/submit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({
          url: searched,
          session_id: sessionId,
          force_generate: forceGenerate,
          domain_hint: domainHint,
          company_name_hint: companyNameHint,
        }),
        signal: combinedSignal,
      });
    } finally {
      window.clearTimeout(timeoutHandle);
    }

    if (response.ok) {
      const result = await response.json();
      const startupId = result?.startup_id ?? result?.startupId ?? null;

      if (startupId) {
        const isGenerating =
          result?.gen_in_progress === true ||
          result?.timed_out === true ||
          (result?.is_new === true && (result?.match_count ?? 0) === 0);

        console.log('[FindSignals] submit:done', { startupId, isGenerating });

        const apiResult = { status: (isGenerating ? 'generating' : 'created') as const, startup_id: startupId, name: result?.startup?.name ?? result?.name ?? null, website: result?.startup?.website ?? result?.website ?? null, match_count: result?.match_count ?? 0, searched };
        console.log('[FindSignals] return', { status: apiResult.status, startup_id: apiResult.startup_id, searched: apiResult.searched });
        return apiResult;
      }

      if (result?.status === 'queued' || result?.queued === true) {
        const queued = await pollQueuedStatus(searched, signal, DEFAULT_POLL_TIMEOUT_MS);
        if (queued) {
          console.log('[FindSignals] return', { status: queued.status, startup_id: queued.startup_id, searched: queued.searched });
          return queued;
        }

        const queuedResult = {
          status: 'generating' as const,
          startup_id: null,
          name: null,
          website: null,
          match_count: 0,
          searched,
          error: 'Analysis queued — still processing',
        };
        console.log('[FindSignals] return', { status: queuedResult.status, startup_id: queuedResult.startup_id, searched: queuedResult.searched });
        return queuedResult;
      }

      // Fallback: success response but no clear startup id.
      const fallbackRow = await resolveStartupRow(searched).catch(() => null);
      if (fallbackRow?.startup_id) {
        const matchCount = typeof fallbackRow.match_count === 'number' ? fallbackRow.match_count : 0;
        const result = buildResolvedResult(
          { ...fallbackRow, match_count: matchCount },
          searched,
          matchCount > 0 ? 'created' : 'generating'
        );
        console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
        return result;
      }
    }

    const errText = response ? await response.text().catch(() => '') : '';
    const statusCode = response?.status ?? 0;
    let backendReason = '';
    try {
      const errJson = errText ? JSON.parse(errText) : {};
      backendReason = errJson?.reason || errJson?.error || '';
    } catch {
      /* ignore */
    }

    console.error('[FindSignals] submit failed', statusCode, errText);

    if (statusCode === 503) {
      const queued = await pollQueuedStatus(searched, signal, DEFAULT_POLL_TIMEOUT_MS);
      if (queued) {
        console.log('[FindSignals] return', { status: queued.status, startup_id: queued.startup_id, searched: queued.searched });
        return queued;
      }
    }

    const errorMsg = backendReason
      ? (statusCode ? `Backend error (${statusCode}): ${backendReason}` : backendReason)
      : (statusCode ? `Backend returned ${statusCode}` : 'Backend request failed');
    const notFoundResult = { status: 'not_found' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: errorMsg };
    console.log('[FindSignals] return', { status: notFoundResult.status, startup_id: notFoundResult.startup_id, searched: notFoundResult.searched });
    return notFoundResult;
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };

    if (err?.name === 'AbortError') {
      // Could be caller cancellation OR local submit timeout.
      if (signal?.aborted) {
        const abortResult = { status: 'error' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Aborted' };
        console.log('[FindSignals] return', { status: abortResult.status, startup_id: abortResult.startup_id, searched: abortResult.searched });
        return abortResult;
      }

      console.log('[FindSignals] submit timeout, checking DB');

      try {
        const row = await resolveStartupRow(searched);
        if (row?.startup_id) {
          const matchCount = typeof row.match_count === 'number' ? row.match_count : 0;
          const result = buildResolvedResult(
            { ...row, match_count: matchCount },
            searched,
            'generating'
          );
          console.log('[FindSignals] return', { status: result.status, startup_id: result.startup_id, searched: result.searched });
          return result;
        }
      } catch {
        // ignore and fall through
      }

      const queued = await pollQueuedStatus(searched, signal, DEFAULT_POLL_TIMEOUT_MS);
      if (queued) {
        console.log('[FindSignals] return', { status: queued.status, startup_id: queued.startup_id, searched: queued.searched });
        return queued;
      }

      const timeoutResult = { status: 'not_found' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: 'Request timed out — please try again' };
      console.log('[FindSignals] return', { status: timeoutResult.status, startup_id: timeoutResult.startup_id, searched: timeoutResult.searched });
      return timeoutResult;
    }

    console.error('[FindSignals] submit error:', error);

    const errorResult = { status: 'error' as const, startup_id: null, name: null, website: null, match_count: 0, searched, error: err?.message || 'Network error' };
    console.log('[FindSignals] return', { status: errorResult.status, startup_id: errorResult.startup_id, searched: errorResult.searched });
    return errorResult;
  }
}

// -----------------------------------------------------------------------------
// REACT HOOK
// -----------------------------------------------------------------------------

export type SubmitPhase = 'idle' | 'submitting' | 'done' | 'error';

export interface UseSubmitStartupResult {
  phase: SubmitPhase;
  result: SubmitResult | null;
  error: string | null;
  startupId: string | null;
  submit: (url: string, opts?: SubmitOptions) => Promise<SubmitResult>;
  reset: () => void;
}

export function useSubmitStartup(
  initialUrl?: string | null,
  options?: SubmitOptions
): UseSubmitStartupResult {
  const [phase, setPhase] = useState<SubmitPhase>(initialUrl ? 'submitting' : 'idle');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const submit = useCallback(
    async (url: string, opts?: SubmitOptions): Promise<SubmitResult> => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      if (mountedRef.current) {
        setPhase('submitting');
        setError(null);
        setResult(null);
      }

      const res = await submitStartup(url, {
        ...options,
        ...opts,
        signal: controller.signal,
      });

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
    },
    [options]
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!initialUrl) return;
    void submit(initialUrl);
  }, [initialUrl, submit]);

  return {
    phase,
    result,
    error,
    startupId: result?.startup_id ?? null,
    submit,
    reset,
  };
}

// -----------------------------------------------------------------------------
// NAVIGATION HELPER
// -----------------------------------------------------------------------------

export function matchesPath(startupIdOrUrl: string, isUrl = false): string {
  if (isUrl) {
    return `/signal-matches?url=${encodeURIComponent(startupIdOrUrl)}`;
  }

  return `/signal-matches?startup=${encodeURIComponent(startupIdOrUrl)}`;
}
