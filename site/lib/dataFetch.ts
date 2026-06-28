/**
 * Resilient data helpers for the portfolio pages.
 *
 * - parseDate: Safari/WebKit's Date parser rejects Postgres timestamptz values
 *   with 6-digit microsecond fractions (e.g. "2026-06-04T08:04:32.932192+00:00"),
 *   throwing "The string did not match the expected pattern". We normalize the
 *   fractional seconds to milliseconds and always fail soft (null) instead of throwing.
 * - fetchJson: tolerates cold-start blips with a couple of retries and never lets a
 *   non-JSON / non-OK response surface as a cryptic parser error.
 */

/** Parse a date string into a valid Date, or null. Never throws. */
export function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  try {
    const raw = String(input);
    // Trim sub-millisecond precision (4+ fractional digits) that WebKit can't parse.
    const normalized = raw.replace(/(\.\d{3})\d+/, "$1");
    let d = new Date(normalized);
    if (Number.isNaN(d.getTime())) d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Format a date safely; returns the fallback on any parse failure. */
export function formatDate(
  input: string | null | undefined,
  opts: Intl.DateTimeFormatOptions,
  fallback = "—"
): string {
  const d = parseDate(input);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString("en-US", opts);
  } catch {
    return fallback;
  }
}

/** Fetch + parse JSON with retries for cold-start resilience. Throws a clean message. */
export async function fetchJson<T = unknown>(
  url: string,
  { retries = 2, retryDelayMs = 800 }: { retries?: number; retryDelayMs?: number } = {}
): Promise<T> {
  let lastErr: Error = new Error("Request failed");
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      const text = await r.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error("Unexpected response from server");
      }
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        await new Promise((res) => setTimeout(res, retryDelayMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}
