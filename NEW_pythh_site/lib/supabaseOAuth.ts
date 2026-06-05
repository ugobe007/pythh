import type { AuthedUser } from "@/_core/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

export type OAuthSyncResult = { user: AuthedUser };
export type OAuthSyncFn = (input: {
  access_token: string;
}) => Promise<OAuthSyncResult>;

const OAUTH_NEXT_COOKIE = "pythh_oauth_next";
const PKCE_SESSION_KEY = "pythh_pkce_verifier";

function cookieDomainAttr(): string {
  if (typeof document === "undefined") return "";
  const host = window.location.hostname.toLowerCase();
  if (host === "pythh.ai" || host.endsWith(".pythh.ai")) return "; Domain=.pythh.ai";
  return "";
}

function supabaseProjectRef(): string | null {
  const url =
    (typeof window !== "undefined" && window.__PYTHH_RUNTIME__?.supabaseUrl) ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    "";
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

function findPkceVerifier(): string | null {
  if (typeof window === "undefined") return null;
  const ref = supabaseProjectRef();
  if (ref) {
    const fromLs = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
    if (fromLs) return fromLs;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.includes("code-verifier")) {
      const v = localStorage.getItem(key);
      if (v) return v;
    }
  }
  return sessionStorage.getItem(PKCE_SESSION_KEY);
}

/** Restore PKCE verifier into localStorage before exchangeCodeForSession. */
export function ensurePkceVerifierBeforeExchange(): void {
  if (typeof window === "undefined") return;
  const verifier = findPkceVerifier();
  if (!verifier) return;
  const ref = supabaseProjectRef();
  if (ref) {
    localStorage.setItem(`sb-${ref}-auth-token-code-verifier`, verifier);
  }
  sessionStorage.setItem(PKCE_SESSION_KEY, verifier);
}

/** Call after signInWithOAuth — backup verifier for the return trip from Google. */
export function persistPkceVerifierForOAuth(): void {
  if (typeof document === "undefined") return;
  const write = () => {
    const verifier = findPkceVerifier();
    if (!verifier) return false;
    sessionStorage.setItem(PKCE_SESSION_KEY, verifier);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
    return true;
  };
  if (!write()) {
    window.setTimeout(write, 50);
    window.setTimeout(write, 150);
    window.setTimeout(write, 400);
  }
}

/** @deprecated alias */
export function persistPkceVerifierCookie(): void {
  persistPkceVerifierForOAuth();
}

/** Post-login path for server callback redirect (read by server from cookie). */
export function persistOAuthStartCookies(returnPath: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const next = returnPath.startsWith("/") ? returnPath : "/account";
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
}

export function publishOAuthError(message: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem("pythh_oauth_error", message);
  window.dispatchEvent(new CustomEvent("pythh-oauth-error", { detail: message }));
}

const HASH_CAPTURE_KEY = "pythh_oauth_hash_capture";

function readCapturedHashTokens(): {
  access_token: string;
  refresh_token: string | null;
} | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HASH_CAPTURE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      refresh_token?: string | null;
    };
    if (!parsed?.access_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token ?? null,
    };
  } catch {
    return null;
  }
}

/** Implicit OAuth return — Supabase puts tokens in the hash, not ?code=. */
export function parseOAuthHashTokens(): {
  access_token: string;
  refresh_token: string | null;
} | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash?.replace(/^#/, "").trim();
  if (raw && raw.includes("access_token=")) {
    const hash = new URLSearchParams(raw);
    let access_token = hash.get("access_token");
    if (!access_token) {
      const m = raw.match(/(?:^|&)access_token=([^&]*)/);
      access_token = m?.[1] ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
    }
    if (access_token) {
      const tokens = { access_token, refresh_token: hash.get("refresh_token") };
      try {
        sessionStorage.setItem(HASH_CAPTURE_KEY, JSON.stringify(tokens));
      } catch {
        /* ignore quota */
      }
      return tokens;
    }
  }
  return readCapturedHashTokens();
}

export function hasOAuthReturnInUrl(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("code")) return true;
  return !!parseOAuthHashTokens()?.access_token;
}

export function cleanUrlAfterOAuth(): void {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || params.get("redirect");
  const path = window.location.pathname;
  const clean = next && next.startsWith("/") ? next : path;
  window.history.replaceState({}, "", clean);
}

const HASH_SYNC_KEY = "pythh_oauth_hash_sync";

function hashSyncDedupeKey(accessToken: string): string {
  return `${HASH_SYNC_KEY}:${accessToken.slice(0, 24)}`;
}

/**
 * Run before React mounts when Google returns #access_token=… (implicit flow).
 * Sets pythh_session via POST /api/auth/sync-supabase so auth.me works on first paint.
 */
declare global {
  interface Window {
    __PYTHH_OAUTH_HASH_SYNC__?: Promise<{ ok: boolean; error?: string }>;
  }
}

