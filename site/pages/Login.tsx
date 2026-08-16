import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import FounderSocialAuth from "@/components/FounderSocialAuth";
import { rewriteOAuthClientIdError } from "@/lib/oauthProviders";
import {
  clearStaleOAuthKeys,
  isOAuthHandoffActive,
} from "@/lib/supabaseOAuth";

function getPostLoginPath(): string {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect") || params.get("next");
  if (redirect && redirect.startsWith("/")) return redirect;
  return "/account";
}

/**
 * /login — Google / GitHub / LinkedIn via Supabase OAuth, with optional email fallback.
 */
export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    clearStaleOAuthKeys();
  }, []);

  useEffect(() => {
    if (isOAuthHandoffActive()) {
      window.location.replace("/account");
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const err = params.get("oauth_error");
    if (err) {
      const decoded = decodeURIComponent(err);
      setError(rewriteOAuthClientIdError(decoded) || decoded);
      window.history.replaceState({}, "", "/login");
    }
    const hash = window.location.hash || "";
    if (
      params.has("code") ||
      params.has("error") ||
      params.has("error_description") ||
      hash.includes("access_token=")
    ) {
      window.location.replace(`/account${window.location.search}${hash}`);
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
  const secondSearch = params.get("reason") === "second_search";
  const finishingOAuth =
    params.has("code") ||
    (typeof window !== "undefined" && window.location.hash.includes("access_token=")) ||
    isOAuthHandoffActive();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setDone(true);
      setTimeout(() => navigate(getPostLoginPath()), 900);
    },
    onError: (err) => {
      setError(err.message || "Sign-in failed. Please try again.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError("Email is required."); return; }
    loginMutation.mutate({ email: trimmed, name: name.trim() || undefined });
  }

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
            {secondSearch
              ? "Sign in to run another startup search — your first preview was free."
              : "Continue with Google or GitHub — same as the classic pythh.ai login"}
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
            <FounderSocialAuth
              returnPath={getPostLoginPath()}
              disabled={loginMutation.isPending}
              onError={setError}
              onStart={() => {
                setError(null);
                setSocialLoading(true);
              }}
            />

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
                  disabled={loginMutation.isPending || socialLoading}
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
                  disabled={loginMutation.isPending || socialLoading}
                />
              </div>

              {error && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "oklch(0.45 0.18 27 / 0.12)", color: "oklch(0.75 0.15 27)", border: "1px solid oklch(0.45 0.18 27 / 0.3)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending || !email.trim() || socialLoading}
                className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity"
                style={{
                  backgroundColor: "oklch(0.696 0.17 162.48)",
                  color: "oklch(0.08 0.01 264)",
                  opacity: loginMutation.isPending || !email.trim() || socialLoading ? 0.5 : 1,
                }}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in with email"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
          By signing in you agree to our{" "}
          <a href="/terms" style={{ color: "oklch(0.55 0.01 264)" }}>Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" style={{ color: "oklch(0.55 0.01 264)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
