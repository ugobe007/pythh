import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import {
  completeSupabaseOAuthIfNeeded,
  markOAuthHandoff,
} from "@/lib/supabaseOAuth";

/**
 * Completes OAuth when the URL has ?code= (after server forwards from callback).
 */
export function OAuthSessionBridge() {
  const utils = trpc.useUtils();
  const ran = useRef(false);

  const syncSession = trpc.auth.syncSupabaseSession.useMutation();

  useEffect(() => {
    if (!supabase || !hasValidSupabaseCredentials) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code || ran.current) return;
    ran.current = true;
    markOAuthHandoff();

    void completeSupabaseOAuthIfNeeded((input) => syncSession.mutateAsync(input)).then(
      async (result) => {
        if (!result.ok) {
          if (result.error) {
            sessionStorage.setItem("pythh_oauth_error", result.error);
          }
          sessionStorage.removeItem("pythh_oauth_handoff");
          return;
        }

        // Cookie is set on sync response — refetch auth.me (do not invalidate first).
        for (let attempt = 0; attempt < 8; attempt++) {
          const me = await utils.auth.me.fetch();
          if (me) return;
          await new Promise((r) => setTimeout(r, 250 + attempt * 150));
        }
        sessionStorage.setItem(
          "pythh_oauth_error",
          "Signed in with Google but session did not persist. Try email sign-in.",
        );
        sessionStorage.removeItem("pythh_oauth_handoff");
      },
    );
  }, [syncSession, utils.auth.me]);

  return null;
}
