import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
};

export default function MatchingAdminPage() {
  const { data, isLoading, isError } = trpc.admin.getMatchSummary.useQuery(undefined, { retry: false });

  return (
    <DashboardLayout>
      <Helmet><title>Matching Engine — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">Matching Engine</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Match queue stats. View live matches on <Link href="/matches" style={{ color: "oklch(0.85 0.17 162)" }}>/matches</Link>.
        </p>
      </div>

      {isError && (
        <p className="text-xs mb-4" style={{ color: "oklch(0.65 0.18 25)" }}>
          Failed to load match stats. Sign in with an admin account and refresh.
        </p>
      )}

      {isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && data && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[
              ["Total Matches", data.total, "oklch(0.75 0.15 270)"],
              ["High Score (≥0.75)", data.highScore, "oklch(0.85 0.17 162)"],
              ["Strong Fit (≥0.85)", data.strongFit, "oklch(0.78 0.15 200)"],
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
            <div style={S.label}>Score distribution</div>
            {(data.buckets ?? []).map((b: { bucket: string; cnt: string }) => (
              <div key={b.bucket} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid oklch(0.18 0.01 264)" }}>
                <span style={{ color: "oklch(0.6 0.01 264)" }}>{b.bucket}</span>
                <span style={{ fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>{Number(b.cnt).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: "oklch(0.4 0.01 264)" }}>
            To regenerate matches for a startup: use the pipeline on submit or run{" "}
            <code style={{ color: "oklch(0.75 0.15 270)" }}>node scripts/core/hot-match-autopilot.js</code>
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
