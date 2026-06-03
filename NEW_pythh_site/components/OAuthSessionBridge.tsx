import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

/**
 * Keeps Supabase OAuth and pythh_session in sync app-wide.
 * Runs on any route Google returns to (/account, /login, /auth/callback).
 */
export function OAuthSessionBridge() {
  const utils = trpc.useUtils();
  const syncing = useRef(false);

  const syncSession = trpc.auth.syncSupabaseSession.useMutation({
    onSuccess: () => {
      void utils.auth.me.invalidate();
    },
  });

  useEffect(() => {
    if (!supabase || !hasValidSupabaseCredentials) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      sessionStorage.setItem("pythh_oauth_code_seen", "1");
    }

    const exchangeCodeFromUrl = async () => {
      if (!code) return;
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session?.access_token) return;

      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeErr) {
        console.error("[oauth] code exchange:", exchangeErr.message);
        return;
      }

      const path = window.location.pathname;
      window.history.replaceState({}, "", path);
    };

    const pushTokenToServer = async (accessToken: string) => {
      if (syncing.current) return;
      syncing.current = true;
      try {
        await syncSession.mutateAsync({ access_token: accessToken });
        sessionStorage.removeItem("pythh_oauth_code_seen");
      } catch (err) {
        console.error("[oauth] syncSupabaseSession:", err);
      } finally {
        syncing.current = false;
      }
    };

    void exchangeCodeFromUrl().then(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await pushTokenToServer(session.access_token);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.access_token) {
        void pushTokenToServer(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return null;
}
