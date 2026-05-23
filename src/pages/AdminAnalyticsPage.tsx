import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiUrl } from "../lib/apiConfig";

const S = {
  card: { background: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)", borderRadius: 10, padding: "18px 20px" },
  label: { fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "oklch(0.4 0.01 264)", marginBottom: 8 },
};

interface AnalyticsPayload {
  eventBreakdown: { event_name: string; cnt: string }[];
  dailySignups: { day: string; cnt: string }[];
  pageViews: { page: string; cnt: string }[];
  usageStats: { total_users: string; avg_analysis_count: string; active_30d: string } | null;
}

interface Kpis {
  startups_approved: number;
  investors_total: number;
  matches_total: number;
  avg_god_score: number;
}

function formatDay(day: unknown): string {
  if (!day) return "—";
  if (day instanceof Date) return day.toISOString().slice(0, 10);
  return String(day).slice(0, 10);
}

function EventBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "oklch(0.65 0.01 264)" }}>{name}</span>
        <span style={{ fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>{count.toLocaleString()}</span>
      </div>
      <div style={{ height: 5, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "oklch(0.75 0.15 270)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: { day: string; cnt: string }[] }) {
  if (!data.length) return <div style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No data</div>;
  const counts = data.map((d) => Number(d.cnt));
  const max = Math.max(...counts, 1);
  const W = 320;
  const H = 60;
  const stepX = data.length > 1 ? W / (data.length - 1) : W;
  const points = counts.map((c, i) => ({ x: i * stepX, y: H - (c / max) * (H - 6) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${H} L 0 ${H} Z`;

  return (
    <svg width={W} height={H} style={{ display: "block", width: "100%", height: 60 }} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="analytics-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.17 162)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="oklch(0.85 0.17 162)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#analytics-spark)" />
      <path d={path} fill="none" stroke="oklch(0.85 0.17 162)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(apiUrl("/api/admin/platform-analytics")).then((r) => r.json()),
      fetch(apiUrl("/api/admin/kpis")).then((r) => r.json()),
    ])
      .then(([analytics, kpiData]) => {
        if (analytics.error) throw new Error(analytics.error);
        setData(analytics);
        setKpis(kpiData);
      })
      .catch((e) => setError(e.message ?? "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  const maxEvent = Math.max(...(data?.eventBreakdown ?? []).map((e) => Number(e.cnt)), 1);
  const maxPage = Math.max(...(data?.pageViews ?? []).map((p) => Number(p.cnt)), 1);
  const signups = data?.dailySignups ?? [];

  return (
    <div className="px-4 sm:px-6 py-6">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mb-6">
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            Site activity, signups, queries, and usage — last 30 days.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
            <Loader2 className="animate-spin" size={16} /> Loading…
          </div>
        )}

        {error && (
          <div style={{ padding: 16, color: "oklch(0.65 0.2 25)", fontSize: 12 }}>{error}</div>
        )}

        {!loading && !error && data && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {[
                ["Approved Startups", kpis?.startups_approved, "oklch(0.85 0.17 162)"],
                ["Investors", kpis?.investors_total, "oklch(0.75 0.15 270)"],
                ["Matches", kpis?.matches_total, "oklch(0.78 0.15 200)"],
                ["Avg GOD Score", kpis?.avg_god_score, "oklch(0.65 0.18 300)"],
              ].map(([lbl, val, color]) => (
                <div key={lbl as string} style={S.card}>
                  <div style={S.label}>{lbl}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: color as string }}>
                    {val ?? "—"}
                  </div>
                </div>
              ))}
            </div>

            {data.usageStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                {[
                  ["Profile Users", data.usageStats.total_users, "oklch(0.75 0.15 270)"],
                  ["Avg Analysis Count", data.usageStats.avg_analysis_count, "oklch(0.78 0.15 200)"],
                  ["Active 30d", data.usageStats.active_30d, "oklch(0.85 0.17 162)"],
                ].map(([lbl, val, color]) => (
                  <div key={lbl as string} style={S.card}>
                    <div style={S.label}>{lbl}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: color as string }}>
                      {val ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={S.card}>
              <div style={S.label}>New Signups — Last 30 days</div>
              <Sparkline data={signups} />
              {signups.length > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 6 }}>
                  <span>{formatDay(signups[0]?.day)}</span>
                  <span>
                    Total: {signups.reduce((acc, d) => acc + Number(d.cnt), 0).toLocaleString()} signups
                  </span>
                  <span>{formatDay(signups[signups.length - 1]?.day)}</span>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <div style={S.card}>
                <div style={S.label}>Event Breakdown (30d)</div>
                {data.eventBreakdown.length === 0 && (
                  <p style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No events tracked yet.</p>
                )}
                {data.eventBreakdown.map((e) => (
                  <EventBar key={e.event_name} name={e.event_name} count={Number(e.cnt)} max={maxEvent} />
                ))}
              </div>

              <div style={S.card}>
                <div style={S.label}>Top Pages by Views (30d)</div>
                {data.pageViews.length === 0 && (
                  <p style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No page views tracked yet.</p>
                )}
                {data.pageViews.map((p) => (
                  <div key={p.page} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: "oklch(0.65 0.01 264)", fontFamily: "monospace" }}>{p.page || "/"}</span>
                      <span style={{ fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>
                        {Number(p.cnt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height: 5, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((Number(p.cnt) / maxPage) * 100)}%`,
                          background: "oklch(0.75 0.15 270)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
