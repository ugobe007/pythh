import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import { completeSupabaseOAuthIfNeeded } from "@/lib/supabaseOAuth";

/**
 * Completes OAuth only when the URL has ?code= (Google returns to /account?code=…).
 * Server callback path sets pythh_session directly — no bridge needed.
 */
export function OAuthSessionBridge() {
  const utils = trpc.useUtils();
  const ran = useRef(false);

  const syncSession = trpc.auth.syncSupabaseSession.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
    },
  });

  useEffect(() => {
    if (!supabase || !hasValidSupabaseCredentials) return;
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code || ran.current) return;
    ran.current = true;

    void completeSupabaseOAuthIfNeeded((input) => syncSession.mutateAsync(input)).then((result) => {
      if (!result.ok && result.error) {
        sessionStorage.setItem("pythh_oauth_error", result.error);
      }
    });
  }, [syncSession, utils.auth.me]);

  return null;
}
