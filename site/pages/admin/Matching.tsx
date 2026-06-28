import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
};

export default function MatchingAdminPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl("/admin/matching");
    }
  }, [authLoading, isAuthenticated]);

  const { data, isLoading, isError, error, refetch } = trpc.admin.getMatchSummary.useQuery(undefined, {
    enabled: isAdmin,
    retry: 1,
  });

  return (
    <DashboardLayout>
      <Helmet><title>Matching Engine — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">Matching Engine</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Match queue stats from <code style={{ color: "oklch(0.75 0.15 270)" }}>startup_investor_matches</code>.
          {" "}Live pairings on <Link href="/matches" style={{ color: "oklch(0.85 0.17 162)" }}>/matches</Link>.
        </p>
      </div>

      {authLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Checking session…
        </div>
      )}

      {!authLoading && isAuthenticated && !isAdmin && (
        <p className="text-xs" style={{ color: "oklch(0.65 0.18 25)" }}>
          Admin access required. Sign in with an owner account.
        </p>
      )}

      {isError && (
        <div className="text-xs mb-4" style={{ color: "oklch(0.65 0.18 25)" }}>
          <p>Failed to load match stats{error?.message ? `: ${error.message}` : ""}.</p>
          <button
            type="button"
            className="mt-2 underline"
            style={{ color: "oklch(0.85 0.17 162)" }}
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {isAdmin && isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading match data…
        </div>
      )}

      {isAdmin && !isLoading && data && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              ["Total Matches", data.total, "oklch(0.75 0.15 270)"],
              ["High Score (≥75)", data.highScore, "oklch(0.85 0.17 162)"],
              ["Strong Fit (≥85)", data.strongFit, "oklch(0.78 0.15 200)"],
              ["Last 7 Days", data.recent7d, "oklch(0.65 0.15 80)"],
              ["Avg Match Score", data.avgScore ?? "—", "oklch(0.85 0.17 162)"],
            ].map(([lbl, val, color]) => (
              <div key={lbl as string} style={S.card}>
                <div style={S.label}>{lbl}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: color as string }}>{String(val)}</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={S.label}>Score distribution (0–100)</div>
            {(data.buckets ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: "oklch(0.45 0.01 264)" }}>No rows in startup_investor_matches yet.</p>
            ) : (
              (data.buckets ?? []).map((b: { bucket: string; cnt: string }) => (
                <div key={b.bucket} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid oklch(0.18 0.01 264)" }}>
                  <span style={{ color: "oklch(0.6 0.01 264)" }}>{b.bucket}</span>
                  <span style={{ fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>{Number(b.cnt).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>

          {Number(data.total) === 0 && (
            <p style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>
              Run the match autopilot to populate:{" "}
              <code style={{ color: "oklch(0.75 0.15 270)" }}>node scripts/core/hot-match-autopilot.js</code>
            </p>
          )}

          {Number(data.total) > 0 && (
            <p style={{ fontSize: 11, color: "oklch(0.4 0.01 264)" }}>
              To regenerate matches for a startup: use the pipeline on submit or run{" "}
              <code style={{ color: "oklch(0.75 0.15 270)" }}>node scripts/core/hot-match-autopilot.js</code>
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
