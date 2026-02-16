import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { adminRpc } from '../services/adminRpc';

interface Startup {
  id: string;
  name: string;
  tagline: string | null;
  status: string;
  total_god_score: number | null;
  created_at: string;
}

export default function AdminActions() {
  const [rows, setRows] = useState<Startup[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const pageSize = 100;
  const [page, setPage] = useState(0);
  const [qFilter, setQFilter] = useState('');

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const load = async () => {
    setLoading(true);
    try {
      const { rows, count } = await adminRpc.listStartups({
        status: 'pending',
        q: qFilter,
        page,
        pageSize,
      });
      setRows(rows as Startup[]);
      setCount(count);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const ids = rows.map(s => s.id);
    if (selectedIds.size === ids.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(ids));
  };

  const bulkApprove = async () => {
    if (!selectedIds.size || !confirm(`Approve ${selectedIds.size} startups?\n\nThis sets status='approved' and writes admin_actions_log.`)) return;
    setProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      await adminRpc.setStartupStatus(ids, 'approved');
      alert(`✅ ${ids.length} startups approved`);
      await load();
    } catch (e: any) {
      alert(`❌ Approve failed: ${e?.message || String(e)}`);
    } finally {
      setProcessing(false);
    }
  };

  const bulkReject = async () => {
    if (!selectedIds.size || !confirm(`Reject ${selectedIds.size} startups?\n\nThis sets status='rejected' and writes admin_actions_log.`)) return;
    setProcessing(true);
    try {
      const ids = Array.from(selectedIds);
      await adminRpc.setStartupStatus(ids, 'rejected');
      alert(`✅ ${ids.length} startups rejected`);
      await load();
    } catch (e: any) {
      alert(`❌ Reject failed: ${e?.message || String(e)}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    void load();
  };

  // Client-side filter for display (within current page)
  const displayRows = rows.filter(s =>
    qFilter === '' || s.name.toLowerCase().includes(qFilter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-auto">
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white pl-20">⚠️ Danger Zone: Bulk Actions</h1>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="text-gray-400 hover:text-white">Home</Link>
            <Link to="/admin" className="text-gray-400 hover:text-white">Admin</Link>
            <Link to="/admin/edit-startups" className="text-cyan-400 hover:text-cyan-300">Edit Startups</Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* Stats */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold text-yellow-400">Bulk Operations (Pending Only)</div>
            <div className="text-gray-400 text-xs mt-1">
              {count} pending startups • Select startups below and approve/reject in bulk.
              All actions are logged to <code className="text-xs bg-gray-800 px-1 py-0.5 rounded">admin_actions_log</code>.
            </div>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={qFilter}
              onChange={e => setQFilter(e.target.value)}
              placeholder="Search by name..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700">
            Search
          </button>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs">
          <button onClick={selectAll} disabled={loading || !rows.length}
            className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30 disabled:opacity-50">
            {selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={bulkApprove} disabled={!selectedIds.size || processing}
            className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30 disabled:opacity-50">
            ✓ Approve ({selectedIds.size})
          </button>
          <button onClick={bulkReject} disabled={!selectedIds.size || processing}
            className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30 disabled:opacity-50">
            ✗ Reject ({selectedIds.size})
          </button>
          {processing && <span className="text-gray-500">⏳ Processing...</span>}
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading pending startups...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="w-10 px-4 py-2"></th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Tagline</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">GOD Score</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(s => (
                  <tr key={s.id} className={`border-t border-gray-700/50 hover:bg-gray-700/30 ${selectedIds.has(s.id) ? 'bg-blue-500/10' : ''}`}>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)}
                        className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                    </td>
                    <td className="px-4 py-2 text-white font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs max-w-md truncate">{s.tagline || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      {s.total_god_score !== null ? (
                        <span className="text-yellow-400 font-mono font-bold">{s.total_god_score.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs font-mono">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {displayRows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {rows.length === 0 ? 'No pending startups.' : 'No startups match your search.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-500">
            Page {page + 1} of {totalPages} • {count} total
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
