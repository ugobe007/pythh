import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { RefreshCw, Edit2, Trash2, Search, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
import { adminRpc } from '../services/adminRpc';
import { supabase } from '../lib/supabase';

interface StartupUpload {
  id: string;
  name: string;
  pitch: string | null;
  tagline: string | null;
  status: string | null;
  extracted_data: any;
  created_at: string | null;
  total_god_score?: number | null;
}

export default function EditStartups() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [rows, setRows] = useState<StartupUpload[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const pageSize = 100;
  const page = parseInt(searchParams.get('page') || '0', 10);
  const statusFilter = searchParams.get('status') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  useEffect(() => {
    void loadStartups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, searchQuery]);

  const loadStartups = async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? undefined : (statusFilter as 'pending' | 'approved' | 'rejected');
      const { rows, count } = await adminRpc.listStartups({
        status,
        q: searchQuery,
        page,
        pageSize,
      });
      setRows(rows as StartupUpload[]);
      setCount(count);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadStartups();
    setRefreshing(false);
  };

  const startEdit = (s: StartupUpload) => {
    setEditingId(s.id);
    setEditData({ name: s.name, tagline: s.tagline || '', status: s.status });
  };

  const saveEdit = async () => {
    if (!editingId || !editData) return;
    setSaving(true);
    try {
      await supabase.from('startup_uploads').update(editData).eq('id', editingId);
      await loadStartups();
      setEditingId(null);
      setEditData(null);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const deleteStartup = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await supabase.from('startup_uploads').delete().eq('id', id);
      await loadStartups();
    } catch (error) {
      alert('Delete failed');
    }
  };

  const updateSearchParams = (updates: Record<string, string | number>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v === '' || v === 'all' || v === 0) {
        newParams.delete(k);
      } else {
        newParams.set(k, String(v));
      }
    });
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem('search') as HTMLInputElement;
    updateSearchParams({ q: input.value, page: 0 });
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
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white pl-20">✏️ Edit Startups</h1>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="text-gray-400 hover:text-white">Home</Link>
            <Link to="/admin" className="text-gray-400 hover:text-white">Admin</Link>
            <Link to="/admin/discovered-startups" className="text-cyan-400 hover:text-cyan-300">Discovered</Link>
            <button onClick={refresh} className="text-gray-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              name="search"
              type="text"
              defaultValue={searchQuery}
              placeholder="Search by name..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </form>
          <select
            value={statusFilter}
            onChange={(e) => updateSearchParams({ status: e.target.value, page: 0 })}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Stats */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 px-4 py-3 flex items-center justify-between text-sm">
          <div className="text-gray-400">
            {count.toLocaleString()} total startups
            {statusFilter !== 'all' && ` (filtered by ${statusFilter})`}
            {searchQuery && ` (search: "${searchQuery}")`}
          </div>
          <div className="text-gray-500">
            Page {page + 1} of {totalPages}
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading startups...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Name</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Tagline</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">GOD</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Age</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr 
                    key={s.id} 
                    className="border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                    onClick={() => editingId !== s.id && navigate(`/startup/${s.id}`)}
                  >
                    <td className="px-4 py-2">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-white font-medium">{s.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === s.id ? (
                        <input
                          type="text"
                          value={editData.tagline}
                          onChange={(e) => setEditData({ ...editData, tagline: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                          maxLength={100}
                        />
                      ) : (
                        <span className="text-gray-400 text-xs max-w-md truncate block">
                          {s.tagline || s.pitch?.slice(0, 80) || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {editingId === s.id ? (
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="pending">pending</option>
                          <option value="approved">approved</option>
                          <option value="rejected">rejected</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          s.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{s.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center font-mono text-yellow-400 font-bold">
                      {s.total_god_score !== null ? s.total_god_score.toFixed(1) : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500 font-mono text-xs">
                      {formatTime(s.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                        {editingId === s.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded text-green-400"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 bg-gray-500/20 hover:bg-gray-500/30 rounded text-gray-400"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(s)}
                              className="p-1.5 hover:bg-blue-500/20 rounded text-blue-400"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => deleteStartup(s.id, s.name, e)}
                              className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No startups match your filters. Try adjusting your search or status filter.'
                      : 'No startups found.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-500">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, count)} of {count}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateSearchParams({ page: Math.max(0, page - 1) })}
              disabled={page === 0}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="px-3 py-1.5 text-gray-400">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => updateSearchParams({ page: Math.min(totalPages - 1, page + 1) })}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
