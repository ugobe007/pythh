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

/** Store PKCE verifier in a cookie (call after signInWithOAuth creates the verifier). */
export function persistPkceVerifierCookie(): void {
  if (typeof document === "undefined") return;
  const ref = supabaseProjectRef();
  if (!ref) return;
  const verifier = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
  if (!verifier) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
}

/** Store post-login path before leaving for Google/GitHub. */
export function persistOAuthStartCookies(returnPath: string): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const domain = cookieDomainAttr();
  const next = returnPath.startsWith("/") ? returnPath : "/account";
  document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}${domain}`;
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
  // Server exchanges code + sets pythh_session before redirecting to /account (most reliable).
  return `${getCanonicalSiteOrigin()}/api/auth/supabase/callback`;
}

export const OAUTH_PENDING_KEY = "pythh_oauth_pending";

export function markOAuthPending(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
}

export function clearOAuthPending(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(OAUTH_PENDING_KEY);
}

export function isOAuthPending(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
  if (!raw) return false;
  const ts = Number(raw);
  if (!Number.isFinite(ts) || Date.now() - ts > 10 * 60 * 1000) {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
    return false;
  }
  return true;
}

/** Allowed Supabase redirect targets (add all in dashboard). */
export const SUPABASE_REDIRECT_URLS = [
  "https://pythh.ai/account",
  "https://pythh.ai/api/auth/supabase/callback",
] as const;

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

  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "",
  );
  const code = params.get("code") || hashParams.get("code");
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
    return [
      "Google sign-in did not return an authorization code.",
      "In Supabase → Authentication → URL configuration:",
      "• Site URL: https://pythh.ai (not www, and not the /api/.../callback path)",
      "• Redirect URLs (one per line): https://pythh.ai/account and https://pythh.ai/api/auth/supabase/callback",
      "Save, wait a minute, then try again in a private window at https://pythh.ai/login",
    ].join(" ");
  }
  return decodeURIComponent(code);
}
