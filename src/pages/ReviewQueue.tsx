/**
 * Admin Review Queue - Full-featured startup review with detail panel
 * Approve/reject with one click, preview details, adjust GOD scores
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Search, Check, X, Trash2,
  ExternalLink, Globe, ArrowLeft, Eye, ChevronDown, ChevronUp,
  Sparkles, RefreshCw, Filter, AlertCircle, TrendingUp, Users,
  Target, Lightbulb, Zap, BarChart3, Save
} from 'lucide-react';
import { adminRpc } from '../services/adminRpc';

interface StartupRow {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  status: string;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
  source_type: string | null;
  website: string | null;
  sectors: string[] | null;
  created_at: string;
}

interface StartupDetail {
  [key: string]: any;
}

const SCORE_COMPONENTS = [
  { key: 'team_score', label: 'Team', icon: Users, color: 'cyan' },
  { key: 'traction_score', label: 'Traction', icon: TrendingUp, color: 'green' },
  { key: 'market_score', label: 'Market', icon: Target, color: 'purple' },
  { key: 'product_score', label: 'Product', icon: Zap, color: 'blue' },
  { key: 'vision_score', label: 'Vision', icon: Lightbulb, color: 'amber' },
] as const;

const EXTRA_SCORES = [
  { key: 'ecosystem_score', label: 'Ecosystem' },
  { key: 'grit_score', label: 'Grit' },
  { key: 'problem_validation_score', label: 'Problem Validation' },
] as const;

export default function ReviewQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = (searchParams.get('status') as any) || 'pending';

  const [rows, setRows] = useState<StartupRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Detail panel state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StartupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Score editing
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [scoreSaving, setScoreSaving] = useState(false);
  const [showExtraScores, setShowExtraScores] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  // Action feedback  
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, count } = await adminRpc.listStartups({
        status: statusFilter,
        q: searchQuery,
        page,
        pageSize,
      });
      setRows(rows as StartupRow[]);
      setCount(count);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Load detail when selecting a startup
  const selectStartup = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const data = await adminRpc.getStartupDetail(id);
      setDetail(data);
      // Pre-fill score editors
      setEditScores({
        total_god_score: data.total_god_score ?? 0,
        team_score: data.team_score ?? 0,
        traction_score: data.traction_score ?? 0,
        market_score: data.market_score ?? 0,
        product_score: data.product_score ?? 0,
        vision_score: data.vision_score ?? 0,
        ecosystem_score: data.ecosystem_score ?? 50,
        grit_score: data.grit_score ?? 50,
        problem_validation_score: data.problem_validation_score ?? 50,
      });
    } catch (e) {
      console.error('Failed to load detail:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  // Quick actions
  const approveOne = async (id: string, name: string) => {
    try {
      await adminRpc.setStartupStatus([id], 'approved');
      showToast(`✓ ${name} approved`);
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    }
  };

  const rejectOne = async (id: string, name: string) => {
    try {
      await adminRpc.setStartupStatus([id], 'rejected');
      showToast(`✗ ${name} rejected`);
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    }
  };

  const deleteOne = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" permanently? This cannot be undone.`)) return;
    try {
      await adminRpc.deleteStartup(id);
      showToast(`🗑 ${name} deleted`);
      if (selectedId === id) { setSelectedId(null); setDetail(null); }
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    }
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };

  const bulkAction = async (action: 'approved' | 'rejected') => {
    if (!selectedIds.size) return;
    const label = action === 'approved' ? 'approve' : 'reject';
    if (!confirm(`${label} ${selectedIds.size} startups?`)) return;
    setProcessing(true);
    try {
      await adminRpc.setStartupStatus(Array.from(selectedIds), action);
      showToast(`✓ ${selectedIds.size} startups ${action}`);
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} startups permanently?`)) return;
    setProcessing(true);
    try {
      for (const id of selectedIds) {
        await adminRpc.deleteStartup(id);
      }
      showToast(`🗑 ${selectedIds.size} startups deleted`);
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Save GOD score override  
  const saveScores = async () => {
    if (!selectedId || !detail) return;
    setScoreSaving(true);
    try {
      await adminRpc.updateGodScore(selectedId, editScores as any);
      showToast(`Scores updated for ${detail.name}`);
      // Reload detail
      const updated = await adminRpc.getStartupDetail(selectedId);
      setDetail(updated);
      // Update row in list
      setRows(prev => prev.map(r => r.id === selectedId ? { ...r, total_god_score: editScores.total_god_score, ...editScores } as any : r));
    } catch (e: any) {
      showToast(`Failed: ${e.message}`, 'error');
    } finally {
      setScoreSaving(false);
    }
  };

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-slate-500';
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-300' : 'bg-red-900/90 border-red-500/50 text-red-300'
        } animate-slide-in`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-800 bg-[#0a0a0a]/95 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Startup Review Queue</h1>
              <p className="text-xs text-slate-400">{count} startups • {statusFilter} filter</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status filter tabs */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 text-xs">
              {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(0); setSelectedId(null); setDetail(null); }}
                  className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
                    statusFilter === s ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button onClick={() => load()} className="p-2 text-slate-400 hover:text-white transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1800px] mx-auto px-4 py-4 flex gap-4" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Left: Startup list */}
        <div className={`flex flex-col ${selectedId ? 'w-1/2' : 'w-full'} transition-all`}>
          {/* Search + Bulk actions */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && load()}
                placeholder="Search startups..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button onClick={selectAll} className="px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
              {selectedIds.size > 0 ? `Deselect (${selectedIds.size})` : 'Select All'}
            </button>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-slate-800/80 border border-slate-700 rounded-lg">
              <span className="text-xs text-slate-400 mr-2">{selectedIds.size} selected:</span>
              <button onClick={() => bulkAction('approved')} disabled={processing}
                className="px-3 py-1.5 text-xs bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1">
                <Check className="w-3 h-3" /> Approve
              </button>
              <button onClick={() => bulkAction('rejected')} disabled={processing}
                className="px-3 py-1.5 text-xs bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1">
                <X className="w-3 h-3" /> Reject
              </button>
              <button onClick={bulkDelete} disabled={processing}
                className="px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/20 rounded text-red-400/70 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
              {processing && <span className="text-xs text-slate-500 ml-2">Processing...</span>}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto bg-slate-800/30 border border-slate-700 rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-500">Loading...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-800/80 sticky top-0">
                  <tr>
                    <th className="w-8 px-2 py-2"></th>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Name</th>
                    <th className="text-center px-2 py-2 text-slate-400 font-medium text-xs w-16">GOD</th>
                    <th className="text-center px-2 py-2 text-slate-400 font-medium text-xs w-20">Status</th>
                    <th className="text-center px-2 py-2 text-slate-400 font-medium text-xs w-16">Source</th>
                    <th className="text-right px-3 py-2 text-slate-400 font-medium text-xs w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(s => (
                    <tr
                      key={s.id}
                      className={`border-t border-slate-700/30 hover:bg-slate-700/20 cursor-pointer transition-colors ${
                        selectedId === s.id ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : ''
                      } ${selectedIds.has(s.id) ? 'bg-blue-500/5' : ''}`}
                    >
                      <td className="px-2 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)}
                          className="w-3.5 h-3.5 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2" onClick={() => selectStartup(s.id)}>
                        <div className="font-medium text-white truncate max-w-[250px]">{s.name}</div>
                        {s.tagline && <div className="text-xs text-slate-500 truncate max-w-[250px]">{s.tagline}</div>}
                      </td>
                      <td className="px-2 py-2 text-center" onClick={() => selectStartup(s.id)}>
                        <span className={`font-mono font-bold text-sm ${scoreColor(s.total_god_score)}`}>
                          {s.total_god_score ?? '-'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center" onClick={() => selectStartup(s.id)}>
                        <span className={`px-2 py-0.5 rounded text-xs border ${statusBadge(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-slate-500" onClick={() => selectStartup(s.id)}>
                        {s.source_type || '-'}
                      </td>
                      <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => selectStartup(s.id)} title="Preview"
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {s.status !== 'approved' && (
                            <button onClick={() => approveOne(s.id, s.name)} title="Approve"
                              className="p-1.5 rounded hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {s.status !== 'rejected' && (
                            <button onClick={() => rejectOne(s.id, s.name)} title="Reject"
                              className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => deleteOne(s.id, s.name)} title="Delete"
                            className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400/70 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-slate-500 text-sm">
                      No startups found
                    </td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs">
            <span className="text-slate-500">Page {page + 1}/{totalPages} • {count} total</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 flex items-center gap-1">
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        {selectedId && (
          <div className="w-1/2 flex flex-col overflow-auto border border-slate-700 rounded-lg bg-slate-800/30">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full text-slate-500">Loading details...</div>
            ) : detail ? (
              <>
                {/* Detail Header */}
                <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 p-4 z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold text-white truncate">{detail.name}</h2>
                      {detail.tagline && <p className="text-xs text-slate-400 mt-0.5 truncate">{detail.tagline}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`px-2 py-0.5 rounded text-xs border ${statusBadge(detail.status)}`}>
                          {detail.status}
                        </span>
                        {detail.source_type && <span className="text-xs text-slate-500">{detail.source_type}</span>}
                        {detail.sectors?.length > 0 && (
                          <span className="text-xs text-slate-500">{detail.sectors.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 ml-3">
                      {detail.status !== 'approved' && (
                        <button onClick={() => approveOne(detail.id, detail.name)}
                          className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30 text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {detail.status !== 'rejected' && (
                        <button onClick={() => rejectOne(detail.id, detail.name)}
                          className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded text-red-400 hover:bg-red-500/30 text-xs flex items-center gap-1">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      )}
                      <button onClick={() => { setSelectedId(null); setDetail(null); }}
                        className="p-1.5 text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detail Content (scrollable) */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Links */}
                  {(detail.website || detail.source_url) && (
                    <div className="flex gap-2">
                      {detail.website && (
                        <a href={detail.website} target="_blank" rel="noreferrer"
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> {detail.website}
                        </a>
                      )}
                      {detail.source_url && (
                        <a href={detail.source_url} target="_blank" rel="noreferrer"
                          className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Source article
                        </a>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {detail.description && (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs font-medium text-slate-400 mb-1">Description</div>
                      <p className="text-sm text-slate-300 leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {/* GOD Score Panel - EDITABLE */}
                  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-bold text-white">GOD Score</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold font-mono ${scoreColor(editScores.total_god_score)}`}>
                          {editScores.total_god_score}
                        </span>
                        <span className="text-xs text-slate-500">/100</span>
                      </div>
                    </div>

                    {/* Total GOD Score slider */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400">Total (override)</label>
                        <input
                          type="number"
                          value={editScores.total_god_score}
                          onChange={e => setEditScores(prev => ({ ...prev, total_god_score: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                          className="w-16 text-right bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <input
                        type="range"
                        min={0} max={100}
                        value={editScores.total_god_score}
                        onChange={e => setEditScores(prev => ({ ...prev, total_god_score: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                    </div>

                    {/* Component scores */}
                    <div className="space-y-2">
                      {SCORE_COMPONENTS.map(({ key, label, icon: Icon }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="text-xs text-slate-400 w-16">{label}</span>
                          <div className="flex-1 relative">
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full transition-all"
                                style={{ width: `${editScores[key] || 0}%` }}
                              />
                            </div>
                          </div>
                          <input
                            type="number"
                            value={editScores[key] || 0}
                            onChange={e => setEditScores(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                            className="w-12 text-right bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Extra scores toggle */}
                    <button
                      onClick={() => setShowExtraScores(!showExtraScores)}
                      className="mt-2 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {showExtraScores ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showExtraScores ? 'Hide' : 'Show'} extra scores
                    </button>

                    {showExtraScores && (
                      <div className="mt-2 space-y-2">
                        {EXTRA_SCORES.map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 w-28">{label}</span>
                            <div className="flex-1 relative">
                              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full transition-all"
                                  style={{ width: `${editScores[key] || 0}%` }}
                                />
                              </div>
                            </div>
                            <input
                              type="number"
                              value={editScores[key] || 0}
                              onChange={e => setEditScores(prev => ({ ...prev, [key]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                              className="w-12 text-right bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Save button */}
                    <button
                      onClick={saveScores}
                      disabled={scoreSaving}
                      className="mt-3 w-full py-2 bg-amber-500/20 border border-amber-500/40 rounded-lg text-amber-400 hover:bg-amber-500/30 text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {scoreSaving ? 'Saving...' : 'Save Score Override'}
                    </button>
                  </div>

                  {/* Signals */}
                  {(detail.signals_bonus > 0 || detail.psychological_bonus > 0) && (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-slate-400 mb-2">Signals</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {[
                          { label: 'Signals Bonus', value: detail.signals_bonus },
                          { label: 'Psychological', value: detail.psychological_bonus },
                          { label: 'Product Velocity', value: detail.product_velocity_signal },
                          { label: 'Funding Accel', value: detail.funding_acceleration_signal },
                          { label: 'Customer Adopt', value: detail.customer_adoption_signal },
                          { label: 'Market Momentum', value: detail.market_momentum_signal },
                        ].filter(s => s.value > 0).map(s => (
                          <div key={s.label} className="bg-slate-700/50 rounded p-1.5 text-center">
                            <div className="text-white font-mono">{s.value}</div>
                            <div className="text-slate-500 text-[10px]">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Metrics */}
                  <div className="bg-slate-800/50 rounded-lg p-3">
                    <h4 className="text-xs font-medium text-slate-400 mb-2">Key Info</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {[
                        { label: 'Stage', value: detail.stage },
                        { label: 'Location', value: detail.location },
                        { label: 'Team Size', value: detail.team_size > 1 ? detail.team_size : null },
                        { label: 'Revenue (Annual)', value: detail.revenue_annual ? `$${detail.revenue_annual.toLocaleString()}` : null },
                        { label: 'MRR', value: detail.mrr ? `$${detail.mrr.toLocaleString()}` : null },
                        { label: 'Growth Rate', value: detail.growth_rate_monthly ? `${detail.growth_rate_monthly}%/mo` : null },
                        { label: 'Raise Amount', value: detail.raise_amount },
                        { label: 'Raise Type', value: detail.raise_type },
                        { label: 'Latest Funding', value: detail.latest_funding_amount ? `$${Number(detail.latest_funding_amount).toLocaleString()}` : null },
                        { label: 'Funding Round', value: detail.latest_funding_round },
                        { label: 'Tech CoFounder', value: detail.has_technical_cofounder ? 'Yes' : null },
                        { label: 'Launched', value: detail.is_launched ? 'Yes' : null },
                        { label: 'Has Revenue', value: detail.has_revenue ? 'Yes' : null },
                        { label: 'Customers', value: detail.customer_count },
                      ].filter(m => m.value).map(m => (
                        <div key={m.label} className="flex justify-between py-0.5">
                          <span className="text-slate-500">{m.label}</span>
                          <span className="text-slate-300">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extracted Data */}
                  {detail.extracted_data && typeof detail.extracted_data === 'object' && (
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <h4 className="text-xs font-medium text-slate-400 mb-2">Extracted Data</h4>
                      <pre className="text-[11px] text-slate-400 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                        {JSON.stringify(detail.extracted_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="text-[10px] text-slate-600 space-y-0.5">
                    <div>ID: {detail.id}</div>
                    <div>Created: {new Date(detail.created_at).toLocaleString()}</div>
                    {detail.reviewed_at && <div>Reviewed: {new Date(detail.reviewed_at).toLocaleString()}</div>}
                    {detail.discovery_event_id && <div>Event: {detail.discovery_event_id}</div>}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Select a startup to preview</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
