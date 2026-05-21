import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
  th: { padding: "6px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.4 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)" },
  td: { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid oklch(0.17 0.01 264)" },
};

const DIMS = [
  { key: "founder_language_shift", label: "Founder Language",  max: 2.0, color: "oklch(0.75 0.15 270)" },
  { key: "investor_receptivity",   label: "Investor Receptivity", max: 2.5, color: "oklch(0.78 0.15 200)" },
  { key: "news_momentum",          label: "News Momentum",     max: 1.5, color: "oklch(0.85 0.17 162)" },
  { key: "capital_convergence",    label: "Capital Convergence", max: 2.0, color: "oklch(0.7 0.15 80)" },
  { key: "execution_velocity",     label: "Execution Velocity", max: 2.0, color: "oklch(0.65 0.18 300)" },
];

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 5, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "monospace", color }}>{Number(value).toFixed(2)}</span>
    </div>
  );
}

export default function SignalScoresPage() {
  const { data, isLoading } = trpc.admin.getSignalSummary.useQuery();

  return (
    <DashboardLayout>
      <Helmet><title>Signal Scores — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">Signal Score Dashboard</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          5-dimension signal scores (0–10) for startups in the pipeline.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Summary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={S.card}>
              <div style={S.label}>Avg Signal Score (0–10)</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>
                {data?.summary?.avg_total ?? "—"}
              </div>
              <div style={{ fontSize: 11, color: "oklch(0.45 0.01 264)", marginTop: 4 }}>out of 10 max</div>
            </div>
            <div style={S.card}>
              <div style={S.label}>Startups Scored</div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>
                {Number(data?.summary?.count ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={{ ...S.card, background: "oklch(0.13 0.01 264)" }}>
              <div style={S.label}>Signal Dimensions</div>
              {DIMS.map((d) => (
                <div key={d.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "oklch(0.55 0.01 264)" }}>{d.label}</span>
                  <span style={{ fontSize: 10, color: d.color, fontFamily: "monospace" }}>max {d.max}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top startups by signal */}
          <div style={S.card}>
            <div style={S.label}>Top 15 by Signal Score</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Company</th>
                    <th style={S.th}>Total</th>
                    {DIMS.map((d) => <th key={d.key} style={S.th}>{d.label}</th>)}
                    <th style={S.th}>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topStartups ?? []).length === 0 && (
                    <tr><td colSpan={8} style={{ ...S.td, textAlign: "center", color: "oklch(0.35 0.01 264)" }}>No signal scores yet.</td></tr>
                  )}
                  {(data?.topStartups ?? []).map((s: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{s.company_name}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>
                        {Number(s.signals_total ?? 0).toFixed(2)}
                      </td>
                      {DIMS.map((d) => (
                        <td key={d.key} style={S.td}>
                          <MiniBar value={Number(s[d.key] ?? 0)} max={d.max} color={d.color} />
                        </td>
                      ))}
                      <td style={{ ...S.td, fontSize: 10, color: "oklch(0.4 0.01 264)", fontFamily: "monospace" }}>
                        {s.as_of ? new Date(s.as_of).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom startups + recent history side-by-side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={S.card}>
              <div style={S.label}>Lowest Signal (needs attention)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Company</th>
                    <th style={S.th}>Signal</th>
                    <th style={S.th}>As of</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.bottomStartups ?? []).map((s: any, i: number) => (
                    <tr key={i}>
                      <td style={{ ...S.td }}>{s.company_name}</td>
                      <td style={{ ...S.td, fontFamily: "monospace", color: "oklch(0.65 0.2 25)" }}>
                        {Number(s.signals_total ?? 0).toFixed(2)}
                      </td>
                      <td style={{ ...S.td, fontSize: 10, color: "oklch(0.4 0.01 264)" }}>
                        {s.as_of ? new Date(s.as_of).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={S.card}>
              <div style={S.label}>Recent Score Changes</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={S.th}>Dimension</th>
                    <th style={S.th}>Old</th>
                    <th style={S.th}>New</th>
                    <th style={S.th}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentHistory ?? []).length === 0 && (
                    <tr><td colSpan={4} style={{ ...S.td, textAlign: "center", color: "oklch(0.35 0.01 264)" }}>No history.</td></tr>
                  )}
                  {(data?.recentHistory ?? []).slice(0, 15).map((h: any, i: number) => {
                    const delta = Number(h.new_value) - Number(h.old_value);
                    return (
                      <tr key={i}>
                        <td style={{ ...S.td, fontSize: 11 }}>{h.dimension}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: "oklch(0.5 0.01 264)" }}>{Number(h.old_value ?? 0).toFixed(2)}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: delta >= 0 ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)" }}>
                          {delta >= 0 ? "+" : ""}{delta.toFixed(2)}
                        </td>
                        <td style={{ ...S.td, fontSize: 10, color: "oklch(0.4 0.01 264)" }}>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
