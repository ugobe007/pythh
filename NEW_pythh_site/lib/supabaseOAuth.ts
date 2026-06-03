import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

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

/** Must run after signInWithOAuth — PKCE verifier is created at that moment. */
export function persistPkceVerifierCookie(): void {
  if (typeof document === "undefined") return;
  const ref = supabaseProjectRef();
  if (!ref) return;
  const verifier = localStorage.getItem(`sb-${ref}-auth-token-code-verifier`);
  if (!verifier) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `sb_pkce=${encodeURIComponent(verifier)}; Path=/; Max-Age=600; SameSite=Lax${secure}${cookieDomainAttr()}`;
}

/**
 * Server callback exchanges code + sets pythh_session (same reliable path as email login).
 * Client /account?code= is still handled by OAuthSessionBridge as fallback.
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
  if (typeof sessionStorage === "undefined") return "/account";
  const stored = sessionStorage.getItem("pythh_post_login");
  sessionStorage.removeItem("pythh_post_login");
  return stored?.startsWith("/") ? stored : "/account";
}

export function markOAuthInProgress(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem("pythh_oauth_code_seen", "1");
}
