import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, Save } from "lucide-react";
import { apiUrl } from "@/lib/apiConfig";

type ComponentWeights = Record<string, number>;

const COMPONENT_LABELS: Record<string, string> = {
  team: "Team",
  traction: "Traction",
  market: "Market",
  product: "Product",
  vision: "Vision",
  ecosystem: "Ecosystem",
  grit: "Grit",
  problemValidation: "Problem Validation",
};

export default function GodWeightsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weights, setWeights] = useState<ComponentWeights>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/admin/god-score-summary"))
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const active = (summary?.weightHistory ?? []).find((w: any) => w.status === "active") ?? summary?.weightHistory?.[0];
    const w = active?.weights;
    if (!w) return;
    const cw = w.componentWeights ?? w;
    setWeights({
      team: cw.team ?? 0.25,
      traction: cw.traction ?? 0.25,
      market: cw.market ?? 0.2,
      product: cw.product ?? 0.15,
      vision: cw.vision ?? 0.15,
      ecosystem: cw.ecosystem ?? 0,
      grit: cw.grit ?? 0,
      problemValidation: cw.problemValidation ?? cw.problem_validation ?? 0,
    });
  }, [summary]);

  const total = Object.values(weights).reduce((s, v) => s + (Number(v) || 0), 0);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(apiUrl("/api/god-weights/save"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights, userId: "admin" }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Save failed");
      setMsg("GOD weights saved. Trigger recalculate-scores to apply fleet-wide.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <Helmet><title>GOD Weights — Admin</title></Helmet>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">GOD Weights</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            Component weight editor. <Link href="/admin/god" style={{ color: "oklch(0.85 0.17 162)" }}>GOD Manager →</Link>
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={saving || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg cursor-pointer font-bold"
          style={{ background: "oklch(0.55 0.15 80)", color: "#fff", border: "none", opacity: saving ? 0.5 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Weights
        </button>
      </div>

      {msg && <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "oklch(0.85 0.17 162 / 0.1)", color: "oklch(0.85 0.17 162)" }}>{msg}</p>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.5 0.01 264)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
      ) : (
        <div className="rounded-lg border p-4 max-w-lg" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
          <p className="text-[10px] font-bold tracking-widest mb-3 m-0" style={{ color: "oklch(0.45 0.01 264)" }}>COMPONENT WEIGHTS</p>
          {Object.entries(weights).map(([key, val]) => (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "oklch(0.6 0.01 264)" }}>{COMPONENT_LABELS[key] ?? key}</span>
              <input type="number" step={0.05} min={0} max={1} value={val}
                onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) || 0 })}
                style={{ background: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.25 0.01 264)", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "monospace", color: "oklch(0.85 0.01 264)" }} />
              <input type="range" min={0} max={0.5} step={0.01} value={val}
                onChange={(e) => setWeights({ ...weights, [key]: parseFloat(e.target.value) })} style={{ width: "100%" }} />
            </div>
          ))}
          <p style={{ fontSize: 11, marginTop: 12, color: Math.abs(total - 1) > 0.05 ? "oklch(0.65 0.2 25)" : "oklch(0.5 0.01 264)" }}>
            Sum: {total.toFixed(3)} (target ~1.0 for normalized components)
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
