import { useEffect, useRef } from "react";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import {
  clearOAuthHandoff,
  completeSupabaseOAuthIfNeeded,
  hasOAuthReturnInUrl,
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
    publishOAuthError(result.error || "Google sign-in failed.");
    clearOAuthHandoff();
    return;
  }

  if (result.user) {
    utils.auth.me.setData(result.user);
    clearOAuthHandoff();
    return;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const me = await utils.auth.me.fetch();
    if (me) {
      clearOAuthHandoff();
      return;
    }
    await new Promise((r) => setTimeout(r, 300 + attempt * 200));
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
  const ran = useRef(false);

  const syncSession = trpc.auth.syncSupabaseSession.useMutation();

  useEffect(() => {
    if (!supabase || !hasValidSupabaseCredentials) return;
    if (!hasOAuthReturnInUrl()) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("oauth_handoff") === "1" || params.has("oauth_handoff")) {
        void utils.auth.me.fetch().then((me) => {
          if (me) clearOAuthHandoff();
        });
      }
      return;
    }

    if (ran.current) return;
    ran.current = true;
    markOAuthHandoff();

    void finishOAuth((input) => syncSession.mutateAsync(input), utils).catch((err) => {
      publishOAuthError(trpcMessage(err));
      clearOAuthHandoff();
    });
  }, [syncSession, utils]);

  return null;
}
