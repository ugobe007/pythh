import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw, Settings, Snowflake } from "lucide-react";
import { apiUrl } from "../lib/apiConfig";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 6 },
};

const BUCKET_COLOR: Record<string, string> = {
  unscored: "oklch(0.4 0.01 264)",
  "0–20": "oklch(0.55 0.2 25)",
  "20–40": "oklch(0.65 0.18 45)",
  "40–60": "oklch(0.7 0.15 80)",
  "60–80": "oklch(0.75 0.17 162)",
  "80–100": "oklch(0.85 0.17 162)",
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
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function AdminGodManagerPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [freezing, setFreezing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl("/api/admin/god-score-summary"));
    if (!r.ok) throw new Error("Failed to load GOD summary");
    return r.json();
  }, []);

  useEffect(() => {
    load()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      setData(await load());
    } finally {
      setRefreshing(false);
    }
  }

  async function toggleFreeze(freeze: boolean) {
    setFreezing(true);
    try {
      const r = await fetch(apiUrl("/api/admin/god-freeze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freeze }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error ?? "Freeze update failed");
        return;
      }
      setConfirmFreeze(false);
      setData(await load());
    } finally {
      setFreezing(false);
    }
  }

  const totalStartups = (data?.distribution ?? []).reduce((acc: number, b: { cnt: string }) => acc + Number(b.cnt), 0);
  const isFrozen = Boolean(data?.runtime?.freeze);

  return (
    <div className="px-4 sm:px-6 py-6">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">GOD Score Manager</h1>
            <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
              Distribution, weight versions, runtime freeze. Edit weights in{" "}
              <Link to="/admin/god-settings" className="text-amber-400 hover:underline">GOD Weights</Link>.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
            <Link
              to="/admin/god-settings"
              className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Settings size={14} /> Adjust Weights
            </Link>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        )}

        {!loading && data && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                ["Avg GOD", data.stats?.avg ?? "—", "oklch(0.85 0.17 162)"],
                ["Max", data.stats?.max ?? "—", "oklch(0.78 0.15 200)"],
                ["Min", data.stats?.min ?? "—", "oklch(0.65 0.2 25)"],
                ["Scored", Number(data.stats?.total ?? 0).toLocaleString(), "oklch(0.75 0.15 270)"],
              ].map(([lbl, val, color]) => (
                <div key={lbl as string} style={S.card}>
                  <div style={S.label}>{lbl}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: color as string }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ ...S.card, borderColor: isFrozen ? "oklch(0.55 0.2 25)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={S.label}>Runtime freeze</div>
                  <div style={{ fontSize: 13, color: isFrozen ? "oklch(0.65 0.2 25)" : "oklch(0.75 0.17 162)" }}>
                    {isFrozen ? "Scoring FROZEN — no recalculations" : "Scoring active"}
                  </div>
                </div>
                {!confirmFreeze ? (
                  <button
                    onClick={() => setConfirmFreeze(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
                  >
                    <Snowflake size={14} /> {isFrozen ? "Unfreeze" : "Freeze scoring"}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleFreeze(!isFrozen)}
                      disabled={freezing}
                      className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 text-white disabled:opacity-50"
                    >
                      Confirm {isFrozen ? "unfreeze" : "freeze"}
                    </button>
                    <button onClick={() => setConfirmFreeze(false)} className="px-3 py-2 text-xs text-slate-500">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={S.card}>
              <div style={S.label}>Score distribution</div>
              {(data.distribution ?? []).map((b: { bucket: string; cnt: string }) => (
                <Bar
                  key={b.bucket}
                  label={b.bucket}
                  count={Number(b.cnt)}
                  total={totalStartups}
                  color={BUCKET_COLOR[b.bucket] ?? "oklch(0.5 0.01 264)"}
                />
              ))}
            </div>

            {(data.weightHistory ?? []).length > 0 && (
              <div style={S.card}>
                <div style={S.label}>Weight version history</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Version", "Status", "Comment", "Created"].map((h) => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "oklch(0.4 0.01 264)", fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.weightHistory.map((w: { weights_version: string; status: string; comment?: string; created_at: string }) => (
                        <tr key={w.weights_version}>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>{w.weights_version}</td>
                          <td style={{ padding: "7px 10px", color: "oklch(0.6 0.01 264)" }}>{w.status}</td>
                          <td style={{ padding: "7px 10px", color: "oklch(0.5 0.01 264)" }}>{w.comment ?? "—"}</td>
                          <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: 11, color: "oklch(0.45 0.01 264)" }}>
                            {String(w.created_at).slice(0, 10)}
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
