import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Download, ExternalLink, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminRpc } from '../services/adminRpc';

type Filter = 'all' | 'unimported' | 'imported';

interface DiscoveredStartup {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  funding_amount: string | null;
  funding_stage: string | null;
  article_url: string | null;
  rss_source: string | null;
  imported_to_startups: boolean | null;
  discovered_at: string | null;
}

export default function DiscoveredStartups() {
  const [rows, setRows] = useState<DiscoveredStartup[]>([]);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<Filter>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const pageSize = 100;
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  const load = async () => {
    setLoading(true);
    try {
      const { rows, count } = await adminRpc.listDiscoveredStartups({ filter, page, pageSize });
      setRows(rows as DiscoveredStartup[]);
      setCount(count);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unimportedRows = useMemo(() => rows.filter(r => !r.imported_to_startups), [rows]);

  const selectAll = () => {
    const ids = unimportedRows.map(s => s.id);
    if (selectedIds.size === ids.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(ids));
  };

  const exportCSV = () => {
    const selected = rows.filter(s => selectedIds.has(s.id));
    const csv = [
      ['Name', 'Website', 'Description', 'Funding', 'Stage', 'Source', 'Article URL'],
      ...selected.map(s => [
        s.name,
        s.website || '',
        s.description || '',
        s.funding_amount || '',
        s.funding_stage || '',
        s.rss_source || '',
        s.article_url || '',
      ]),
    ]
      .map(row => row.map(c => `"${String(c).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `discovered-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const importSelected = async () => {
    const selected = rows.filter(s => selectedIds.has(s.id));
    if (!selected.length) return;

    if (!confirm(`Import ${selected.length} startups?\n\nThis runs AI enrichment on the SERVER (safe) and inserts into startup_uploads as pending.`)) {
      return;
    }

    setImporting(true);
    setImportProgress({ current: 0, total: selected.length });

    try {
      const ids = selected.map(s => s.id);

      // Progress UI: update each completion (best-effort)
      // Server returns per-id results; we simulate progress by counting responses.
      const results = await adminRpc.importDiscoveredStartups(ids);
      setImportProgress({ current: results.length, total: selected.length });

      const ok = results.filter(r => r.ok).length;
      const fail = results.filter(r => !r.ok).length;

      alert(`Import complete.\n✅ ${ok} succeeded\n⚠️ ${fail} failed\n\nCheck Admin Actions Log for details.`);
      await load();
    } catch (e: any) {
      alert(`Import failed: ${e?.message || String(e)}`);
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0 });
      setSelectedIds(new Set());
    }
  };

  const formatTime = (d: string | null) => {
    if (!d) return '-';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-auto">
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white pl-20">🔍 RSS Discoveries</h1>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="text-gray-400 hover:text-white">Home</Link>
            <Link to="/admin" className="text-gray-400 hover:text-white">Admin</Link>
            <Link to="/admin/edit-startups" className="text-cyan-400 hover:text-cyan-300">Edit Startups</Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* Stats & Filters */}
        <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
          {[
            { label: 'All', value: count, color: 'text-white', f: 'all' as Filter },
            { label: 'Unimported', value: unimportedRows.length, color: 'text-yellow-400', f: 'unimported' as Filter },
            { label: 'Imported', value: count - unimportedRows.length, color: 'text-green-400', f: 'imported' as Filter },
          ].map((s, i) => (
            <button key={i} onClick={() => setFilter(s.f)}
              className={`bg-gray-800/50 rounded-lg px-4 py-3 border text-left transition-all ${
                filter === s.f ? 'border-cyan-500/50 bg-cyan-600/10' : 'border-gray-700 hover:border-gray-600'
              }`}>
              <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
              <div className="text-gray-500 text-xs">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 text-xs">
          <button onClick={selectAll} disabled={unimportedRows.length === 0}
            className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30 disabled:opacity-50">
            {selectedIds.size > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <button onClick={exportCSV} disabled={!selectedIds.size}
            className="px-4 py-2 bg-violet-500/20 border border-violet-500/30 rounded text-violet-400 hover:bg-violet-500/30 disabled:opacity-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV ({selectedIds.size})
          </button>
          <button onClick={importSelected} disabled={!selectedIds.size || importing}
            className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-2">
            {importing ? (
              <>⏳ Importing... {importProgress.current}/{importProgress.total}</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Import with AI Enrichment ({selectedIds.size})</>
            )}
          </button>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading discovered startups...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="w-10 px-4 py-2"></th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Startup</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Description</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Funding</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Source</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Age</th>
                  <th className="w-16 px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={`border-t border-gray-700/50 hover:bg-gray-700/30 ${selectedIds.has(s.id) ? 'bg-blue-500/10' : ''}`}>
                    <td className="px-4 py-2 text-center">
                      {!s.imported_to_startups && (
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)}
                          className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500" />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-white font-medium">{s.name}</div>
                      {s.website && (
                        <a href={s.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="text-xs text-gray-500 hover:text-blue-400 truncate block max-w-xs">
                          {s.website.replace(/https?:\/\//, '')}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs max-w-md truncate">{s.description || '-'}</td>
                    <td className="px-4 py-2">
                      {s.funding_amount && <span className="text-green-400 text-xs font-mono">{s.funding_amount}</span>}
                      {s.funding_stage && <span className="text-gray-500 text-xs ml-1">({s.funding_stage})</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-32">{s.rss_source || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        s.imported_to_startups ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {s.imported_to_startups ? '✓ imported' : 'new'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 text-xs font-mono">{formatTime(s.discovered_at)}</td>
                    <td className="px-4 py-2 text-center">
                      {s.article_url && (
                        <a href={s.article_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="p-1 hover:bg-blue-500/20 rounded text-blue-400 inline-block" title="View Article">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {filter === 'imported' ? 'No imported startups yet.' : filter === 'unimported' ? 'No unimported startups.' : 'No discovered startups. Run RSS scrapers to discover new startups.'}
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
