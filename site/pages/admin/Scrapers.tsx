import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/apiConfig";

const SCRAPERS = [
  { id: "run-rss-scraper.js", label: "RSS Scraper", desc: "Scrape active RSS feeds" },
  { id: "discover-startups-from-rss.js", label: "Startup Discovery", desc: "Find startups from RSS" },
  { id: "scripts/scrapers/investor-mega-scraper.js", label: "Investor Scraper", desc: "Bulk investor collection" },
  { id: "scripts/enrich-sparse-startups.js", label: "Enrich Sparse Startups", desc: "Fill gaps in startup data" },
];

export default function ScrapersPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch(apiUrl("/api/admin/scraper-stats"))
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function runScraper(scriptName: string, label: string) {
    setRunning(scriptName);
    setMsg(null);
    try {
      const r = await fetch(apiUrl("/api/scrapers/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptName, description: label }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to start");
      setMsg(body.message || `${label} started`);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(null);
    }
  }

  async function refreshRss() {
    setRunning("rss-refresh");
    try {
      await fetch(apiUrl("/api/rss/refresh"), { method: "POST" });
      setMsg("RSS refresh triggered");
      setTimeout(load, 5000);
    } finally {
      setRunning(null);
    }
  }

  const rss = stats?.rss_sources;

  return (
    <DashboardLayout>
      <Helmet><title>Scrapers — Admin</title></Helmet>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Scraper Management</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>Run data pipelines and monitor RSS health.</p>
        </div>
        <button type="button" onClick={load} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
          style={{ border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.6 0.01 264)", background: "transparent" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {msg && <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "oklch(0.85 0.17 162 / 0.1)", color: "oklch(0.85 0.17 162)" }}>{msg}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(0.5 0.01 264)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {rss && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["RSS Sources", rss.total],
                ["Healthy", rss.healthy],
                ["Failing", rss.failing],
                ["24h Discoveries", stats?.last_24h?.discoveries ?? "—"],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1 m-0" style={{ color: "oklch(0.45 0.01 264)" }}>{label}</p>
                  <p className="text-2xl font-bold font-mono m-0" style={{ color: "oklch(0.85 0.17 162)" }}>{val}</p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
            <p className="text-[10px] font-bold tracking-widest mb-3 m-0" style={{ color: "oklch(0.45 0.01 264)" }}>RUN SCRAPERS</p>
            <div className="grid gap-2">
              {SCRAPERS.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                  <div>
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-[11px]" style={{ color: "oklch(0.45 0.01 264)" }}>{s.desc}</div>
                  </div>
                  <button type="button" disabled={!!running} onClick={() => runScraper(s.id, s.label)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer shrink-0"
                    style={{ background: "oklch(0.55 0.15 80)", color: "#fff", border: "none", opacity: running ? 0.5 : 1 }}>
                    <Play size={12} /> Run
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div>
                  <div className="text-sm font-semibold">RSS Refresh</div>
                  <div className="text-[11px]" style={{ color: "oklch(0.45 0.01 264)" }}>Trigger all active feeds now</div>
                </div>
                <button type="button" disabled={!!running} onClick={refreshRss}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                  style={{ border: "1px solid oklch(0.85 0.17 162 / 0.4)", color: "oklch(0.85 0.17 162)", background: "transparent" }}>
                  <RefreshCw size={12} /> Refresh RSS
                </button>
              </div>
            </div>
          </div>

          {(stats?.recent_activity ?? []).length > 0 && (
            <div className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
              <p className="text-[10px] font-bold tracking-widest mb-3 m-0" style={{ color: "oklch(0.45 0.01 264)" }}>RECENT ACTIVITY (24H)</p>
              {(stats.recent_activity as any[]).map((a, i) => (
                <div key={i} className="text-xs py-1 flex justify-between" style={{ color: "oklch(0.55 0.01 264)" }}>
                  <span>{a.agent} · {a.action}</span>
                  <span style={{ color: a.status === "success" ? "oklch(0.85 0.17 162)" : "oklch(0.65 0.2 25)" }}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
