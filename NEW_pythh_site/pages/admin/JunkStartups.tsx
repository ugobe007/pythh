import { Helmet } from "react-helmet-async";
import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { AlertTriangle, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { apiUrl } from "@/lib/apiConfig";

type JunkRow = {
  id: string;
  name: string;
  status: string | null;
  total_god_score: number | null;
  junk_reason: string;
  source: string;
};

type ScanResult = {
  scanned: number;
  junk_count: number;
  by_reason: Record<string, number>;
  rows: JunkRow[];
};

const border = "oklch(0.22 0.01 264)";
const panelBg = "oklch(0.15 0.01 264)";
const muted = "oklch(0.45 0.01 264)";

export default function JunkStartupsPage() {
  const [statusFilter, setStatusFilter] = useState<"active" | "pending" | "approved" | "all">("active");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: "3000" });
      const res = await fetch(apiUrl(`/api/admin/junk-startups/scan?${params}`));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Scan failed (${res.status})`);
      }
      const data = (await res.json()) as ScanResult;
      setScan(data);
      setSelected(new Set(data.rows.map((r) => r.id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!scan?.rows.length) return;
    if (selected.size === scan.rows.length) setSelected(new Set());
    else setSelected(new Set(scan.rows.map((r) => r.id)));
  };

  const apply = async (action: "reject" | "delete") => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const verb = action === "delete" ? "permanently delete" : "reject";
    if (
      !confirm(
        `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${ids.length} junk startup(s)?\n\nReject is reversible; delete is permanent.`,
      )
    ) {
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/admin/junk-startups/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Apply failed (${res.status})`);
      alert(`Done — ${body.affected ?? 0} row(s) ${action === "delete" ? "deleted" : "rejected"}.`);
      await runScan();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  };

  const topReasons = useMemo(() => {
    if (!scan?.by_reason) return [];
    return Object.entries(scan.by_reason)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [scan]);

  return (
    <DashboardLayout>
      <Helmet>
        <title>Junk Startup Cleanup — Admin</title>
      </Helmet>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle size={20} style={{ color: "oklch(0.75 0.15 80)" }} />
            Junk Startup Cleanup
          </h1>
          <p className="text-xs mt-1 max-w-xl" style={{ color: muted }}>
            Scan headline fragments, test names, and entity_gate junk — reject or delete in bulk. Uses the same name
            gate as the ingestion pipeline.
          </p>
        </div>
        <Link
          href="/admin/tools"
          className="text-[10px] no-underline shrink-0"
          style={{ color: "oklch(0.85 0.17 162)" }}
        >
          ← All tools
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-xs" style={{ color: muted }}>
          Scan scope
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="ml-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer"
            style={{ background: panelBg, border: `1px solid ${border}`, color: "oklch(0.92 0.005 264)" }}
          >
            <option value="active">Pending + Approved</option>
            <option value="pending">Pending only</option>
            <option value="approved">Approved only</option>
            <option value="all">All statuses</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50"
          style={{ background: "oklch(0.55 0.15 80)", color: "#fff", border: "none" }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {loading ? "Scanning…" : "Scan for junk"}
        </button>
      </div>

      {error && (
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "oklch(0.55 0.2 25 / 0.15)", color: "oklch(0.75 0.2 25)" }}>
          {error}
        </p>
      )}

      {scan && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border p-4" style={{ borderColor: border, background: panelBg }}>
              <div className="text-2xl font-bold font-mono">{scan.scanned.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>
                Rows scanned
              </div>
            </div>
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: "oklch(0.75 0.15 80 / 0.4)", background: "oklch(0.55 0.15 80 / 0.08)" }}
            >
              <div className="text-2xl font-bold font-mono" style={{ color: "oklch(0.75 0.15 80)" }}>
                {scan.junk_count.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>
                Junk flagged
              </div>
            </div>
            <div className="rounded-lg border p-4 col-span-2" style={{ borderColor: border, background: panelBg }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: muted }}>
                Top reasons
              </div>
              <div className="flex flex-wrap gap-2">
                {topReasons.map(([reason, count]) => (
                  <span
                    key={reason}
                    className="text-[10px] px-2 py-1 rounded font-mono"
                    style={{ background: "oklch(0.13 0.01 264)", border: `1px solid ${border}`, color: muted }}
                  >
                    {reason} ({count})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={toggleAll}
              disabled={!scan.rows.length}
              className="text-xs px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
              style={{ border: `1px solid ${border}`, color: muted, background: "transparent" }}
            >
              {selected.size === scan.rows.length ? "Deselect all" : "Select all junk"}
            </button>
            <button
              type="button"
              onClick={() => void apply("reject")}
              disabled={!selected.size || applying}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold cursor-pointer disabled:opacity-50"
              style={{ background: "oklch(0.55 0.15 80)", color: "#fff", border: "none" }}
            >
              <XCircle size={14} />
              Reject selected ({selected.size})
            </button>
            <button
              type="button"
              onClick={() => void apply("delete")}
              disabled={!selected.size || applying}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold cursor-pointer disabled:opacity-50"
              style={{ background: "oklch(0.55 0.2 25)", color: "#fff", border: "none" }}
            >
              <Trash2 size={14} />
              Delete selected ({selected.size})
            </button>
            {applying && (
              <span className="text-xs" style={{ color: muted }}>
                Applying…
              </span>
            )}
          </div>

          <div className="rounded-lg border overflow-hidden" style={{ borderColor: border }}>
            <table className="w-full text-left text-xs">
              <thead style={{ background: panelBg }}>
                <tr>
                  <th className="w-10 p-2" />
                  <th className="p-2" style={{ color: muted }}>
                    Name
                  </th>
                  <th className="p-2" style={{ color: muted }}>
                    Reason
                  </th>
                  <th className="p-2 text-center" style={{ color: muted }}>
                    Status
                  </th>
                  <th className="p-2 text-center" style={{ color: muted }}>
                    GOD
                  </th>
                </tr>
              </thead>
              <tbody>
                {scan.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t"
                    style={{
                      borderColor: "oklch(0.18 0.01 264)",
                      background: selected.has(row.id) ? "oklch(0.55 0.15 80 / 0.06)" : undefined,
                    }}
                  >
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                    </td>
                    <td className="p-2 font-semibold max-w-md truncate">{row.name}</td>
                    <td className="p-2 max-w-sm truncate font-mono" style={{ color: muted }} title={row.junk_reason}>
                      {row.junk_reason}
                    </td>
                    <td className="p-2 text-center" style={{ color: muted }}>
                      {row.status}
                    </td>
                    <td className="p-2 text-center font-mono" style={{ color: "oklch(0.75 0.15 80)" }}>
                      {row.total_god_score != null ? Math.round(row.total_god_score) : "—"}
                    </td>
                  </tr>
                ))}
                {!scan.rows.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center" style={{ color: muted }}>
                      No junk found in this scan scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!scan && !loading && (
        <p className="text-xs" style={{ color: muted }}>
          Run a scan to list junk startups, then reject or delete selected rows.
        </p>
      )}
    </DashboardLayout>
  );
}
