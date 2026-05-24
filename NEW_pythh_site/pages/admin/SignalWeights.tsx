import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, Save, RotateCcw, AlertTriangle, CheckCircle, Sliders } from "lucide-react";
import { apiUrl } from "@/lib/apiConfig";

type WeightMap = Record<string, number>;

interface SignalWeightConfig {
  version: string;
  totalCap: number;
  dimensionCaps: WeightMap;
  dimensionClassWeights: Record<string, WeightMap>;
  newsSourceWeights: WeightMap;
  classPriorityWeights: WeightMap;
}

const DIM_LABELS: Record<string, string> = {
  founder_language_shift: "Founder Language",
  investor_receptivity: "Investor Receptivity",
  news_momentum: "News Momentum",
  capital_convergence: "Capital Convergence",
  execution_velocity: "Execution Velocity",
};

const TABS = [
  { id: "caps", label: "Dimension Caps" },
  { id: "classes", label: "Class Weights" },
  { id: "news", label: "News Sources" },
  { id: "priority", label: "Feed Priority" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "16px 18px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
  input: {
    width: "100%",
    background: "oklch(0.12 0.01 264)",
    border: "1px solid oklch(0.25 0.01 264)",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 12,
    fontFamily: "monospace",
    color: "oklch(0.85 0.02 264)",
  } as React.CSSProperties,
};

function capSum(caps: WeightMap) {
  return Object.values(caps).reduce((s, v) => s + (Number(v) || 0), 0);
}

function WeightRow({ label, value, onChange, max = 3, step = 0.05 }: { label: string; value: number; onChange: (v: number) => void; max?: number; step?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 100px", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid oklch(0.18 0.01 264)" }}>
      <span style={{ fontSize: 12, color: "oklch(0.55 0.01 264)" }} title={label}>{label.replace(/_/g, " ")}</span>
      <input type="number" min={0} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} style={S.input} />
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%" }} />
    </div>
  );
}

function WeightTable({ weights, onChange, max = 3 }: { weights: WeightMap; onChange: (next: WeightMap) => void; max?: number }) {
  return (
    <div>
      {Object.entries(weights).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => (
        <WeightRow key={key} label={key} value={val} max={max} onChange={(v) => onChange({ ...weights, [key]: v })} />
      ))}
    </div>
  );
}

export default function SignalWeightsPage() {
  const [tab, setTab] = useState<TabId>("caps");
  const [config, setConfig] = useState<SignalWeightConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(apiUrl("/api/admin/signal-weights"));
    if (!r.ok) throw new Error("Failed to load signal weights");
    return r.json();
  }, []);

  useEffect(() => {
    load().then((data) => setConfig(data.active)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [load]);

  const capTotal = useMemo(() => (config ? capSum(config.dimensionCaps) : 0), [config]);
  const capMismatch = config && Math.abs(capTotal - config.totalCap) > 0.01;

  const updateCaps = (key: string, value: number) => {
    if (!config) return;
    const dimensionCaps = { ...config.dimensionCaps, [key]: value };
    setConfig({ ...config, dimensionCaps, totalCap: capSum(dimensionCaps) });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch(apiUrl("/api/admin/signal-weights"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, comment: comment || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.errors?.join(", ") || body.error || "Save failed");
      setConfig(body.active);
      setSuccess("Saved. Run node scripts/sync-signal-scores.js --apply to recompute startups.");
      setComment("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all signal weights to factory defaults?")) return;
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/admin/signal-weights/reset"), { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Reset failed");
      setConfig(body.active);
      setSuccess("Reset to factory defaults.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <Helmet><title>Signal Weights — Admin</title></Helmet>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sliders size={20} style={{ color: "oklch(0.85 0.17 162)" }} />
            Signal Weight Editor
          </h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            Dimension caps + class priority weights.{" "}
            <Link href="/admin/signals" style={{ color: "oklch(0.85 0.17 162)" }}>View scores →</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={handleReset} disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer"
            style={{ border: "1px solid oklch(0.3 0.01 264)", color: "oklch(0.7 0.01 264)", background: "transparent" }}>
            <RotateCcw size={14} /> Reset
          </button>
          <button type="button" onClick={handleSave} disabled={saving || loading || !config || !!capMismatch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer font-bold"
            style={{ background: "oklch(0.55 0.15 80)", color: "#fff", border: "none", opacity: saving || capMismatch ? 0.5 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.5 0.01 264)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>}
      {error && <div className="mb-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ color: "oklch(0.65 0.2 25)", background: "oklch(0.55 0.2 25 / 0.1)", border: "1px solid oklch(0.55 0.2 25 / 0.3)" }}><AlertTriangle size={16} /> {error}</div>}
      {success && <div className="mb-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ color: "oklch(0.85 0.17 162)", background: "oklch(0.85 0.17 162 / 0.1)", border: "1px solid oklch(0.85 0.17 162 / 0.3)" }}><CheckCircle size={16} /> {success}</div>}

      {!loading && config && (
        <>
          <div className="flex flex-wrap gap-1 mb-4">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className="px-3 py-1.5 text-xs rounded-lg cursor-pointer"
                style={{
                  border: `1px solid ${tab === t.id ? "oklch(0.85 0.17 162 / 0.4)" : "oklch(0.25 0.01 264)"}`,
                  background: tab === t.id ? "oklch(0.85 0.17 162 / 0.12)" : "transparent",
                  color: tab === t.id ? "oklch(0.85 0.17 162)" : "oklch(0.5 0.01 264)",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          <input type="text" placeholder="Save comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded-lg mb-4"
            style={{ background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.85 0.01 264)" }} />

          {tab === "caps" && (
            <div style={S.card}>
              <div style={S.label}>Dimension caps (must sum to total cap)</div>
              {Object.entries(config.dimensionCaps).map(([key, val]) => (
                <WeightRow key={key} label={DIM_LABELS[key] || key} value={val} max={5} onChange={(v) => updateCaps(key, v)} />
              ))}
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid oklch(0.2 0.01 264)", fontSize: 11, color: capMismatch ? "oklch(0.65 0.2 25)" : "oklch(0.5 0.01 264)" }}>
                Sum: {capTotal.toFixed(2)} / {config.totalCap.toFixed(2)}{capMismatch ? " — must match to save" : ""} · {config.version}
              </div>
            </div>
          )}

          {tab === "classes" && (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {Object.entries(config.dimensionClassWeights).map(([dim, weights]) => (
                <div key={dim} style={S.card}>
                  <div style={S.label}>{DIM_LABELS[dim] || dim}</div>
                  <WeightTable weights={weights} onChange={(next) => setConfig({ ...config, dimensionClassWeights: { ...config.dimensionClassWeights, [dim]: next } })} />
                </div>
              ))}
            </div>
          )}

          {tab === "news" && (
            <div style={S.card}>
              <div style={S.label}>News source weights</div>
              <WeightTable weights={config.newsSourceWeights} onChange={(next) => setConfig({ ...config, newsSourceWeights: next })} />
            </div>
          )}

          {tab === "priority" && (
            <div style={S.card}>
              <div style={S.label}>Feed priority weights</div>
              <WeightTable weights={config.classPriorityWeights} max={5} onChange={(next) => setConfig({ ...config, classPriorityWeights: next })} />
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
