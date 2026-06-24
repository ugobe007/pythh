import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import AdminToolsGrid from "@/components/AdminToolsGrid";
import { ADMIN_TOOLS } from "@/config/adminToolsRegistry";
import { Loader2, Send, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { apiUrl } from "../lib/apiConfig";

function StatCard({ label, value, color = "oklch(0.92 0.005 264)" }: { label: string; value: string | number | undefined; color?: string }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
      <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "oklch(0.45 0.01 264)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>{value ?? "—"}</p>
    </div>
  );
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [outreachStats, setOutreachStats] = useState<any>(null);
  const [draftCount, setDraftCount] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) window.location.href = getLoginUrl();
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") setLocation("/");
  }, [authLoading, user, setLocation]);

  const stats    = trpc.admin.getStats.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const feedback = trpc.admin.getRecentFeedback.useQuery(undefined, { enabled: user?.role === "admin", retry: false });
  const users    = trpc.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin", retry: false });

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetch(apiUrl("/api/outreach/stats"))
      .then((r) => r.json())
      .then(setOutreachStats)
      .catch(() => {});
    fetch(apiUrl("/api/outreach/inbox"))
      .then((r) => r.json())
      .then((d) => setDraftCount((d.drafts ?? []).length))
      .catch(() => {});
  }, [user]);

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2"
        style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.7 0.01 264)" }}>
        <Loader2 className="animate-spin" size={20} /> Checking access…
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Helmet><title>Admin — Pythh.ai</title></Helmet>

      <div className="mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
          Pythh admin console — {ADMIN_TOOLS.length} tools for scoring, matching, scrapers, outreach.
        </p>
      </div>

      {/* Junk cleanup — first action on admin home */}
      <section className="mb-8">
        <Link href="/admin/junk-startups"
          className="block no-underline rounded-lg border p-4 transition-colors hover:bg-white/[0.03]"
          style={{ borderColor: "oklch(0.55 0.15 80 / 0.55)", background: "oklch(0.55 0.15 80 / 0.06)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Trash2 size={22} className="shrink-0 mt-0.5" style={{ color: "oklch(0.75 0.15 80)" }} />
              <div>
                <div className="text-base font-bold" style={{ color: "oklch(0.92 0.005 264)" }}>Junk Startup Cleanup</div>
                <p className="text-[11px] leading-snug m-0 mt-1" style={{ color: "oklch(0.45 0.01 264)" }}>
                  Scan RSS headline junk, test names, and entity_gate rejects — bulk reject (recommended) or hard delete.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold shrink-0 px-3 py-1.5 rounded-md"
              style={{ color: "oklch(0.13 0.01 264)", background: "oklch(0.75 0.15 80)" }}>
              Open tool →
            </span>
          </div>
        </Link>
      </section>

      {/* Core control tools */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold tracking-widest m-0" style={{ color: "oklch(0.45 0.01 264)" }}>CONTROL TOOLS</h2>
          <a href="/admin/tools" className="text-[10px] no-underline" style={{ color: "oklch(0.85 0.17 162)" }}>All tools →</a>
        </div>
        <AdminToolsGrid category="scoring" compact />
        <div className="mt-3">
          <AdminToolsGrid category="matching" compact />
        </div>
        <div className="mt-3">
          <AdminToolsGrid category="pipeline" compact />
        </div>
        <div className="mt-3">
          <AdminToolsGrid category="data" compact />
        </div>
      </section>

      {/* Platform stats */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "oklch(0.45 0.01 264)" }}>PLATFORM</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Users"              value={stats.data?.totalUsers}         color="oklch(0.85 0.17 162)" />
          <StatCard label="Active Oracle Subs" value={stats.data?.activeSubscribers}  color="oklch(0.75 0.15 270)" />
          <StatCard label="Pipeline runs today" value={stats.data?.pipelineRunsToday} />
          <StatCard label="Emails sent today"  value={stats.data?.emailsSentToday}   />
        </div>
      </section>

      {/* Outreach stats */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold tracking-widest" style={{ color: "oklch(0.45 0.01 264)" }}>OUTREACH CAMPAIGNS</h2>
          <a href="/admin/outreach" className="text-[10px]" style={{ color: "oklch(0.65 0.15 270)", textDecoration: "none" }}>View full dashboard →</a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Total sent",   outreachStats?.total?.sent,    "oklch(0.75 0.15 270)"],
            ["Opened",       outreachStats?.total?.opened,  "oklch(0.85 0.17 162)"],
            ["Clicked",      outreachStats?.total?.clicked, "oklch(0.78 0.15 200)"],
            ["Bounced",      outreachStats?.total?.bounced, "oklch(0.65 0.2 25)"],
            ["Open rate",    outreachStats?.total?.openRate != null ? `${outreachStats.total.openRate}%` : "—", "oklch(0.85 0.17 162)"],
          ].map(([label, val, color]) => (
            <StatCard key={label as string} label={label as string} value={val as string | number} color={color as string} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[
            { label: "VC Leads", data: outreachStats?.vc,      color: "oklch(0.75 0.15 270)" },
            { label: "Startup Matches", data: outreachStats?.startup, color: "oklch(0.85 0.17 162)" },
          ].map(({ label, data, color }) => (
            <div key={label} className="rounded-lg border p-3" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
              <div className="text-[10px] font-bold tracking-widest mb-2" style={{ color: "oklch(0.45 0.01 264)" }}>{label}</div>
              <div className="flex gap-6">
                {[["sent", "Sent"], ["opened", "Opened"], ["clicked", "Clicked"], ["bounced", "Bounced"]].map(([k, lbl]) => (
                  <div key={k}>
                    <div className="text-lg font-bold font-mono" style={{ color }}>{data?.[k] ?? "—"}</div>
                    <div className="text-[10px]" style={{ color: "oklch(0.4 0.01 264)" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Outreach launcher */}
        <div className="rounded-lg border mt-3 p-4 flex flex-col sm:flex-row sm:items-center gap-4" style={{ borderColor: "oklch(0.22 0.01 264)", background: "oklch(0.15 0.01 264)" }}>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-widest mb-1" style={{ color: "oklch(0.45 0.01 264)" }}>OUTREACH</div>
            <p className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>
              Generate drafts, preview each email, approve before sending.
              {draftCount != null && draftCount > 0 && (
                <span style={{ color: "oklch(0.85 0.17 162)" }}> {draftCount} draft{draftCount === 1 ? "" : "s"} waiting for review.</span>
              )}
            </p>
          </div>
          <Link href="/admin/outreach"
            className="inline-flex items-center justify-center gap-2 shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold no-underline transition-opacity hover:opacity-90"
            style={{ background: "oklch(0.55 0.2 25)", color: "#fff", border: "1px solid oklch(0.65 0.2 25)" }}>
            <Send size={15} /> Outreach
          </Link>
        </div>
      </section>

      {/* Recent feedback */}
      <section className="mb-8">
        <h2 className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "oklch(0.45 0.01 264)" }}>RECENT FEEDBACK</h2>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          <table className="w-full text-left text-xs">
            <thead style={{ background: "oklch(0.15 0.01 264)" }}>
              <tr>
                {["User","Run","Rating","Reason"].map((h) => (
                  <th key={h} className="p-2" style={{ color: "oklch(0.45 0.01 264)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(feedback.data ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-3 text-center" style={{ color: "oklch(0.35 0.01 264)" }}>No feedback yet.</td></tr>
              )}
              {(feedback.data ?? []).map((row) => (
                <tr key={row.id} className="border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                  <td className="p-2">{row.userEmail ?? row.userName ?? row.userId}</td>
                  <td className="p-2 font-mono truncate max-w-[100px]" title={row.runId}>{row.runId}</td>
                  <td className="p-2">{row.rating}</td>
                  <td className="p-2">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users */}
      <section>
        <h2 className="text-[10px] font-bold tracking-widest mb-3" style={{ color: "oklch(0.45 0.01 264)" }}>USERS</h2>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          <table className="w-full text-left text-xs">
            <thead style={{ background: "oklch(0.15 0.01 264)" }}>
              <tr>
                {["ID","Email","Name","Role","Created"].map((h) => (
                  <th key={h} className="p-2" style={{ color: "oklch(0.45 0.01 264)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                  <td className="p-2 font-mono">{u.id}</td>
                  <td className="p-2">{u.email ?? "—"}</td>
                  <td className="p-2">{u.name ?? "—"}</td>
                  <td className="p-2">
                    <span style={{
                      border: `1px solid ${u.role === "admin" ? "oklch(0.75 0.15 270)" : "oklch(0.3 0.01 264)"}`,
                      color: u.role === "admin" ? "oklch(0.75 0.15 270)" : "oklch(0.5 0.01 264)",
                      padding: "1px 6px", borderRadius: 3, fontSize: 9, fontFamily: "monospace", fontWeight: 700,
                    }}>{u.role}</span>
                  </td>
                  <td className="p-2" style={{ color: "oklch(0.4 0.01 264)" }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
