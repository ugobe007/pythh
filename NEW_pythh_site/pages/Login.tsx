import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Github, Loader2 } from "lucide-react";
import { supabase, hasValidSupabaseCredentials } from "@/lib/supabase";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  buildSupabaseOAuthRedirectUrl,
  isOAuthHandoffActive,
  markOAuthHandoff,
  persistPkceVerifierForOAuth,
} from "@/lib/supabaseOAuth";

function getPostLoginPath(): string {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || params.get("next");
  if (redirect && redirect.startsWith("/")) return redirect;
  return "/account";
}

/**
 * /login — Google / GitHub via Supabase OAuth, with optional email fallback.
 */
export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  useEffect(() => {
    if (isOAuthHandoffActive()) {
      window.location.replace("/account");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauth_error");
    if (err) {
      setError(decodeURIComponent(err));
      window.history.replaceState({}, "", "/login");
    }
    if (params.has("code") || params.has("error") || params.has("error_description")) {
      window.location.replace(`/account${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") || params.has("oauth_error")) return;
    navigate(getPostLoginPath());
  }, [authLoading, isAuthenticated, navigate]);

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const finishingOAuth =
    params.has("code") || authLoading || isOAuthHandoffActive();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate(getPostLoginPath()), 900);
    },
    onError: (err) => {
      setError(err.message || "Sign-in failed. Please try again.");
    },
  });

  const handleSocialLogin = async (provider: "google" | "github") => {
    if (!supabase || !hasValidSupabaseCredentials) {
      setError("OAuth sign-in is not configured. Use email sign-in or contact support.");
      return;
    }
    setSocialLoading(provider);
    setError(null);
    try {
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: buildSupabaseOAuthRedirectUrl(getPostLoginPath()),
          skipBrowserRedirect: true,
        },
      });
      if (oauthErr) throw oauthErr;
      if (!data?.url) throw new Error("OAuth redirect URL missing");
      markOAuthHandoff();
      persistPkceVerifierForOAuth();
      await new Promise((r) => setTimeout(r, 100));
      persistPkceVerifierForOAuth();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to sign in with ${provider}`);
      setSocialLoading(null);
    }
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError("Email is required."); return; }
    loginMutation.mutate({ email: trimmed, name: name.trim() || undefined });
  }

  const oauthDisabled = !hasValidSupabaseCredentials;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.08 0.01 264)", fontFamily: "'Inter', sans-serif" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{
          backgroundColor: "oklch(0.12 0.01 264)",
          border: "1px solid oklch(0.22 0.01 264)",
        }}
      >
        <div className="flex flex-col items-center gap-2 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-lg"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
          >
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight" style={{ color: "oklch(0.96 0.005 264)" }}>
            Sign in to PYTHH
          </h1>
          <p className="text-sm text-center" style={{ color: "oklch(0.55 0.01 264)" }}>
            Continue with Google or GitHub — same as the classic pythh.ai login
          </p>
        </div>

        {finishingOAuth && !done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={24} className="animate-spin" style={{ color: "#22d3ee" }} />
            <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>
              Completing sign-in…
            </p>
          </div>
        ) : done ? (
          <div
            className="rounded-xl p-4 text-center text-sm font-medium"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
          >
            ✓ Signed in — redirecting…
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleSocialLogin("google")}
                disabled={!!socialLoading || oauthDisabled}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-opacity border disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: "oklch(0.88 0.005 264)", backgroundColor: "oklch(0.10 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
              >
                {socialLoading === "google" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#EA4335" d="M5.27 9.75A6.46 6.46 0 0 1 12 5.5c1.7 0 3.14.63 4.28 1.65l3.18-3.18C17.4 2.09 14.89 1 12 1 7.7 1 4.05 3.5 2.25 7.1l3.02 2.65z" />
                    <path fill="#34A853" d="M16.04 18.01A7.4 7.4 0 0 1 12 19.5a6.46 6.46 0 0 1-6.73-4.75L2.25 17.4C4.05 21 7.7 23.5 12 23.5c2.7 0 5.2-.89 7.17-2.53l-3.13-2.96z" />
                    <path fill="#4A90E2" d="M19.17 20.97C21.45 18.93 23 15.7 23 12.23c0-.79-.07-1.53-.2-2.23H12v4.5h6.18c-.3 1.45-1.1 2.64-2.27 3.41l3.26 2.06z" />
                    <path fill="#FBBC05" d="M5.27 14.75A6.53 6.53 0 0 1 5.27 9.75L2.25 7.1a10.5 10.5 0 0 0 0 10.3l3.02-2.65z" />
                  </svg>
                )}
                Continue with Google
              </button>

              <button
                type="button"
                onClick={() => handleSocialLogin("github")}
                disabled={!!socialLoading || oauthDisabled}
                className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-opacity border disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: "oklch(0.88 0.005 264)", backgroundColor: "oklch(0.10 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}
              >
                {socialLoading === "github" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Github size={18} />
                )}
                Continue with GitHub
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
              <span className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>or email</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "oklch(0.22 0.01 264)" }} />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.01 264)" }}>
                  Your name <span style={{ color: "oklch(0.45 0.01 264)" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "oklch(0.10 0.01 264)",
                    border: "1px solid oklch(0.22 0.01 264)",
                    color: "oklch(0.92 0.005 264)",
                  }}
                  disabled={loginMutation.isPending || !!socialLoading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.01 264)" }}>
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@startup.com"
                  required
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: "oklch(0.10 0.01 264)",
                    border: "1px solid oklch(0.22 0.01 264)",
                    color: "oklch(0.92 0.005 264)",
                  }}
                  disabled={loginMutation.isPending || !!socialLoading}
                />
              </div>

              {error && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "oklch(0.45 0.18 27 / 0.12)", color: "oklch(0.75 0.15 27)", border: "1px solid oklch(0.45 0.18 27 / 0.3)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending || !email.trim() || !!socialLoading}
                className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity"
                style={{
                  backgroundColor: "oklch(0.696 0.17 162.48)",
                  color: "oklch(0.08 0.01 264)",
                  opacity: loginMutation.isPending || !email.trim() || !!socialLoading ? 0.5 : 1,
                }}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in with email"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
          By signing in you agree to our{" "}
          <a href="/support" style={{ color: "oklch(0.55 0.01 264)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
