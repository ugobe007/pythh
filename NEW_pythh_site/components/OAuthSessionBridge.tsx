import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import {
  clearOAuthHandoff,
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

        sessionStorage.setItem(
          "pythh_oauth_error",
          "Signed in with Google but session did not persist. Try email sign-in.",
        );
        clearOAuthHandoff();
      },
    );
  }, [syncSession, utils.auth.me]);

  return null;
}
