import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = isServer ? "" : browserSupabaseUrl();
const supabaseKey = isServer ? "" : browserSupabaseAnonKey();

export const hasValidSupabaseCredentials = !!(supabaseUrl && supabaseKey);

if (!isServer && !hasValidSupabaseCredentials) {
  console.warn("[auth] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — OAuth sign-in disabled.");
}

const authConfig = {
  persistSession: true,
  autoRefreshToken: true,
  // Bridge handles #access_token= and ?code=; also parse hash if Supabase sets session first.
  detectSessionInUrl: true,
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
};

export const supabase = hasValidSupabaseCredentials
  ? createClient(supabaseUrl, supabaseKey, {
      auth: authConfig,
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    })
  : null;
