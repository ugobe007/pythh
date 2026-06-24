import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { AdminPageHeader } from '../components/admin/AdminPageHeader';
import { apiUrl } from '../lib/apiConfig';

type JunkRow = {
  id: string;
  name: string;
  status: string | null;
  total_god_score: number | null;
  junk_reason: string;
  source: string;
  created_at?: string;
};

type ScanResult = {
  scanned: number;
  junk_count: number;
  by_reason: Record<string, number>;
  rows: JunkRow[];
};

export default function AdminJunkStartupsPage() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending' | 'approved' | 'all'>('active');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: statusFilter, limit: '3000' });
      const res = await fetch(apiUrl(`/api/admin/junk-startups/scan?${params}`));
      if (!res.ok) throw new Error(`Scan failed (${res.status})`);
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

  const apply = async (action: 'reject' | 'delete') => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const verb = action === 'delete' ? 'permanently delete' : 'reject';
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
      const res = await fetch(apiUrl('/api/admin/junk-startups/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Apply failed (${res.status})`);
      alert(`Done — ${body.affected ?? 0} row(s) ${action === 'delete' ? 'deleted' : 'rejected'}.`);
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
    <div className="min-h-screen bg-slate-950 text-white pb-12">
      <AdminPageHeader
        maxWidthClass="max-w-[1800px]"
        title="Junk Startup Cleanup"
        subtitle="Scan headline fragments, test names, and entity_gate junk — reject or delete in bulk. Uses the same name gate as the ingestion pipeline."
        icon={AlertTriangle}
        actions={
          <>
            <Link
              to="/admin/edit-startups"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white"
            >
              Edit Startups
            </Link>
            <Link
              to="/admin/review-queue"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white"
            >
              Review Queue
            </Link>
          </>
        }
      />

      <div className="max-w-[1800px] mx-auto px-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400">
            Scan scope
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="ml-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning…' : 'Scan for junk'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {scan && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <div className="text-2xl font-bold">{scan.scanned.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Rows scanned</div>
              </div>
              <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4">
                <div className="text-2xl font-bold text-yellow-400">{scan.junk_count.toLocaleString()}</div>
                <div className="text-xs text-slate-400">Junk flagged</div>
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 col-span-2">
                <div className="text-xs text-slate-400 mb-2">Top reasons</div>
                <div className="flex flex-wrap gap-2">
                  {topReasons.map(([reason, count]) => (
                    <span
                      key={reason}
                      className="text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300"
                    >
                      {reason} ({count})
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                disabled={!scan.rows.length}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-600 text-slate-300 hover:text-white disabled:opacity-50"
              >
                {selected.size === scan.rows.length ? 'Deselect all' : 'Select all junk'}
              </button>
              <button
                type="button"
                onClick={() => void apply('reject')}
                disabled={!selected.size || applying}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-orange-600/80 hover:bg-orange-600 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Reject selected ({selected.size})
              </button>
              <button
                type="button"
                onClick={() => void apply('delete')}
                disabled={!selected.size || applying}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-lg bg-red-700/80 hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete selected ({selected.size})
              </button>
              {applying && <span className="text-xs text-slate-500">Applying…</span>}
            </div>

            <div className="rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/80">
                  <tr>
                    <th className="w-10 px-3 py-2" />
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Name</th>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Reason</th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium">Status</th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium">GOD</th>
                  </tr>
                </thead>
                <tbody>
                  {scan.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-t border-slate-800 ${selected.has(row.id) ? 'bg-amber-500/5' : ''}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggle(row.id)}
                          className="rounded border-slate-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-white max-w-md truncate">{row.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-400 max-w-sm truncate" title={row.junk_reason}>
                        {row.junk_reason}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-400">{row.status}</td>
                      <td className="px-3 py-2 text-center text-xs text-amber-400 font-mono">
                        {row.total_god_score != null ? Math.round(row.total_god_score) : '—'}
                      </td>
                    </tr>
                  ))}
                  {!scan.rows.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
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
          <p className="text-sm text-slate-500">
            Run a scan to list junk startups (headline fragments, test entries, entity_gate junk). Then reject or delete
            selected rows.
          </p>
        )}
      </div>
    </div>
  );
}
