import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

/**
 * /login — Email-based sign-in.
 * Sets the pythh_session cookie via auth.login tRPC mutation then
 * redirects to the account dashboard (or wherever the user came from).
 */
export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setDone(true);
      // Small delay so the user sees the success state before redirect
      setTimeout(() => navigate("/account"), 900);
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
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{
          backgroundColor: "oklch(0.12 0.01 264)",
          border: "1px solid oklch(0.22 0.01 264)",
        }}
      >
        {/* Logo / wordmark */}
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
            Access your investor matches and pipeline dashboard
          </p>
        </div>

        {done ? (
          <div
            className="rounded-xl p-4 text-center text-sm font-medium"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
          >
            ✓ Signed in — redirecting to your account…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name (optional) */}
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
                disabled={loginMutation.isPending}
              />
            </div>

            {/* Email */}
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
                autoFocus
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: "oklch(0.10 0.01 264)",
                  border: "1px solid oklch(0.22 0.01 264)",
                  color: "oklch(0.92 0.005 264)",
                }}
                disabled={loginMutation.isPending}
              />
            </div>

            {error && (
              <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "oklch(0.45 0.18 27 / 0.12)", color: "oklch(0.75 0.15 27)", border: "1px solid oklch(0.45 0.18 27 / 0.3)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending || !email.trim()}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity"
              style={{
                backgroundColor: "oklch(0.696 0.17 162.48)",
                color: "oklch(0.08 0.01 264)",
                opacity: loginMutation.isPending || !email.trim() ? 0.5 : 1,
              }}
            >
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        <p className="text-center text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
          By signing in you agree to our{" "}
          <a href="/support" style={{ color: "oklch(0.55 0.01 264)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
