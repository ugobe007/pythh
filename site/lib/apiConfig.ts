/**
 * API base for site/ on pythh.ai (Vercel).
 * Prefer same-origin `/api/...` so vercel.json proxies to Fly — avoids CORS and keeps URLs on pythh.ai.
 */

const DEV_DEFAULT_API_BASE = "http://localhost:3002";

export function getApiBase(): string {
  let raw = (import.meta.env.VITE_API_URL ?? "").trim();

  if (typeof window !== "undefined" && import.meta.env.PROD && raw) {
    try {
      const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      if (u.hostname.endsWith(".fly.dev")) {
        const h = window.location.hostname;
        if (h === "pythh.ai" || h === "www.pythh.ai") {
          raw = "";
        }
      }
    } catch {
      /* ignore bad VITE_API_URL */
    }
  }

  if (raw) {
    if (import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(raw)) {
      return "";
    }
    return raw.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return DEV_DEFAULT_API_BASE.replace(/\/$/, "");
  }

  return "";
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function fetchTimeoutSignal(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** GET /api/preview/:startupId — retries on 404 while row propagates. */
export async function fetchPreviewReport(
  startupId: string,
  options: { signal?: AbortSignal; maxRetries?: number } = {},
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
