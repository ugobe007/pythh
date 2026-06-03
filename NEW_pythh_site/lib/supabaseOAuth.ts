import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

export type OAuthSyncFn = (input: { access_token: string }) => Promise<unknown>;

/**
 * Finish Supabase OAuth when URL has ?code=… (PKCE) or an existing session.
 * Syncs to pythh_session via tRPC (same path as email login — Set-Cookie on /api/trpc).
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
  if (code) {
    const { data: existing } = await supabase.auth.getSession();
    if (!existing.session?.access_token) {
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeErr) {
        return { ok: false, error: exchangeErr.message };
      }
    }
    const next = params.get("next") || params.get("redirect");
    const path = window.location.pathname;
    const clean = next && next.startsWith("/") ? next : path;
    window.history.replaceState({}, "", clean);
  }

  let session: { access_token: string } | null = null;
  for (let i = 0; i < 15; i++) {
    const { data, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      return { ok: false, error: sessionErr.message };
    }
    if (data.session?.access_token) {
      session = data.session;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!session?.access_token) {
    return { ok: false, error: "No session after Google sign-in. Please try again." };
  }

  await syncSession({ access_token: session.access_token });
  return { ok: true };
}

/** Redirect target — bare /account matches most Supabase allow lists. */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("pythh_post_login", next);
  }
  return `${window.location.origin}/account`;
}

export function readPostLoginPath(): string {
  if (typeof sessionStorage === "undefined") return "/account";
  const stored = sessionStorage.getItem("pythh_post_login");
  sessionStorage.removeItem("pythh_post_login");
  return stored?.startsWith("/") ? stored : "/account";
}
