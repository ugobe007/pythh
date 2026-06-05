import { useEffect, useRef } from "react";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import {
  clearOAuthHandoff,
  completeSupabaseOAuthIfNeeded,
  hasOAuthReturnInUrl,
  isOAuthHandoffActive,
  markOAuthHandoff,
  publishOAuthError,
} from "@/lib/supabaseOAuth";

function trpcMessage(err: unknown): string {
  if (err instanceof TRPCClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Could not complete Google sign-in.";
}

async function finishOAuth(
  syncSession: (input: { access_token: string }) => Promise<{ user: { id: number } }>,
  utils: ReturnType<typeof trpc.useUtils>,
): Promise<void> {
  const result = await completeSupabaseOAuthIfNeeded((input) => syncSession(input));
  if (!result.ok) {
    if (result.error) {
      publishOAuthError(result.error);
      clearOAuthHandoff();
    }
    return;
  }

  if (result.user) {
    utils.auth.me.setData(result.user);
    clearOAuthHandoff();
    return;
  }

  // Cookie is already set by the sync above — first fetch normally wins.
  for (let attempt = 0; attempt < 8; attempt++) {
    const me = await utils.auth.me.fetch();
    if (me) {
      clearOAuthHandoff();
      return;
    }
    await new Promise((r) => setTimeout(r, 250 + attempt * 150));
  }

  publishOAuthError(
    "Signed in with Google but session did not persist. Try email sign-in.",
  );
  clearOAuthHandoff();
}

/**
 * Completes OAuth when URL has #access_token=… (implicit) or ?code=… (PKCE).
 */
export function OAuthSessionBridge() {
  const utils = trpc.useUtils();
  const inflight = useRef(false);
  const syncSession = trpc.auth.syncSupabaseSession.useMutation();

  useEffect(() => {
    if (!supabase || !hasValidSupabaseCredentials) return;

    const shouldRun =
      hasOAuthReturnInUrl() ||
      isOAuthHandoffActive() ||
      new URLSearchParams(window.location.search).has("oauth_handoff");

    if (!shouldRun) return;
    if (inflight.current) return;
    inflight.current = true;
    markOAuthHandoff();

    const sync = async (input: { access_token: string }) => {
      const result = await syncSession.mutateAsync(input);
      return { user: result.user };
    };

    void finishOAuth(sync, utils)
      .catch((err) => {
        publishOAuthError(trpcMessage(err));
        clearOAuthHandoff();
      })
      .finally(() => {
        inflight.current = false;
      });
  }, [syncSession, utils]);

  return null;
}
