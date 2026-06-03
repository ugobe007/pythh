import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

export type OAuthSyncFn = (input: { access_token: string }) => Promise<unknown>;

const OAUTH_NEXT_COOKIE = "pythh_oauth_next";

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

/** Post-login path for server callback redirect (read by server from cookie). */
export function persistOAuthStartCookies(returnPath: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const next = returnPath.startsWith("/") ? returnPath : "/account";
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
}

/** Optional fallback if server exchange is re-enabled; client path uses localStorage only. */
export function persistPkceVerifierCookie(): void {
  if (typeof document === "undefined") return;
  const write = () => {
    const ref = supabaseProjectRef();
    let verifier = ref
      ? localStorage.getItem(`sb-${ref}-auth-token-code-verifier`)
      : null;
    if (!verifier) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.includes("code-verifier")) {
          verifier = localStorage.getItem(key);
          break;
        }
      }
    }
    if (!verifier) return false;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
    return true;
  };
  if (!write()) {
    window.setTimeout(write, 50);
    window.setTimeout(write, 200);
  }
}

/**
 * Finish OAuth when URL has ?code= (fallback when Supabase returns to /account).
 */
export async function completeSupabaseOAuthIfNeeded(
  syncSession: OAuthSyncFn,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !hasValidSupabaseCredentials) {
    return { ok: false, error: "OAuth is not configured in this build." };
  }

  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error_description") || params.get("error");
  if (oauthError) {
    return { ok: false, error: oauthError };
  }

  const code = params.get("code");
  if (!code) {
    return { ok: false };
  }

  markOAuthHandoff();

  const { data: existing } = await supabase.auth.getSession();
  if (!existing.session?.access_token) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      return { ok: false, error: exchangeErr.message };
    }
  }

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    return { ok: false, error: "No session after Google sign-in." };
  }

  await syncSession({ access_token: session.access_token });

  const next = params.get("next") || params.get("redirect");
  const path = window.location.pathname;
  const clean = next && next.startsWith("/") ? next : path;
  window.history.replaceState({}, "", clean);
  sessionStorage.removeItem("pythh_oauth_handoff");

  return { ok: true };
}

const OAUTH_HANDOFF_KEY = "pythh_oauth_handoff";

/** Set when returning from Google so /account does not bounce to /login mid-sync. */
export function markOAuthHandoff(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(OAUTH_HANDOFF_KEY, String(Date.now()));
}

/** Call on /account when server redirect includes oauth_handoff=1. */
export function markOAuthHandoffFromRedirect(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("oauth_handoff") && !params.has("code")) return;
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
  if (Date.now() - started > 60_000) {
    sessionStorage.removeItem(OAUTH_HANDOFF_KEY);
    return false;
  }
  return true;
}

/**
 * Primary redirect — matches Supabase Site URL / redirect allow list.
 * Server forwards ?code= to /account; client exchanges PKCE and syncs pythh_session.
 */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("pythh_post_login", next);
  }
  persistOAuthStartCookies(next);
  return `${window.location.origin}/api/auth/supabase/callback`;
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
