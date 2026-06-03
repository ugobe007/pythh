import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

export type OAuthSyncFn = (input: { access_token: string }) => Promise<unknown>;

/**
 * Finish OAuth when URL has ?code= — syncs Supabase session to pythh_session via tRPC.
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

  const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !session?.access_token) {
    return { ok: false, error: "No session after Google sign-in." };
  }

  await syncSession({ access_token: session.access_token });
  return { ok: true };
}

/** Must match Supabase redirect allow list (used when OAuth was working on pythh.ai). */
export function buildSupabaseOAuthRedirectUrl(returnPath?: string): string {
  const next = returnPath && returnPath.startsWith("/") ? returnPath : "/account";
  return `${window.location.origin}/account?next=${encodeURIComponent(next)}`;
}

export function readPostLoginPath(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("next") || params.get("redirect");
  if (fromQuery?.startsWith("/")) return fromQuery;
  return "/account";
}
