import { Helmet } from "react-helmet-async";
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, Wifi, WifiOff } from "lucide-react";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
  th: { padding: "6px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "oklch(0.4 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)" },
  td: { padding: "7px 10px", fontSize: 12, borderBottom: "1px solid oklch(0.17 0.01 264)" },
};

type Feed = {
  id: number;
  name: string;
  url: string;
  category: string;
  active: boolean;
  priority: number;
  last_scraped: string | null;
  total_discoveries: number;
  avg_yield_per_scrape: number;
  consecutive_failures: number;
  created_at: string;
};

const API = typeof window !== "undefined"
  ? (import.meta.env?.VITE_API_URL || "https://hot-honey.fly.dev")
  : "https://hot-honey.fly.dev";

export default function RssManagerPage() {
  const { data: feeds = [], isLoading, refetch } = trpc.admin.getRssFeeds.useQuery() as { data: Feed[]; isLoading: boolean; refetch: () => void };
  const toggleFeed = trpc.admin.toggleRssFeed.useMutation({ onSuccess: () => refetch() });

  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = feeds.filter((f) => {
    if (filter === "active" && !f.active) return false;
    if (filter === "inactive" && f.active) return false;
    if (search && !f.name?.toLowerCase().includes(search.toLowerCase()) && !f.url?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeCount = feeds.filter((f) => f.active).length;
  const failingCount = feeds.filter((f) => (f.consecutive_failures ?? 0) >= 3).length;
  const totalDiscoveries = feeds.reduce((acc, f) => acc + Number(f.total_discoveries ?? 0), 0);

  async function triggerRefresh() {
    setRefreshing(true);
    try {
      await fetch(`${API}/api/rss/refresh`, { method: "POST" });
    } finally {
      setTimeout(() => setRefreshing(false), 3000);
      setTimeout(() => refetch(), 5000);
    }
  }

  return (
    <DashboardLayout>
      <Helmet><title>RSS Manager — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">RSS Feed Manager</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Activate, deactivate, and monitor RSS feeds powering the discovery pipeline.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && (
        <div style={{ display: "grid", gap: 16 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              ["Total Feeds",        feeds.length,          "oklch(0.75 0.15 270)"],
              ["Active",             activeCount,           "oklch(0.85 0.17 162)"],
              ["Failing (≥3 errs)",  failingCount,          failingCount > 0 ? "oklch(0.65 0.2 25)" : "oklch(0.5 0.01 264)"],
              ["Total Discoveries",  totalDiscoveries.toLocaleString(), "oklch(0.78 0.15 200)"],
            ].map(([lbl, val, color]) => (
              <div key={lbl as string} style={S.card}>
                <div style={S.label}>{lbl}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: color as string }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search feeds…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "6px 12px", background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 6, color: "oklch(0.85 0.01 264)", fontSize: 12, minWidth: 200 }}
            />
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: "5px 14px", fontSize: 12, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${filter === f ? "oklch(0.75 0.15 270)" : "oklch(0.22 0.01 264)"}`,
                  background: filter === f ? "oklch(0.18 0.01 264)" : "transparent",
                  color: filter === f ? "oklch(0.75 0.15 270)" : "oklch(0.5 0.01 264)" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div style={{ marginLeft: "auto" }}>
              <button onClick={triggerRefresh} disabled={refreshing}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: refreshing ? "default" : "pointer",
                  border: "1px solid oklch(0.75 0.15 270)", background: "transparent", color: "oklch(0.75 0.15 270)" }}>
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Refreshing…" : "Run Scraper"}
              </button>
            </div>
          </div>

          {/* Feed table */}
          <div style={S.card}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["","Name","Category","Priority","Discoveries","Avg/Scrape","Failures","Last Scraped",""].map((h) => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ ...S.td, textAlign: "center", color: "oklch(0.35 0.01 264)" }}>
                        No feeds match the current filter.
                      </td>
                    </tr>
                  )}
                  {filtered.map((f) => {
                    const failing = (f.consecutive_failures ?? 0) >= 3;
                    return (
                      <tr key={f.id} style={{ opacity: f.active ? 1 : 0.5 }}>
                        <td style={{ ...S.td, width: 28 }}>
                          {f.active
                            ? <Wifi size={13} style={{ color: "oklch(0.85 0.17 162)" }} />
                            : <WifiOff size={13} style={{ color: "oklch(0.35 0.01 264)" }} />}
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600 }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 1 }}>{f.url?.substring(0, 60)}{f.url?.length > 60 ? "…" : ""}</div>
                        </td>
                        <td style={{ ...S.td, fontSize: 10 }}>{f.category ?? "—"}</td>
                        <td style={{ ...S.td, fontFamily: "monospace" }}>{f.priority}</td>
                        <td style={{ ...S.td, fontFamily: "monospace" }}>{Number(f.total_discoveries ?? 0).toLocaleString()}</td>
                        <td style={{ ...S.td, fontFamily: "monospace", fontSize: 11 }}>
                          {f.avg_yield_per_scrape != null ? Number(f.avg_yield_per_scrape).toFixed(1) : "—"}
                        </td>
                        <td style={{ ...S.td, fontFamily: "monospace" }}>
                          <span style={{ color: failing ? "oklch(0.65 0.2 25)" : "oklch(0.5 0.01 264)" }}>
                            {f.consecutive_failures ?? 0}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize: 10, color: "oklch(0.4 0.01 264)", fontFamily: "monospace" }}>
                          {f.last_scraped ? new Date(f.last_scraped).toLocaleDateString() : "never"}
                        </td>
                        <td style={S.td}>
                          <button
                            onClick={() => toggleFeed.mutate({ id: f.id, active: !f.active })}
                            disabled={toggleFeed.isPending}
                            style={{
                              padding: "3px 10px", fontSize: 10, fontWeight: 700, borderRadius: 4, cursor: "pointer",
                              border: `1px solid ${f.active ? "oklch(0.65 0.2 25)" : "oklch(0.85 0.17 162)"}`,
                              color: f.active ? "oklch(0.65 0.2 25)" : "oklch(0.85 0.17 162)",
                              background: "transparent",
                            }}>
                            {f.active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "oklch(0.4 0.01 264)", padding: "10px 14px", border: "1px solid oklch(0.18 0.01 264)", borderRadius: 8 }}>
            Scraper script: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/core/ssot-rss-scraper.js</code>
            &nbsp;·&nbsp;
            Bulk deactivate SQL: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/sql/deactivate_dead_rss_feeds_bulk.sql</code>
            &nbsp;·&nbsp;
            Health audit: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/rss-health-check.js</code>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