export async function bootstrapOAuthFromHash(): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false };

  const early = window.__PYTHH_OAUTH_HASH_SYNC__;
  if (early) {
    const result = await early.catch(() => ({ ok: false as const }));
    if (result.ok) return { ok: true };
    if (result.error) return { ok: false, error: result.error };
  }

  const tokens = parseOAuthHashTokens();
  if (!tokens) return { ok: false };

  const dedupe = hashSyncDedupeKey(tokens.access_token);
  if (sessionStorage.getItem(dedupe) === "ok") {
    cleanUrlAfterOAuth();
    return { ok: true };
  }
  if (sessionStorage.getItem(dedupe) === "pending") {
    return { ok: false };
  }

  sessionStorage.setItem(dedupe, "pending");
  markOAuthHandoff();

  try {
    if (supabase && tokens.refresh_token) {
      await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
    }

    const res = await fetch("/api/auth/sync-supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ access_token: tokens.access_token }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      sessionStorage.removeItem(dedupe);
      const msg = body.error || `Server sync failed (${res.status})`;
      publishOAuthError(msg);
      return { ok: false, error: msg };
    }

    sessionStorage.setItem(dedupe, "ok");
    cleanUrlAfterOAuth();
    sessionStorage.removeItem(PKCE_SESSION_KEY);
    return { ok: true };
  } catch (err) {
    sessionStorage.removeItem(dedupe);
    const msg = err instanceof Error ? err.message : "Could not complete Google sign-in.";
    publishOAuthError(msg);
    return { ok: false, error: msg };
  }
}

/**
 * Finish OAuth from hash (#access_token=) or ?code= (PKCE).
 */
export async function completeSupabaseOAuthIfNeeded(
  syncSession: OAuthSyncFn,
): Promise<{ ok: boolean; error?: string; user?: AuthedUser }> {
  if (!supabase || !hasValidSupabaseCredentials) {
    return { ok: false, error: "OAuth is not configured in this build." };
  }

  const params = new URLSearchParams(window.location.search);
  const oauthError =
    params.get("error_description") ||
    params.get("error") ||
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description") ||
    new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error");
  if (oauthError) {
    return { ok: false, error: oauthError };
  }

  const hashTokens = parseOAuthHashTokens();
  if (hashTokens) {
    markOAuthHandoff();
    try {
      if (hashTokens.refresh_token) {
        await supabase.auth.setSession({
          access_token: hashTokens.access_token,
          refresh_token: hashTokens.refresh_token,
        });
      }
      const { user } = await syncSession({ access_token: hashTokens.access_token });
      cleanUrlAfterOAuth();
      sessionStorage.removeItem(PKCE_SESSION_KEY);
      return { ok: true, user };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not complete Google sign-in.";
      return { ok: false, error: msg };
    }
  }

  const code = params.get("code");
  if (!code) {
    return { ok: false };
  }

  markOAuthHandoff();
  ensurePkceVerifierBeforeExchange();

  try {
    const { data: existing } = await supabase.auth.getSession();
    if (!existing.session?.access_token) {
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeErr) {
        return {
          ok: false,
          error:
            exchangeErr.message.includes("verifier") || exchangeErr.message.includes("code")
              ? `${exchangeErr.message} Try signing in again from /login (do not refresh this page).`
              : exchangeErr.message,
        };
      }
    }

    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session?.access_token) {
      return { ok: false, error: "No session after Google sign-in." };
    }

    const { user } = await syncSession({ access_token: session.access_token });
    cleanUrlAfterOAuth();
    sessionStorage.removeItem(PKCE_SESSION_KEY);

    return { ok: true, user };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not complete Google sign-in.";
    return { ok: false, error: msg };
  }
}

export function clearOAuthHandoff(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(OAUTH_HANDOFF_KEY);
}

const OAUTH_HANDOFF_KEY = "pythh_oauth_handoff";

export function markOAuthHandoff(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(OAUTH_HANDOFF_KEY, String(Date.now()));
}

export function markOAuthHandoffFromRedirect(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("oauth_handoff") && !params.has("code") && !parseOAuthHashTokens()) return;
  markOAuthHandoff();
  if (params.has("oauth_handoff")) {
    params.delete("oauth_handoff");
    const qs = params.toString();
    const path = window.location.pathname;
    window.history.replaceState({}, "", qs ? `${path}?${qs}` : path);
  }
}

export function isOAuthHandoffActive(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(OAUTH_HANDOFF_KEY);
  if (!raw) return false;
  const started = Number(raw);
  if (!Number.isFinite(started)) {
    sessionStorage.removeItem(OAUTH_HANDOFF_KEY);
    return false;
  }
  if (Date.now() - started > 120_000) {
    sessionStorage.removeItem(OAUTH_HANDOFF_KEY);
    return false;
  }
  return true;
}

/**
 * Redirect target for Supabase OAuth (must be in Supabase redirect allow list).
 * Prefer /account so PKCE verifier stays in the same SPA origin; server callback remains allowed.
 */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("pythh_post_login", next);
  }
  persistOAuthStartCookies(next);
  // Server callback exchanges PKCE and sets pythh_session when sb_pkce cookie is present.
  const callback = new URL(`${window.location.origin}/api/auth/supabase/callback`);
  callback.searchParams.set("next", next);
  return callback.toString();
}

export function readPostLoginPath(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("next") || params.get("redirect");
  if (fromQuery?.startsWith("/")) return fromQuery;
  if (typeof sessionStorage !== "undefined") {
    const stored = sessionStorage.getItem("pythh_post_login");
    sessionStorage.removeItem("pythh_post_login");
    if (stored?.startsWith("/")) return stored;
  }
  return "/account";
}
