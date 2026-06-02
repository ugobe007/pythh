import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";

/**
 * /auth/callback — Supabase OAuth redirect target (Google / GitHub).
 * Exchanges the auth code, syncs session to pythh_session cookie via tRPC, then redirects.
 */
export default function AuthCallback() {
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);

  const syncSession = trpc.auth.syncSupabaseSession.useMutation({
    onSuccess: () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") || params.get("redirect") || "/account";
      const safeNext = next.startsWith("/") ? next : "/account";
      navigate(safeNext);
    },
    onError: (err) => {
      setError(err.message || "Could not complete sign-in.");
    },
  });

  useEffect(() => {
    if (!hasValidSupabaseCredentials || !supabase) {
      setError("Sign-in is not configured on this server.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get("error_description") || params.get("error");
        if (oauthError) {
          if (!cancelled) setError(oauthError);
          return;
        }

        const code = params.get("code");
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            if (!cancelled) setError(exchangeErr.message);
            return;
          }
        }

        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr || !session?.access_token) {
          if (!cancelled) setError(sessionErr?.message || "No session after sign-in. Try again.");
          return;
        }

        if (!cancelled) {
          await syncSession.mutateAsync({ access_token: session.access_token });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Sign-in failed.");
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 gap-4"
      style={{ backgroundColor: "oklch(0.08 0.01 264)", fontFamily: "'Inter', sans-serif" }}
    >
      {error ? (
        <>
          <p className="text-sm text-center max-w-sm rounded-lg px-4 py-3"
            style={{ backgroundColor: "oklch(0.45 0.18 27 / 0.12)", color: "oklch(0.75 0.15 27)", border: "1px solid oklch(0.45 0.18 27 / 0.3)" }}>
            {error}
          </p>
          <a href="/login" className="text-sm font-medium" style={{ color: "#22d3ee" }}>Back to sign in</a>
        </>
      ) : (
        <>
          <Loader2 size={28} className="animate-spin" style={{ color: "#22d3ee" }} />
          <p className="text-sm" style={{ color: "oklch(0.65 0.01 264)" }}>Completing sign-in…</p>
        </>
      )}
    </div>
  );
}
