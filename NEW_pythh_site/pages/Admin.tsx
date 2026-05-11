/**
 * Admin dashboard — stats + feedback + users (handoff §6.6).
 */
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2 } from "lucide-react";

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  const stats = trpc.admin.getStats.useQuery(undefined, { enabled: user?.role === "admin" });
  const feedback = trpc.admin.getRecentFeedback.useQuery(undefined, { enabled: user?.role === "admin" });
  const users = trpc.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin" });

  if (authLoading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ backgroundColor: "oklch(0.13 0.01 264)", color: "oklch(0.7 0.01 264)" }}>
        <Loader2 className="animate-spin" size={20} />
        Checking access…
      </div>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Admin — Pythh.ai</title>
      </Helmet>
      <h1 className="text-2xl font-bold mb-6">Admin</h1>

      <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Users", stats.data?.totalUsers],
          ["Active Oracle subs", stats.data?.activeSubscribers],
          ["Pipeline runs today", stats.data?.pipelineRunsToday],
          ["Emails sent today", stats.data?.emailsSentToday],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border p-4" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
            <p className="text-[10px] uppercase tracking-wider opacity-60">{label}</p>
            <p className="text-2xl font-bold mt-1">{val ?? "—"}</p>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-bold tracking-widest mb-3 opacity-70">RECENT FEEDBACK</h2>
        <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          <table className="w-full text-left">
            <thead style={{ backgroundColor: "oklch(0.16 0.01 264)" }}>
              <tr>
                <th className="p-2">User</th>
                <th className="p-2">Run</th>
                <th className="p-2">Rating</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(feedback.data ?? []).map((row) => (
                <tr key={row.id} className="border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                  <td className="p-2">{row.userEmail ?? row.userName ?? row.userId}</td>
                  <td className="p-2 font-mono truncate max-w-[120px]" title={row.runId}>
                    {row.runId}
                  </td>
                  <td className="p-2">{row.rating}</td>
                  <td className="p-2">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold tracking-widest mb-3 opacity-70">USERS</h2>
        <div className="rounded-lg border overflow-hidden text-xs" style={{ borderColor: "oklch(0.22 0.01 264)" }}>
          <table className="w-full text-left">
            <thead style={{ backgroundColor: "oklch(0.16 0.01 264)" }}>
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                  <td className="p-2">{u.id}</td>
                  <td className="p-2">{u.email ?? "—"}</td>
                  <td className="p-2">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
