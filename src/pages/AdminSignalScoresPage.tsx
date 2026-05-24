import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiUrl } from "../lib/apiConfig";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
  th: { padding: "6px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "oklch(0.4 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)" },
  td: { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid oklch(0.17 0.01 264)" },
};

const DIMS = [
  { key: "founder_language_shift", label: "Founder Language", max: 2.0, color: "oklch(0.75 0.15 270)" },
  { key: "investor_receptivity", label: "Investor Receptivity", max: 2.5, color: "oklch(0.78 0.15 200)" },
  { key: "news_momentum", label: "News Momentum", max: 1.5, color: "oklch(0.85 0.17 162)" },
  { key: "capital_convergence", label: "Capital Convergence", max: 2.0, color: "oklch(0.7 0.15 80)" },
  { key: "execution_velocity", label: "Execution Velocity", max: 2.0, color: "oklch(0.65 0.18 300)" },
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

export default function AdminSignalScoresPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl("/api/admin/signal-summary"));
    if (!r.ok) throw new Error("Failed to load signal summary");
    return r.json();
  }, []);

  useEffect(() => {
    load()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <div className="px-4 sm:px-6 py-6">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="mb-6">
          <h1 className="text-xl font-bold">Signal Score Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            5-dimension signal scores (0–10). Adjust caps and class weights in{" "}
            <Link to="/admin/signal-weights" className="text-amber-400 hover:underline">Signal Weights</Link>
            {" "}— GOD component weights in{" "}
            <Link to="/admin/god-settings" className="text-amber-400 hover:underline">GOD Weights</Link>.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        )}

        {error && (
          <div style={{ color: "oklch(0.65 0.2 25)", fontSize: 12 }}>
            {error}. If the table is empty, run signal scoring on the pipeline first.
          </div>
        )}

        {!loading && data && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={S.card}>
                <div style={S.label}>Avg Signal Score (0–10)</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>
                  {data.summary?.avg_total ?? "—"}
                </div>
              </div>
              <div style={S.card}>
                <div style={S.label}>Startups Scored</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>
                  {Number(data.summary?.count ?? 0).toLocaleString()}
                </div>
              </div>
              <div style={{ ...S.card, background: "oklch(0.13 0.01 264)" }}>
                <div style={S.label}>Dimension caps (ontology)</div>
                {DIMS.map((d) => (
                  <div key={d.key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
                    <span style={{ color: "oklch(0.55 0.01 264)" }}>{d.label}</span>
                    <span style={{ color: d.color, fontFamily: "monospace" }}>max {d.max}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.label}>Top signal scores</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Startup", "Total", ...DIMS.map((d) => d.label)].map((h) => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.topStartups ?? []).map((row: Record<string, unknown>) => (
                      <tr key={String(row.startup_id)}>
                        <td style={{ ...S.td, color: "oklch(0.85 0.01 264)" }}>{String(row.company_name ?? "—")}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>
                          {Number(row.signals_total).toFixed(2)}
                        </td>
                        {DIMS.map((d) => (
                          <td key={d.key} style={S.td}>
                            <MiniBar value={Number(row[d.key]) || 0} max={d.max} color={d.color} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {data.founderVoice && (
              <div style={S.card}>
                <div style={S.label}>Founder Voice & Culture</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)" }}>Avg team credit</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>
                      {data.founderVoice.avgTeamCreditRatio != null
                        ? `${(Number(data.founderVoice.avgTeamCreditRatio) * 100).toFixed(0)}% we`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "oklch(0.45 0.01 264)" }}>Avg culture score</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: "oklch(0.85 0.17 162)" }}>
                      {data.founderVoice.avgCultureScore ?? "—"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11 }}>
                  {Object.entries(data.founderVoice.classTotals ?? {}).map(([cls, cnt]) => (
                    <div key={cls} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "oklch(0.55 0.01 264)" }}>{data.founderVoice.classLabels?.[cls] ?? cls}</span>
                      <span style={{ fontFamily: "monospace" }}>{String(cnt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(data.recentHistory ?? []).length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Recent signal history</div>
                <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["Dimension", "Old", "New", "Applied", "When"].map((h) => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentHistory.map((h: Record<string, unknown>, i: number) => (
                        <tr key={i}>
                          <td style={S.td}>{String(h.dimension)}</td>
                          <td style={{ ...S.td, fontFamily: "monospace" }}>{String(h.old_value ?? "—")}</td>
                          <td style={{ ...S.td, fontFamily: "monospace" }}>{String(h.new_value ?? "—")}</td>
                          <td style={S.td}>{h.applied ? "yes" : "no"}</td>
                          <td style={{ ...S.td, fontFamily: "monospace", color: "oklch(0.45 0.01 264)" }}>
                            {String(h.created_at ?? "").slice(0, 16).replace("T", " ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
