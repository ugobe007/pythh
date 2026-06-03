import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

const OAUTH_NEXT_COOKIE = "pythh_oauth_next";

/** Production site URL — must match Supabase redirect allow list exactly. */
export function getCanonicalSiteOrigin(): string {
  if (typeof window === "undefined") return "https://pythh.ai";
  const host = window.location.hostname.toLowerCase();
  if (host === "pythh.ai" || host === "www.pythh.ai") return "https://pythh.ai";
  if (host.endsWith(".fly.dev")) return window.location.origin;
  return window.location.origin;
}

function cookieDomainAttr(): string {
  if (typeof window === "undefined") return "";
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

/** Store PKCE verifier + post-login path before leaving for Google/GitHub. */
export function persistOAuthStartCookies(returnPath: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = cookieDomainAttr();
  const next = returnPath.startsWith("/") ? returnPath : "/account";
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}${domain}`;

  const ref = supabaseProjectRef();
  if (!ref) return;
  const verifier = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
  if (!verifier) return;
  document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}${domain}`;
}

export function readOAuthNextPath(): string {
  if (typeof document === "undefined") return "/account";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("next") || params.get("redirect");
  if (fromQuery?.startsWith("/")) return fromQuery;

  const match = document.cookie.match(/(?:^|;\s*)pythh_oauth_next=([^;]*)/);
  if (match?.[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith("/")) return decoded;
    } catch {
      /* ignore */
    }
  }
  return "/account";
}

/**
 * Must match Supabase redirect URL allow list exactly (no query string).
 * Use https://pythh.ai/account in Supabase → URL configuration.
 */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  persistOAuthStartCookies(next);
  return `${getCanonicalSiteOrigin()}/account`;
}

/** Sync Supabase access token → pythh_session cookie (REST). */
export async function syncSupabaseAccessTokenToServer(
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/auth/sync-supabase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ access_token: accessToken }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean };
  if (!res.ok) {
    return { ok: false, error: body.error || `Sign-in failed (${res.status})` };
  }
  return { ok: !!body.success };
}

/** Finish OAuth on /account?code=… after Google/GitHub redirect. */
export async function completeSupabaseOAuthIfNeeded(): Promise<{ ok: boolean; error?: string }> {
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

  const { data: existing } = await supabase.auth.getSession();
  if (!existing.session) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      return { ok: false, error: exchangeErr.message };
    }
  }

  const clean = readOAuthNextPath();
  window.history.replaceState({}, "", clean);
  document.cookie = `${OAUTH_NEXT_COOKIE}=; Path=/; Max-Age=0${cookieDomainAttr()}`;

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    return { ok: false, error: "No session after OAuth. Try signing in again." };
  }

  return syncSupabaseAccessTokenToServer(session.access_token);
}

/** User-facing text for oauth_error query param on /login. */
export function formatOAuthLoginError(code: string): string {
  if (code === "missing_code") {
    return "Google sign-in did not return an authorization code. In Supabase → Authentication → URL configuration, set Redirect URLs to include exactly https://pythh.ai/account (and use https://pythh.ai, not www).";
  }
  return decodeURIComponent(code);
}
