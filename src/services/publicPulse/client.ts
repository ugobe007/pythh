import type { PublicPulseQuery, PublicSignalPulse } from "../../types/publicPulse";

/**
 * Public Pulse API Client
 * - Timeout + abort support
 * - Lightweight retry (network/5xx/429 only)
 * - Tiny in-memory cache (fast filter UX)
 * - Consistent error messages
 *
 * NOTE: This client should NEVER inject demo data.
 * Demo fallback belongs in hooks (DEV only) like you already did.
 */

type FetchOptions = {
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_RETRIES = 1; // keep it low; we don't want spinner loops in demo
const CACHE_TTL_MS = 30_000; // 30s; keeps filters snappy
const MAX_CACHE_KEYS = 25; // prevent unbounded growth from random filter combos

type CacheEntry = {
  at: number;
  data: PublicSignalPulse[];
};

const cache = new Map<string, CacheEntry>();

function cacheKey(query: PublicPulseQuery): string {
  // deterministic stable key (query object order isn't guaranteed)
  const normalized: PublicPulseQuery = {
    category: query.category || undefined,
    stageBand: query.stageBand || undefined,
    momentum: query.momentum || undefined,
    limit: query.limit ?? 12,
  };
  return JSON.stringify(normalized);
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.message.toLowerCase().includes("aborted"))
  );
}

function shouldRetry(status?: number): boolean {
  if (!status) return true; // network error / no status
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeoutSignal(timeoutMs: number, upstream?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener("abort", onAbort, { once: true });
  }

  const cleanup = () => {
    clearTimeout(timer);
    if (upstream) upstream.removeEventListener("abort", onAbort);
  };

  return { signal: controller.signal, cleanup };
}

function normalizeErrorMessage(status?: number, text?: string): string {
  if (status === 401 || status === 403) return "Not authorized to read public pulses.";
  if (status === 404) return "Public pulses endpoint not found.";
  if (status === 429) return "Rate limited. Try again in a moment.";
  if (status && status >= 500) return "Public pulse service is temporarily unavailable.";
  if (text && text.trim().length) return text;
  return "Unable to load public pulses.";
}

/**
 * Main entry: fetch public pulses
 * Signature matches your hook usage:
 *   fetchPublicPulses(query, { signal })
 */
export async function fetchPublicPulses(
  query: PublicPulseQuery,
  options?: FetchOptions
): Promise<PublicSignalPulse[]> {
  const key = cacheKey(query);

  // Cache hit (fresh)
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }

  // Wire this to your actual backend route when ready.
  // For now, if you already have a real endpoint, set it here:
  const url = buildUrl(query);

  const retries = DEFAULT_RETRIES;
  let attempt = 0;

  while (true) {
    attempt++;

    const { signal, cleanup } = withTimeoutSignal(DEFAULT_TIMEOUT_MS, options?.signal);
    try {
      // If aborted already, throw fast
      if (signal.aborted) throw new Error("Aborted");

      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal,
      });

      if (!res.ok) {
        const bodyText = await safeReadText(res);
        const msg = normalizeErrorMessage(res.status, bodyText);

        if (attempt <= retries && shouldRetry(res.status)) {
          // small backoff; keep tight for UX
          await sleep(250 * attempt);
          continue;
        }

        throw new Error(msg);
      }

      const json = await res.json();
      const rows = normalizeRows(json);

      // Cache it (even if empty — helps prevent rapid refetch loops)
      cache.set(key, { at: Date.now(), data: rows });

      // Evict oldest entry if cache grows too large (FIFO)
      if (cache.size > MAX_CACHE_KEYS) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }

      return rows;
    } catch (e) {
      if (isAbortError(e)) throw new Error("Aborted");

      // retry only if eligible and not aborted
      if (attempt <= retries) {
        await sleep(200 * attempt);
        continue;
      }

      // fallback: if request failed, but we have a stale cache entry, return it
      // (prevents UI thrash during brief outages)
      const stale = cache.get(key);
      if (stale) return stale.data;

      throw e instanceof Error ? e : new Error("Unable to load public pulses.");
    } finally {
      cleanup();
    }
  }
}

/* -------------------------- helpers -------------------------- */

function buildUrl(query: PublicPulseQuery): string {
  // If you have a deployed API, swap to that base URL.
  // Examples:
  // - "/api/public-pulses"
  // - import.meta.env.VITE_API_BASE_URL + "/public/pulses"
  const base = "/api/public-pulses";

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.stageBand) params.set("stageBand", query.stageBand);
  if (query.momentum) params.set("momentum", query.momentum);
  if (query.limit != null) params.set("limit", String(query.limit));

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function normalizeRows(payload: unknown): PublicSignalPulse[] {
  // Accept a few shapes: array, { data }, { pulses }
  const rows =
    Array.isArray(payload)
      ? payload
      : (payload as any)?.data && Array.isArray((payload as any).data)
      ? (payload as any).data
      : (payload as any)?.pulses && Array.isArray((payload as any).pulses)
      ? (payload as any).pulses
      : [];

  // Defensive: coerce minimal fields, don't crash UI
  return rows
    .map((r: any) => {
      if (!r) return null;

      // Provide safe defaults for required fields
      const pulse: PublicSignalPulse = {
        pulseId: String(r.pulseId ?? r.id ?? cryptoRandom()),
        computedAt: String(r.computedAt ?? new Date().toISOString()),

        isAnonymized: Boolean(r.isAnonymized ?? true),
        displayName: r.displayName ?? undefined,

        category: String(r.category ?? "Unknown"),
        stageBand: r.stageBand ?? "Unknown",
        momentum: r.momentum ?? "Stable",
        timingWindow: r.timingWindow ?? "Closed",

        alignmentBefore: Number(r.alignmentBefore ?? 0),
        alignmentAfter: Number(r.alignmentAfter ?? 0),
        readinessBefore: Number(r.readinessBefore ?? 0),
        readinessAfter: Number(r.readinessAfter ?? 0),

        triggerSignals: Array.isArray(r.triggerSignals) ? r.triggerSignals.map(String) : [],
        unlockedInvestorsCount: Number(r.unlockedInvestorsCount ?? 0),
        investorClass: r.investorClass ?? "Seed",

        recommendedAction: r.recommendedAction
          ? {
              title: String(r.recommendedAction.title ?? ""),
              probabilityDeltaPct:
                typeof r.recommendedAction.probabilityDeltaPct === "number"
                  ? r.recommendedAction.probabilityDeltaPct
                  : undefined,
            }
          : undefined,
      };

      return pulse;
    })
    .filter(Boolean) as PublicSignalPulse[];
}

// avoids depending on crypto.randomUUID (not always polyfilled)
function cryptoRandom(): string {
  return `pulse-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
