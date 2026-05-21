import { Helmet } from "react-helmet-async";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

const S = {
  card:   { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label:  { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 6 },
  big:    { fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" },
  sub:    { fontSize: 11, color: "oklch(0.45 0.01 264)", marginTop: 2 },
  th:     { padding: "6px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.4 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)" },
  td:     { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid oklch(0.17 0.01 264)" },
};

const BUCKET_COLOR: Record<string, string> = {
  "unscored": "oklch(0.4 0.01 264)",
  "0–20":  "oklch(0.55 0.2 25)",
  "20–40": "oklch(0.65 0.18 45)",
  "40–60": "oklch(0.7 0.15 80)",
  "60–80": "oklch(0.75 0.17 162)",
  "80–100":"oklch(0.85 0.17 162)",
};

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color }}>{label}</span>
        <span style={{ fontFamily: "monospace", color: "oklch(0.6 0.01 264)" }}>{count.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function GodScoresPage() {
  const { data, isLoading, refetch } = trpc.admin.getGodScoreSummary.useQuery();
  const freeze = trpc.admin.freezeGodScoring.useMutation({ onSuccess: () => refetch() });
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const totalStartups = (data?.distribution ?? []).reduce((acc, b) => acc + Number(b.cnt), 0);
  const isFrozen = data?.runtime?.freeze;

  return (
    <DashboardLayout>
      <Helmet><title>GOD Score Manager — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">GOD Score Manager</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Score distribution, weight versions, runtime controls, and freeze guard.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gap: 16 }}>

          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              ["Avg GOD Score",    data?.stats?.avg ?? "—",   "oklch(0.85 0.17 162)"],
              ["Max Score",        data?.stats?.max ?? "—",   "oklch(0.78 0.15 200)"],
              ["Min Score",        data?.stats?.min ?? "—",   "oklch(0.65 0.2 25)"],
              ["Scored Startups",  Number(data?.stats?.total ?? 0).toLocaleString(), "oklch(0.75 0.15 270)"],
            ].map(([lbl, val, color]) => (
              <div key={lbl as string} style={S.card}>
                <div style={S.label}>{lbl}</div>
                <div style={{ ...S.big, color: color as string }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Distribution + Runtime side-by-side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={S.card}>
              <div style={S.label}>Score Distribution</div>
              {(data?.distribution ?? []).map((b) => (
                <Bar
                  key={b.bucket}
                  label={b.bucket}
                  count={Number(b.cnt)}
                  total={totalStartups}
                  color={BUCKET_COLOR[b.bucket] ?? "oklch(0.6 0.01 264)"}
                />
              ))}
            </div>

            <div style={S.card}>
              <div style={S.label}>Runtime Config</div>
              {data?.runtime ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "oklch(0.6 0.01 264)" }}>Active version</span>
                    <span style={{ fontSize: 12, fontFamily: "monospace" }}>{data.runtime.active_weights_version ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "oklch(0.6 0.01 264)" }}>Override version</span>
                    <span style={{ fontSize: 12, fontFamily: "monospace" }}>{data.runtime.override_weights_version ?? "none"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "oklch(0.6 0.01 264)" }}>Scoring freeze</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: "monospace", padding: "2px 8px", borderRadius: 4,
                      border: `1px solid ${isFrozen ? "oklch(0.65 0.2 25)" : "oklch(0.85 0.17 162)"}`,
                      color: isFrozen ? "oklch(0.65 0.2 25)" : "oklch(0.85 0.17 162)",
                    }}>
                      {isFrozen ? "FROZEN" : "ACTIVE"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "oklch(0.6 0.01 264)" }}>Last updated</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: "oklch(0.5 0.01 264)" }}>
                      {data.runtime.updated_at ? new Date(data.runtime.updated_at as string).toLocaleString() : "—"}
                    </span>
                  </div>

                  <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid oklch(0.2 0.01 264)" }}>
                    {!confirmFreeze ? (
                      <button
                        onClick={() => setConfirmFreeze(true)}
                        style={{
                          width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                          background: "transparent", border: `1px solid ${isFrozen ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)"}`,
                          color: isFrozen ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)",
                        }}
                      >
                        {isFrozen ? "Unfreeze Scoring" : "Freeze Scoring"}
                      </button>
                    ) : (
                      <div>
                        <p style={{ fontSize: 11, color: "oklch(0.55 0.01 264)", marginBottom: 8 }}>
                          {isFrozen ? "Resume automatic scoring?" : "This halts all score recalculation. Confirm?"}
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => { freeze.mutate({ freeze: !isFrozen }); setConfirmFreeze(false); }}
                            disabled={freeze.isPending}
                            style={{ flex: 1, padding: "6px 0", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: "pointer",
                              background: isFrozen ? "oklch(0.85 0.17 162)" : "oklch(0.55 0.2 25)", border: "none",
                              color: isFrozen ? "oklch(0.1 0.01 264)" : "#fff" }}
                          >
                            {freeze.isPending ? "…" : "Confirm"}
                          </button>
                          <button onClick={() => setConfirmFreeze(false)}
                            style={{ flex: 1, padding: "6px 0", fontSize: 11, borderRadius: 5, cursor: "pointer",
                              background: "transparent", border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.5 0.01 264)" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "oklch(0.35 0.01 264)", marginTop: 8 }}>
                  god_runtime_config table not found or empty.
                </p>
              )}
            </div>
          </div>

          {/* Weight version history */}
          <div style={S.card}>
            <div style={S.label}>Weight Version History (last 10)</div>
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Version","Status","Comment","Created"].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.weightHistory ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ ...S.td, color: "oklch(0.35 0.01 264)", textAlign: "center" }}>No weight versions found.</td></tr>
                  )}
                  {(data?.weightHistory ?? []).map((w: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>{w.weights_version}</td>
                      <td style={S.td}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3,
                          border: `1px solid ${w.status === "active" ? "oklch(0.85 0.17 162)" : "oklch(0.3 0.01 264)"}`,
                          color: w.status === "active" ? "oklch(0.85 0.17 162)" : "oklch(0.45 0.01 264)",
                        }}>
                          {w.status ?? "—"}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: "oklch(0.55 0.01 264)" }}>{w.comment ?? "—"}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "oklch(0.4 0.01 264)" }}>
                        {w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Docs link */}
          <div style={{ fontSize: 11, color: "oklch(0.4 0.01 264)", padding: "10px 14px", border: "1px solid oklch(0.18 0.01 264)", borderRadius: 8 }}>
            To recalculate scores: <code style={{ color: "oklch(0.75 0.15 270)" }}>npx ts-node scripts/recalculate-scores.ts</code>
            &nbsp;·&nbsp;
            To update weights: edit <code style={{ color: "oklch(0.75 0.15 270)" }}>server/config/god-score-weights.json</code> and deploy.
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
