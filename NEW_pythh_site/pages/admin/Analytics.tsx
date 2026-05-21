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

const EVENT_COLORS: Record<string, string> = {
  page_viewed:      "oklch(0.75 0.15 270)",
  url_submitted:    "oklch(0.85 0.17 162)",
  scan_completed:   "oklch(0.78 0.15 200)",
  login_completed:  "oklch(0.7 0.15 80)",
  checkout_started: "oklch(0.65 0.18 300)",
};

function EventBar({ name, count, max }: { name: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const color = EVENT_COLORS[name] ?? "oklch(0.55 0.01 264)";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: "oklch(0.65 0.01 264)" }}>{name}</span>
        <span style={{ fontFamily: "monospace", color }}>{count.toLocaleString()}</span>
      </div>
      <div style={{ height: 5, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: { day: string; cnt: string }[] }) {
  if (!data.length) return <div style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No data</div>;
  const counts = data.map((d) => Number(d.cnt));
  const max = Math.max(...counts, 1);
  const W = 320, H = 60;
  const stepX = data.length > 1 ? W / (data.length - 1) : W;

  const points = counts.map((c, i) => ({
    x: i * stepX,
    y: H - (c / max) * (H - 6),
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1].x} ${H} L 0 ${H} Z`;

  return (
    <svg width={W} height={H} style={{ display: "block", width: "100%", height: 60 }} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.17 162)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="oklch(0.85 0.17 162)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={path} fill="none" stroke="oklch(0.85 0.17 162)" strokeWidth={1.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="oklch(0.85 0.17 162)" />
      ))}
    </svg>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = trpc.admin.getAnalytics.useQuery();
  const adminStats = trpc.admin.getStats.useQuery();

  const maxEvent = Math.max(...(data?.eventBreakdown ?? []).map((e: any) => Number(e.cnt)), 1);
  const maxPage  = Math.max(...(data?.pageViews ?? []).map((p: any) => Number(p.cnt)), 1);

  return (
    <DashboardLayout>
      <Helmet><title>Analytics — Admin</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">Analytics</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Site activity, signups, queries, and usage — last 30 days.
        </p>
      </div>

      {(isLoading || adminStats.isLoading) && (
        <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      )}

      {!isLoading && !adminStats.isLoading && (
        <div style={{ display: "grid", gap: 16 }}>

          {/* Platform KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              ["Total Users",        adminStats.data?.totalUsers,         "oklch(0.75 0.15 270)"],
              ["Active Subs",        adminStats.data?.activeSubscribers,  "oklch(0.85 0.17 162)"],
              ["Pipeline Runs Today",adminStats.data?.pipelineRunsToday,  "oklch(0.78 0.15 200)"],
              ["Emails Sent Today",  adminStats.data?.emailsSentToday,    "oklch(0.65 0.18 300)"],
            ].map(([lbl, val, color]) => (
              <div key={lbl as string} style={S.card}>
                <div style={S.label}>{lbl}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color: color as string }}>
                  {val ?? "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Usage stats */}
          {data?.usageStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                ["Total Users (profiles)", data.usageStats.total_users, "oklch(0.75 0.15 270)"],
                ["Avg Analysis Count",     data.usageStats.avg_analysis_count, "oklch(0.78 0.15 200)"],
                ["Active 30d",             data.usageStats.active_30d, "oklch(0.85 0.17 162)"],
              ].map(([lbl, val, color]) => (
                <div key={lbl as string} style={S.card}>
                  <div style={S.label}>{lbl}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: color as string }}>{val ?? "—"}</div>
                </div>
              ))}
            </div>
          )}

          {/* Signups sparkline */}
          <div style={S.card}>
            <div style={S.label}>New Signups — Last 30 days</div>
            <Sparkline data={data?.dailySignups ?? []} />
            {(data?.dailySignups ?? []).length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "oklch(0.4 0.01 264)", marginTop: 6 }}>
                <span>{data?.dailySignups?.[0]?.day}</span>
                <span>Total: {(data?.dailySignups ?? []).reduce((acc: number, d: any) => acc + Number(d.cnt), 0).toLocaleString()} signups</span>
                <span>{data?.dailySignups?.[data.dailySignups.length - 1]?.day}</span>
              </div>
            )}
          </div>

          {/* Events + page views side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={S.card}>
              <div style={S.label}>Event Breakdown (30d)</div>
              {(data?.eventBreakdown ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No events tracked yet.</p>
              )}
              {(data?.eventBreakdown ?? []).map((e: any) => (
                <EventBar key={e.event_name} name={e.event_name} count={Number(e.cnt)} max={maxEvent} />
              ))}
            </div>

            <div style={S.card}>
              <div style={S.label}>Top Pages by Views (30d)</div>
              {(data?.pageViews ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: "oklch(0.35 0.01 264)" }}>No page views tracked yet.</p>
              )}
              {(data?.pageViews ?? []).map((p: any) => (
                <div key={p.page} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: "oklch(0.65 0.01 264)", fontFamily: "monospace" }}>{p.page || "/"}</span>
                    <span style={{ fontFamily: "monospace", color: "oklch(0.75 0.15 270)" }}>{Number(p.cnt).toLocaleString()}</span>
                  </div>
                  <div style={{ height: 5, background: "oklch(0.18 0.01 264)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((Number(p.cnt) / maxPage) * 100)}%`, background: "oklch(0.75 0.15 270)", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "oklch(0.4 0.01 264)", padding: "10px 14px", border: "1px solid oklch(0.18 0.01 264)", borderRadius: 8 }}>
            Analytics docs: <code style={{ color: "oklch(0.75 0.15 270)" }}>docs/PYTHH_PLATFORM_ANALYTICS.md</code>
            &nbsp;·&nbsp;
            Funnel report: <code style={{ color: "oklch(0.75 0.15 270)" }}>scripts/lookup-funnel-report.js</code>
            &nbsp;·&nbsp;
            Event tracking: <code style={{ color: "oklch(0.75 0.15 270)" }}>src/lib/analytics.ts</code>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
