/**
 * Canonical API Configuration
 *
 * Resolution order:
 * 1. `VITE_API_URL` (trimmed, no trailing slash) when set — used in all environments.
 * 2. Development — if unset, default to `http://localhost:3002` (Express default; matches Vite proxy target)
 *    so `/api/*` always hits the Node server from any dev port without relying on same-origin proxy alone.
 * 3. Production — if unset, empty string → same-origin `/api/...` (requires your host to reverse-proxy
 *    `/api` to Node, or you must set `VITE_API_URL` at build time to the API origin).
 */

const DEV_DEFAULT_API_BASE = 'http://localhost:3002';

/**
 * Get the base URL for API calls (no trailing slash).
 */
export function getApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim();

  if (raw) {
    const isProd = import.meta.env.PROD;
    if (isProd && /localhost|127\.0\.0\.1/.test(raw)) {
      console.warn('[api] refusing localhost base in production:', raw);
      return '';
    }
    return raw.replace(/\/$/, '');
  }

  if (import.meta.env.DEV) {
    return DEV_DEFAULT_API_BASE.replace(/\/$/, '');
  }

  return '';
}

/**
 * Build a full API URL from a path
 * @param path The API path (e.g., '/api/something')
 * @returns Full URL for fetch
 */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Human-readable API root for error messages.
 * When VITE_API_URL is unset, requests use same-origin relative URLs — never show an empty label.
 */
export function getApiOriginLabel(): string {
  const base = getApiBase();
  if (base) return base;
  if (typeof window !== 'undefined') {
    return `${window.location.origin} (same-origin)`;
  }
  return 'same-origin';
}

/** Base URL for curl/docs (no trailing slash). Empty VITE_API_URL → current browser origin. */
export function getApiOriginForCurl(): string {
  const raw = getApiBase();
  if (raw) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/**
 * AbortSignal for fetch timeouts. AbortSignal.timeout() is missing in Safari < 16.4 and some embedded browsers.
 */
export function fetchTimeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
    return (AbortSignal as any).timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => {
    try {
      c.abort();
    } catch {
      /* ignore */
    }
  }, ms);
  return c.signal;
}

/**
 * GET /api/preview/:startupId — used immediately after submit/instant flow.
 * Retries only on **404** with short backoff (row occasionally not visible right after insert).
 */
export async function fetchPreviewReport(
  startupId: string,
  options: { signal?: AbortSignal; maxRetries?: number } = {}
): Promise<Response> {
  const maxRetries = Math.max(1, options.maxRetries ?? 4);
  const signal = options.signal ?? fetchTimeoutSignal(45_000);
  let last: Response | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    last = await fetch(apiUrl(`/api/preview/${startupId}`), { signal });
    if (last.ok || last.status !== 404) return last;
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  return last!;
}

// Legacy export for backwards compatibility
export const API_BASE = getApiBase();

/** One-time browser logs so misconfigured API bases are obvious in devtools */
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    const base = getApiBase();
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info('[api] API base →', base || '(empty)', '| example →', apiUrl('/api/health'));
    } else if (import.meta.env.PROD && !base) {
      // eslint-disable-next-line no-console
      console.warn(
        '[api] VITE_API_URL is unset — /api requests use the current origin. For static hosting without a Node /api route, set VITE_API_URL at build time to your API origin.'
      );
    }
  });
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * API client helper for backend endpoints
 * Use this for file uploads and syndicate forms
 * For data operations, use Supabase client directly
 */
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = apiUrl(endpoint);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Upload a file to the backend
 */
export async function uploadFile(file: File): Promise<{ filename: string; originalname: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(apiUrl('/api/documents'), {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`File upload failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Submit syndicate form
 */
export async function submitSyndicateForm(data: { name: string; email: string; message: string }) {
  return apiCall('/api/syndicates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
