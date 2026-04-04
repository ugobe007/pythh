import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, CheckCircle, Clock, Settings, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { AdminPageHeader } from '../components/admin/AdminPageHeader';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/apiConfig';

interface Startup {
  id: string;
  name: string;
  tagline?: string | null;
  total_god_score: number | null;
  team_score?: number | null;
  traction_score?: number | null;
  market_score?: number | null;
  product_score?: number | null;
  vision_score?: number | null;
  status: string | null;
  created_at: string | null;
  updated_at?: string | null;
}

interface ScoreChange {
  startupId: string;
  startupName: string;
  oldScore: number;
  newScore: number;
  change: number;
  timestamp: string;
  component?: string;
}

interface AlgorithmBias {
  component: string;
  bias: 'high' | 'low' | 'normal';
  avgScore: number;
  count: number;
}

export default function GODScoresPage() {
  const navigate = useNavigate();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ avgScore: 0, topScore: 0, totalScored: 0 });
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>([]);
  const [algorithmBias, setAlgorithmBias] = useState<AlgorithmBias[]>([]);
  const [showBias, setShowBias] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'approved' | 'all'>('approved');

  useEffect(() => { 
    loadData();
    loadScoreChanges();
    loadAlgorithmBias();
    
    // Real-time auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadData();
        loadScoreChanges();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/god-scores?status=${statusFilter}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.startups;
      const error = json.error ? { message: json.error } : null;

      if (error) {
        console.error('Error loading GOD scores:', error);
        setStartups([]);
        setStats({ avgScore: 0, topScore: 0, totalScored: 0 });
      } else if (data) {
        setStartups(data);
        setStats(json.stats);
        setScoreChanges(json.scoreChanges || []);
        setAlgorithmBias(json.algorithmBias || []);
      } else {
        setStartups([]);
        setStats({ avgScore: 0, topScore: 0, totalScored: 0 });
      }
    } catch (error) {
      console.error('Error in loadData:', error);
      setStartups([]);
      setStats({ avgScore: 0, topScore: 0, totalScored: 0 });
    } finally {
      setLoading(false);
    }
  };

  const loadScoreChanges = async () => { /* data loaded in loadData */ };
  const loadAlgorithmBias = async () => { /* data loaded in loadData */ };

  const refresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-blue-400 font-bold';
    if (score >= 80) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-cyan-400';
    return 'text-red-400';
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="w-full">
      <AdminPageHeader
        maxWidthClass="max-w-[1800px]"
        icon={Sparkles}
        title="GOD Scores"
        subtitle="Live startup scoring and rankings — real-time table and score history"
        actions={
          <>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                autoRefresh
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-600/80'
              }`}
            >
              <Activity className="w-4 h-4" />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-600/80'
              }`}
            >
              {statusFilter === 'approved' ? 'Approved only' : 'All statuses'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/god-settings')}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all text-sm"
            >
              <Settings className="w-4 h-4" />
              Settings
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-600/80 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      <div className="max-w-[1800px] mx-auto px-4 pb-10 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 text-xs">
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700">
            <div className="text-xl font-bold font-mono text-blue-400">{stats.topScore}</div>
            <div className="text-gray-500 text-[10px]">Top Score</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700">
            <div className="text-xl font-bold font-mono text-cyan-400">{stats.avgScore}</div>
            <div className="text-gray-500 text-[10px]">Avg Score</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700">
            <div className="text-xl font-bold font-mono text-green-400">{stats.totalScored}</div>
            <div className="text-gray-500 text-[10px]">Scored</div>
          </div>
          <div className="col-span-2 bg-slate-800/40 rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-[10px] text-gray-400">
              <strong className="text-blue-400">Formula:</strong> Team (30%) + Traction (25%) + Market (20%) + Product (15%) + Pitch (10%)
            </div>
          </div>
        </div>

        {/* Score Legend */}
        <div className="flex gap-3 text-xs">
          <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-blue-400">90+ Elite</span>
          <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-400">80-89 Excellent</span>
          <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400">70-79 Good</span>
          <span className="px-2 py-1 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400">60-69 Average</span>
          <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400">&lt;60 Needs Work</span>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium w-16">#</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Startup</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Tagline</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">GOD Score</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium w-48">Bar</th>
                </tr>
              </thead>
              <tbody>
                {startups.map((s, idx) => (
                  <tr key={s.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-center text-gray-500 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2">
                      <Link to={`/startup/${s.id}`} className="text-white font-medium hover:text-cyan-400">{s.name}</Link>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-64">{s.tagline || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        s.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                        s.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{s.status}</span>
                    </td>
                    <td className={`px-4 py-2 text-right font-mono text-lg ${getScoreColor(s.total_god_score ?? 0)}`}>
                      {s.total_god_score ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          (s.total_god_score ?? 0) >= 90 ? 'bg-gradient-to-r from-blue-500 to-yellow-400' :
                          (s.total_god_score ?? 0) >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                          (s.total_god_score ?? 0) >= 70 ? 'bg-gradient-to-r from-cyan-500 to-blue-400' :
                          (s.total_god_score ?? 0) >= 60 ? 'bg-gradient-to-r from-blue-500 to-violet-400' :
                          'bg-gradient-to-r from-red-500 to-red-600'
                        }`} style={{ width: `${s.total_god_score ?? 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                {startups.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No scored startups found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Algorithm Bias Detection */}
        <div className="bg-slate-800/50 rounded-lg border border-yellow-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              Algorithm Bias Detection
            </h3>
            <button 
              onClick={() => setShowBias(!showBias)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {showBias ? 'Hide' : 'Show'}
            </button>
          </div>
          {showBias && (
            <div className="space-y-2">
              {algorithmBias.length > 0 ? (
                algorithmBias.map((bias, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-700/30 rounded border border-slate-600/30">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 font-medium">{bias.component}</span>
                      <span className="text-gray-500">({bias.count} scored)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Avg: {bias.avgScore}</span>
                      {bias.bias !== 'normal' && (
                        <div className={`flex items-center gap-1 ${
                          bias.bias === 'high' ? 'text-red-400' : 'text-cyan-400'
                        }`}>
                          <AlertCircle className="w-3 h-3" />
                          <span className="font-medium">{bias.bias === 'high' ? 'High Bias' : 'Low Bias'}</span>
                        </div>
                      )}
                      {bias.bias === 'normal' && (
                        <div className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          <span>Normal</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">No bias data available</div>
              )}
            </div>
          )}
        </div>

        {/* Score Change History */}
        <div className="bg-slate-800/50 rounded-lg border border-blue-500/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Recent Score Changes (Last 7 Days)
            </h3>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>
          {showHistory && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scoreChanges.length > 0 ? (
                scoreChanges.map((change) => (
                  <div key={change.startupId} className="flex items-center justify-between text-xs p-2 bg-slate-700/30 rounded border border-slate-600/30">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Link 
                        to={`/startup/${change.startupId}`}
                        className="text-gray-300 font-medium hover:text-cyan-400 truncate max-w-[200px]"
                      >
                        {change.startupName}
                      </Link>
                      {change.component && (
                        <span className="text-gray-500 text-[10px]">({change.component})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">{change.oldScore}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-white font-medium">{change.newScore}</span>
                      </div>
                      <div className={`flex items-center gap-1 ${
                        change.change > 0 ? 'text-green-400' : change.change < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {change.change > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : change.change < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : null}
                        <span className="font-medium">{change.change > 0 ? '+' : ''}{change.change}</span>
                      </div>
                      <span className="text-gray-500 text-[10px]">{formatTimeAgo(change.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">No recent score changes</div>
              )}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-slate-800/40 rounded-lg border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">⚡ Related Tools</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/admin/industry-rankings" className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30">📊 Industry Rankings</Link>
            <Link to="/admin/god-settings" className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 hover:bg-orange-500/30">⚙️ GOD Settings</Link>
            <Link to="/admin/ai-intelligence" className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 hover:bg-purple-500/30">🧠 AI Intelligence</Link>
            <Link to="/admin/health" className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/30">📊 Analytics</Link>
            <Link to="/admin/edit-startups" className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-600/30">✏️ Edit Startups</Link>
            <Link to="/matches" className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30">🔥 View Matches</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
