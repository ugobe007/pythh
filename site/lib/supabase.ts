import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __PYTHH_RUNTIME__?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  }
}

const isServer = typeof window === "undefined";

function browserSupabaseUrl(): string {
  const r = typeof window !== "undefined" ? window.__PYTHH_RUNTIME__ : undefined;
  return r?.supabaseUrl?.trim() || (import.meta.env.VITE_SUPABASE_URL as string) || "";
}

function browserSupabaseAnonKey(): string {
  const r = typeof window !== "undefined" ? window.__PYTHH_RUNTIME__ : undefined;
  return r?.supabaseAnonKey?.trim() || (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";
}

function getSyncCredentials(): { url: string; key: string } | null {
  if (isServer) return null;
  const url = browserSupabaseUrl();
  const key = browserSupabaseAnonKey();
  return url && key ? { url, key } : null;
}

const authConfig = {
  flowType: "pkce" as const,
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
};

function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: authConfig,
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

const syncCreds = getSyncCredentials();
export let supabase: SupabaseClient | null = syncCreds
  ? createSupabaseClient(syncCreds.url, syncCreds.key)
  : null;

/** True once supabase client exists (build-time env, runtime inject, or /api/public-config). */
export function hasValidSupabaseCredentials(): boolean {
  return supabase !== null;
}

let bootstrapPromise: Promise<boolean> | null = null;

const PUBLIC_CONFIG_TIMEOUT_MS = 5000;

async function fetchPublicConfig(): Promise<{ url: string; key: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PUBLIC_CONFIG_TIMEOUT_MS);
  try {
    const res = await fetch("/api/public-config", {
      cache: "no-store",
      credentials: "same-origin",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[auth] /api/public-config unavailable:", res.status);
      return null;
    }
    const data = (await res.json()) as {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
    const url = String(data.supabaseUrl || "").trim();
    const key = String(data.supabaseAnonKey || "").trim();
    return url && key ? { url, key } : null;
  } catch (err) {
    console.warn("[auth] /api/public-config fetch failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load Supabase anon config when Vercel static build lacks VITE_SUPABASE_*.
 * Fly serves HTML with __PYTHH_RUNTIME__; Vercel uses /api/public-config proxy.
 */
export function bootstrapSupabase(): Promise<boolean> {
  if (supabase) return Promise.resolve(true);
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (isServer) return false;

    const sync = getSyncCredentials();
    if (sync) {
      window.__PYTHH_RUNTIME__ = {
        supabaseUrl: sync.url,
        supabaseAnonKey: sync.key,
      };
      supabase = createSupabaseClient(sync.url, sync.key);
      return true;
    }

    try {
      const creds = await fetchPublicConfig();
      if (!creds) return false;

      window.__PYTHH_RUNTIME__ = { supabaseUrl: creds.url, supabaseAnonKey: creds.key };
      supabase = createSupabaseClient(creds.url, creds.key);
      return true;
    } catch (err) {
      console.warn("[auth] bootstrapSupabase failed:", err);
      return false;
    }
  })();

  return bootstrapPromise;
}

if (!isServer && !supabase) {
  console.info("[auth] No build-time Supabase creds — loading from /api/public-config on boot.");
}
