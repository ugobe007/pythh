import { Helmet } from "react-helmet-async";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
  th: { padding: "6px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.4 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)" },
  td: { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid oklch(0.17 0.01 264)" },
};

function ConfidenceBadge({ val }: { val: number }) {
  const pct = Math.round((val ?? 0) * 100);
  const color = pct >= 70 ? "oklch(0.85 0.17 162)" : pct >= 40 ? "oklch(0.7 0.15 80)" : "oklch(0.65 0.2 25)";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", padding: "2px 8px", borderRadius: 4,
      border: `1px solid ${color}`, color }}>{pct}%</span>
  );
}

function WeightDiff({ current, recommended }: { current: any; recommended: any }) {
  const [open, setOpen] = useState(false);
  if (!current || !recommended) return null;
  const keys = Object.keys(recommended);
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "oklch(0.6 0.01 264)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Weight diff
      </button>
      {open && (
        <div style={{ marginTop: 8, background: "oklch(0.12 0.01 264)", borderRadius: 6, padding: "10px 12px" }}>
          {keys.map((k) => {
            const cur = Number(current[k] ?? 0);
            const rec = Number(recommended[k] ?? 0);
            const delta = rec - cur;
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: "oklch(0.5 0.01 264)", fontFamily: "monospace" }}>{k}</span>
                <span>
                  <span style={{ color: "oklch(0.45 0.01 264)" }}>{cur.toFixed(3)}</span>
                  <span style={{ color: "oklch(0.3 0.01 264)", margin: "0 4px" }}>→</span>
                  <span style={{ color: delta > 0 ? "oklch(0.85 0.17 162)" : delta < 0 ? "oklch(0.65 0.2 25)" : "oklch(0.5 0.01 264)" }}>
                    {delta > 0 ? "+" : ""}{delta.toFixed(3)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec, onAction }: { rec: any; onAction: (id: string, action: "approve" | "reject", reason?: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div style={{ background: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{rec.recommendation_type ?? "weight_update"}</div>
          <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 2 }}>
            v{rec.weights_version} · {rec.created_at ? new Date(rec.created_at).toLocaleDateString() : "—"}
          </div>
        </div>
        <ConfidenceBadge val={rec.confidence ?? 0} />
      </div>

      {Array.isArray(rec.reasoning) && rec.reasoning.length > 0 && (
        <ul style={{ margin: "0 0 10px", padding: "0 0 0 16px", fontSize: 11, color: "oklch(0.55 0.01 264)", lineHeight: 1.7 }}>
          {rec.reasoning.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}
        </ul>
      )}

      {rec.expected_improvement && (
        <div style={{ fontSize: 11, color: "oklch(0.65 0.15 270)", marginBottom: 8 }}>
          Expected improvement: {rec.expected_improvement}
        </div>
      )}

      <WeightDiff current={rec.current_weights} recommended={rec.recommended_weights} />

      {!rejecting ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => onAction(rec.id, "approve")}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid oklch(0.85 0.17 162)", color: "oklch(0.85 0.17 162)" }}>
            <CheckCircle size={13} /> Approve
          </button>
          <button onClick={() => setRejecting(true)}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 0", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer", background: "transparent", border: "1px solid oklch(0.55 0.2 25)", color: "oklch(0.65 0.2 25)" }}>
            <XCircle size={13} /> Reject
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          <input
            placeholder="Rejection reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: "100%", padding: "6px 10px", background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 6, color: "oklch(0.85 0.01 264)", fontSize: 12, marginBottom: 8, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onAction(rec.id, "reject", reason); setRejecting(false); }}
              style={{ flex: 1, padding: "6px 0", fontSize: 12, borderRadius: 5, cursor: "pointer", background: "oklch(0.55 0.2 25)", border: "none", color: "#fff", fontWeight: 600 }}>
              Confirm Reject
            </button>
            <button onClick={() => setRejecting(false)}
              style={{ flex: 1, padding: "6px 0", fontSize: 12, borderRadius: 5, cursor: "pointer", background: "transparent", border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.5 0.01 264)" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const GATE_COLOR: Record<string, string> = {
  pass: "oklch(0.85 0.17 162)",
  fail: "oklch(0.65 0.2 25)",
  review: "oklch(0.7 0.15 80)",
};

export default function MlAgentPage() {
  const { data, isLoading, refetch } = trpc.admin.getMlRecommendations.useQuery(undefined, { retry: false });
  const review = trpc.admin.reviewMlRecommendation.useMutation({ onSuccess: () => refetch() });

  function handleAction(id: string, action: "approve" | "reject", reason?: string) {
    review.mutate({ id, action, reason });
  }

  return (
    <DashboardLayout>
      <Helmet><title>ML Agent — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">ML Agent</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Review ML weight recommendations, approve or reject them, and monitor entity gate stats.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gap: 16 }}>

          {/* Entity gate distribution */}
          <div style={S.card}>
            <div style={S.label}>Entity Gate Distribution</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {(data?.entityGateStats ?? []).map((g: any) => (
                <div key={g.gate} style={{ textAlign: "center", minWidth: 80 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: GATE_COLOR[g.gate] ?? "oklch(0.6 0.01 264)" }}>
                    {Number(g.cnt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 2 }}>{g.gate ?? "null"}</div>
                </div>
              ))}
              {(data?.entityGateStats ?? []).length === 0 && (
                <span style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No data</span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Pending recommendations */}
            <div style={S.card}>
              <div style={S.label}>Pending Recommendations ({(data?.pending ?? []).length})</div>
              {(data?.pending ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: "oklch(0.4 0.01 264)" }}>No pending recommendations. The ML agent has not proposed any updates.</p>
              )}
              {(data?.pending ?? []).map((rec: any) => (
                <RecommendationCard key={rec.id} rec={rec} onAction={handleAction} />
              ))}
            </div>

            {/* Recent reviewed */}
            <div style={S.card}>
              <div style={S.label}>Recently Reviewed</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Type","Confidence","Status","Reviewed"].map((h) => <th key={h} style={S.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "oklch(0.35 0.01 264)" }}>No reviewed recommendations yet.</td></tr>
                  )}
                  {(data?.recent ?? []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...S.td, fontSize: 11 }}>{r.recommendation_type ?? "—"}</td>
                      <td style={S.td}><ConfidenceBadge val={r.confidence ?? 0} /></td>
                      <td style={S.td}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3,
                          border: `1px solid ${r.status === "approved" ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)"}`,
                          color: r.status === "approved" ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)",
                        }}>{r.status}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: 10, color: "oklch(0.4 0.01 264)" }}>
                        {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cron info */}
          <div style={{ fontSize: 11, color: "oklch(0.4 0.01 264)", padding: "10px 14px", border: "1px solid oklch(0.18 0.01 264)", borderRadius: 8 }}>
            ML training cron: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/cron/ml-training-scheduler.js</code>
            &nbsp;·&nbsp;
            Training service: <code style={{ color: "oklch(0.75 0.15 270)" }}>server/services/mlTrainingServiceV2.ts</code>
            &nbsp;·&nbsp;
            Entity gate training data: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/ml/export-entity-gate-training-csv.js</code>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
