import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Loader2, Save, RotateCcw, AlertTriangle, CheckCircle, Sliders } from "lucide-react";
import { apiUrl } from "../lib/apiConfig";

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

function WeightRow({
  label,
  value,
  onChange,
  max = 3,
  step = 0.05,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
  step?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_72px_100px] gap-2 items-center py-1.5 border-b border-slate-800/80 last:border-0">
      <span className="text-xs text-slate-400 truncate" title={label}>
        {label.replace(/_/g, " ")}
      </span>
      <input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        style={S.input}
      />
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );
}

function WeightTable({
  weights,
  onChange,
  max = 3,
}: {
  weights: WeightMap;
  onChange: (next: WeightMap) => void;
  max?: number;
}) {
  const entries = Object.entries(weights).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div>
      {entries.map(([key, val]) => (
        <WeightRow
          key={key}
          label={key}
          value={val}
          max={max}
          onChange={(v) => onChange({ ...weights, [key]: v })}
        />
      ))}
    </div>
  );
}

export default function AdminSignalWeightsPage() {
  const [tab, setTab] = useState<TabId>("caps");
  const [config, setConfig] = useState<SignalWeightConfig | null>(null);
  const [defaults, setDefaults] = useState<SignalWeightConfig | null>(null);
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
    load()
      .then((data) => {
        setConfig(data.active);
        setDefaults(data.defaults);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  const capTotal = useMemo(
    () => (config ? capSum(config.dimensionCaps) : 0),
    [config]
  );

  const capMismatch = config && Math.abs(capTotal - config.totalCap) > 0.01;

  const updateCaps = (key: string, value: number) => {
    if (!config) return;
    const dimensionCaps = { ...config.dimensionCaps, [key]: value };
    const totalCap = capSum(dimensionCaps);
    setConfig({ ...config, dimensionCaps, totalCap });
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
      setSuccess("Signal weights saved. Run sync-signal-scores or trigger recompute to apply to existing startups.");
      setComment("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all signal weights to factory defaults?")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch(apiUrl("/api/admin/signal-weights/reset"), { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Reset failed");
      setConfig(body.active);
      setSuccess("Reset to factory defaults.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6">
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              Signal Weight Editor
            </h1>
            <p className="text-xs mt-1 text-slate-500">
              Dimension caps + class priority weights. Used by signal scoring pipeline and feed ranking.{" "}
              <Link to="/admin/signals" className="text-amber-400 hover:underline">
                View scores →
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !config || !!capMismatch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Weights
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4 shrink-0" /> {success}
          </div>
        )}

        {!loading && config && (
          <>
            <div className="flex flex-wrap gap-1 mb-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    tab === t.id
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Save comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 placeholder:text-slate-600"
              />
            </div>

            {tab === "caps" && (
              <div style={S.card}>
                <div style={S.label}>Dimension caps (must sum to total cap)</div>
                {Object.entries(config.dimensionCaps).map(([key, val]) => (
                  <WeightRow key={key} label={DIM_LABELS[key] || key} value={val} max={5} onChange={(v) => updateCaps(key, v)} />
                ))}
                <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between text-xs">
                  <span className={capMismatch ? "text-red-400" : "text-slate-400"}>
                    Sum: {capTotal.toFixed(2)} / totalCap {config.totalCap.toFixed(2)}
                    {capMismatch && " — caps must equal totalCap to save"}
                  </span>
                  <span className="text-slate-500">version {config.version}</span>
                </div>
              </div>
            )}

            {tab === "classes" && (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(config.dimensionClassWeights).map(([dim, weights]) => (
                  <div key={dim} style={S.card}>
                    <div style={S.label}>{DIM_LABELS[dim] || dim}</div>
                    <WeightTable
                      weights={weights}
                      onChange={(next) =>
                        setConfig({
                          ...config,
                          dimensionClassWeights: { ...config.dimensionClassWeights, [dim]: next },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {tab === "news" && (
              <div style={S.card}>
                <div style={S.label}>News momentum — source type weights</div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Controls how much each ingestion source contributes to news_momentum (0 = ignore).
                </p>
                <WeightTable
                  weights={config.newsSourceWeights}
                  onChange={(next) => setConfig({ ...config, newsSourceWeights: next })}
                />
              </div>
            )}

            {tab === "priority" && (
              <div style={S.card}>
                <div style={S.label}>Feed priority — class ranking weights</div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Higher = surfaced first in signal feeds and document scoring (lib/signalScorer.js).
                </p>
                <WeightTable
                  weights={config.classPriorityWeights}
                  max={5}
                  onChange={(next) => setConfig({ ...config, classPriorityWeights: next })}
                />
              </div>
            )}

            {defaults && (
              <p className="text-[10px] text-slate-600 mt-6">
                Factory defaults loaded for reset. After saving, run{" "}
                <code className="text-slate-500">node scripts/sync-signal-scores.js --apply</code> to recompute all startups.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
