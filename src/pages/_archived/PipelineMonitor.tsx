import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Activity, Zap, Database, TrendingUp, Clock, CheckCircle2, 
  AlertCircle, RefreshCw, Rocket, Users, ArrowRight, Radio, ExternalLink
} from 'lucide-react';

interface PipelineStats {
  approvedStartups: number;
  totalMatches: number;
  pendingDiscoveries: number;
  recentlyApproved: number;
  recentMatches: number;
  avgMatchScore: number;
  lastActivity: string | null;
}

interface RecentActivity {
  id: string;
  name: string;
  type: 'discovery' | 'approval' | 'match';
  timestamp: string;
  details: string;
}

export default function PipelineMonitor() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchStats = async () => {
    try {
      const [
        startupsRes,
        matchesRes,
        pendingRes,
        recentStartupsRes,
        recentMatchesRes,
        avgScoreRes
      ] = await Promise.all([
        supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
        supabase.from('discovered_startups').select('*', { count: 'exact', head: true }).or('imported_to_startups.eq.false,imported_to_startups.is.null'),
        supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('startup_investor_matches').select('match_score').limit(1000)
      ]);

      // Get last activity time
      const { data: lastStartup } = await supabase
        .from('startup_uploads')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const avgScore = avgScoreRes.data?.length 
        ? avgScoreRes.data.reduce((sum, m) => sum + (m.match_score || 0), 0) / avgScoreRes.data.length 
        : 0;

      setStats({
        approvedStartups: startupsRes.count || 0,
        totalMatches: matchesRes.count || 0,
        pendingDiscoveries: pendingRes.count || 0,
        recentlyApproved: recentStartupsRes.count || 0,
        recentMatches: recentMatchesRes.count || 0,
        avgMatchScore: avgScore,
        lastActivity: lastStartup?.created_at || null
      });

      // Fetch recent activity
      const { data: recentStartups } = await supabase
        .from('startup_uploads')
        .select('id, name, created_at, total_god_score, sectors')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);

      const activities: RecentActivity[] = (recentStartups || [])
        .filter((s): s is typeof s & { created_at: string } => !!s.created_at)
        .map(s => ({
          id: s.id,
          name: s.name,
          type: 'approval' as const,
          timestamp: s.created_at,
          details: `GOD Score: ${s.total_god_score || 'N/A'} | Sectors: ${(s.sectors || []).slice(0, 2).join(', ') || 'None'}`
        }));

      setRecentActivity(activities);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching pipeline stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 10 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchStats, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getPipelineStatus = () => {
    if (!stats) return { status: 'loading', color: 'gray', text: 'Loading...' };
    if (stats.pendingDiscoveries > 50) return { status: 'busy', color: 'yellow', text: 'Processing Queue' };
    if (stats.recentlyApproved > 0) return { status: 'active', color: 'green', text: 'Actively Processing' };
    return { status: 'idle', color: 'cyan', text: 'Ready & Waiting' };
  };

  const pipelineStatus = getPipelineStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading pipeline data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Radio className="w-8 h-8 text-cyan-400" />
              Pipeline Monitor
            </h1>
            <p className="text-gray-400 mt-1">Real-time view of the zero-touch startup pipeline</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                autoRefresh 
                  ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
                  : 'bg-gray-700 border border-gray-600 text-gray-400'
              }`}
            >
              <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 hover:bg-cyan-500/30 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Pipeline Status Banner */}
        <div className={`mb-8 p-6 rounded-xl border ${
          pipelineStatus.status === 'active' ? 'bg-green-500/10 border-green-500/30' :
          pipelineStatus.status === 'busy' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-cyan-500/10 border-cyan-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${
                pipelineStatus.status === 'active' ? 'bg-green-400 animate-pulse' :
                pipelineStatus.status === 'busy' ? 'bg-yellow-400 animate-pulse' :
                'bg-cyan-400'
              }`} />
              <div>
                <h2 className={`text-xl font-bold ${
                  pipelineStatus.status === 'active' ? 'text-green-400' :
                  pipelineStatus.status === 'busy' ? 'text-yellow-400' :
                  'text-cyan-400'
                }`}>
                  {pipelineStatus.text}
                </h2>
                <p className="text-gray-400 text-sm">
                  Last refresh: {lastRefresh.toLocaleTimeString()}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-gray-400 text-sm">Last activity</p>
              <p className="text-white font-mono">
                {stats?.lastActivity ? formatTimeAgo(stats.lastActivity) : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Flow Diagram */}
        <div className="mb-8 bg-gray-800/50 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">🔄 Automatic Pipeline Flow</h3>
          
          <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4">
            {/* Step 1: RSS Scraper */}
            <div className="flex-shrink-0 text-center">
              <div className="w-20 h-20 bg-cyan-600/20 border border-cyan-500/50 rounded-xl flex items-center justify-center mb-2 mx-auto">
                <Zap className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-cyan-400 font-semibold text-sm">RSS Scraper</p>
              <p className="text-gray-500 text-xs">Discovers startups</p>
            </div>
            
            <ArrowRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
            
            {/* Step 2: Auto-Enrich */}
            <div className="flex-shrink-0 text-center">
              <div className="w-20 h-20 bg-purple-500/20 border border-purple-500/50 rounded-xl flex items-center justify-center mb-2 mx-auto">
                <Database className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-purple-400 font-semibold text-sm">Auto-Enrich</p>
              <p className="text-gray-500 text-xs">Infers sectors</p>
            </div>
            
            <ArrowRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
            
            {/* Step 3: Auto-Approve */}
            <div className="flex-shrink-0 text-center">
              <div className="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center justify-center mb-2 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-green-400 font-semibold text-sm">Auto-Approve</p>
              <p className="text-gray-500 text-xs">Quality check</p>
            </div>
            
            <ArrowRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
            
            {/* Step 4: Match Generation */}
            <div className="flex-shrink-0 text-center">
              <div className="w-20 h-20 bg-cyan-500/20 border border-cyan-500/50 rounded-xl flex items-center justify-center mb-2 mx-auto">
                <Users className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-cyan-400 font-semibold text-sm">Match Gen</p>
              <p className="text-gray-500 text-xs">~200 matches</p>
            </div>
            
            <ArrowRight className="w-6 h-6 text-gray-600 flex-shrink-0" />
            
            {/* Step 5: Live */}
            <div className="flex-shrink-0 text-center">
              <div className="w-20 h-20 bg-pink-500/20 border border-pink-500/50 rounded-xl flex items-center justify-center mb-2 mx-auto">
                <Rocket className="w-8 h-8 text-pink-400" />
              </div>
              <p className="text-pink-400 font-semibold text-sm">Live!</p>
              <p className="text-gray-500 text-xs">Ready to match</p>
            </div>
          </div>
        </div>

        {/* Stats Grid - Clickable with Gradients */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link to="/admin/edit-startups" className="bg-gradient-to-br from-cyan-900/50 to-cyan-950/50 hover:from-cyan-800/60 hover:to-cyan-900/60 rounded-xl border border-cyan-500/30 p-6 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Rocket className="w-5 h-5 text-cyan-400" />
                <span className="text-gray-400 text-sm">Approved Startups</span>
              </div>
              <ExternalLink size={14} className="text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white">{stats?.approvedStartups.toLocaleString()}</p>
            {stats?.recentlyApproved ? (
              <p className="text-green-400 text-sm mt-1">+{stats.recentlyApproved} today</p>
            ) : null}
          </Link>
          
          <Link to="/admin/analytics" className="bg-gradient-to-br from-pink-900/50 to-pink-950/50 hover:from-pink-800/60 hover:to-pink-900/60 rounded-xl border border-pink-500/30 p-6 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-pink-400" />
                <span className="text-gray-400 text-sm">Total Matches</span>
              </div>
              <ExternalLink size={14} className="text-pink-500/50 group-hover:text-pink-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white">{stats?.totalMatches.toLocaleString()}</p>
            {stats?.recentMatches ? (
              <p className="text-green-400 text-sm mt-1">+{stats.recentMatches.toLocaleString()} today</p>
            ) : null}
          </Link>
          
          <Link to="/admin/review" className="bg-gradient-to-br from-yellow-900/50 to-yellow-950/50 hover:from-yellow-800/60 hover:to-yellow-900/60 rounded-xl border border-yellow-500/30 p-6 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <span className="text-gray-400 text-sm">Pending Queue</span>
              </div>
              <ExternalLink size={14} className="text-yellow-500/50 group-hover:text-yellow-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white">{stats?.pendingDiscoveries}</p>
            <p className="text-gray-500 text-sm mt-1">awaiting processing</p>
          </Link>
          
          <Link to="/admin/god-scores" className="bg-gradient-to-br from-green-900/50 to-green-950/50 hover:from-green-800/60 hover:to-green-900/60 rounded-xl border border-green-500/30 p-6 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-gray-400 text-sm">Avg Match Score</span>
              </div>
              <ExternalLink size={14} className="text-green-500/50 group-hover:text-green-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white">{stats?.avgMatchScore.toFixed(1)}%</p>
            <p className="text-gray-500 text-sm mt-1">quality indicator</p>
          </Link>
        </div>

        {/* Recent Activity - Clickable Items */}
        <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 rounded-xl border border-gray-700/50">
          <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Recent Auto-Approvals
            </h3>
            <Link to="/admin/discovered-startups" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="divide-y divide-gray-700/30">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              recentActivity.map((activity) => (
                <Link 
                  key={activity.id} 
                  to={`/startup/${activity.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                    <div>
                      <p className="text-white font-medium group-hover:text-cyan-400 transition-colors">{activity.name}</p>
                      <p className="text-gray-500 text-sm">{activity.details}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                    <ExternalLink size={14} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Quick Links - Enhanced */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/admin/health" className="p-4 bg-gradient-to-br from-cyan-900/40 to-cyan-950/40 rounded-xl border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group">
            <Activity className="w-6 h-6 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">System Health</p>
            <p className="text-gray-500 text-sm">Full diagnostics</p>
          </Link>
          
          <Link to="/admin/discovered-startups" className="p-4 bg-gradient-to-br from-slate-800/40 to-slate-900/40 rounded-xl border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all group">
            <Zap className="w-6 h-6 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">RSS Discoveries</p>
            <p className="text-gray-500 text-sm">View scraped data</p>
          </Link>
          
          <Link to="/admin/rss-manager" className="p-4 bg-gradient-to-br from-purple-900/40 to-purple-950/40 rounded-xl border border-purple-500/30 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group">
            <Database className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">RSS Sources</p>
            <p className="text-gray-500 text-sm">Manage feeds</p>
          </Link>
          
          <Link to="/admin/ai-logs" className="p-4 bg-gradient-to-br from-green-900/40 to-green-950/40 rounded-xl border border-green-500/30 hover:border-green-400/50 hover:shadow-lg hover:shadow-green-500/10 transition-all group">
            <CheckCircle2 className="w-6 h-6 text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-white font-medium">AI Logs</p>
            <p className="text-gray-500 text-sm">System events</p>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}
