import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

/** Production site URL — must match Supabase redirect allow list exactly. */
export function getCanonicalSiteOrigin(): string {
  if (typeof window === "undefined") return "https://pythh.ai";
  const host = window.location.hostname.toLowerCase();
  if (host === "pythh.ai" || host === "www.pythh.ai") return "https://pythh.ai";
  if (host.endsWith(".fly.dev")) return window.location.origin;
  return window.location.origin;
}

function supabaseProjectRef(): string | null {
  const url =
    (typeof window !== "undefined" && window.__PYTHH_RUNTIME__?.supabaseUrl) ||
    (import.meta.env.VITE_SUPABASE_URL as string) ||
    "";
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

/** Store PKCE verifier in a cookie so the server callback can exchange the code. */
export function persistPkceVerifierCookie(): void {
  const ref = supabaseProjectRef();
  if (!ref || typeof document === "undefined") return;
  const verifier = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
  if (!verifier) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

/** OAuth return URL — server exchanges code and sets pythh_session. */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  return `${getCanonicalSiteOrigin()}/api/auth/supabase/callback?next=${encodeURIComponent(next)}`;
}

/** Sync Supabase access token → pythh_session cookie (REST fallback). */
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

/**
 * Legacy: finish OAuth on /account?code=… when redirect URL still points here.
 */
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

  persistPkceVerifierCookie();

  const { data: existing } = await supabase.auth.getSession();
  if (!existing.session) {
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeErr) {
      return { ok: false, error: exchangeErr.message };
    }
  }

  const next = params.get("next") || params.get("redirect");
  const clean = next && next.startsWith("/") ? next : window.location.pathname;
  window.history.replaceState({}, "", clean);

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    return { ok: false, error: "No session after OAuth. Try signing in again." };
  }

  return syncSupabaseAccessTokenToServer(session.access_token);
}
