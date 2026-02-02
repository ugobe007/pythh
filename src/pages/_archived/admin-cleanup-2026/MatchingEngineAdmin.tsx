/**
 * MATCHING ENGINE ADMIN - Backend View
 * Admin/backend view of the matching engine with detailed metrics, controls, and diagnostics
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Target, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Activity,
  Database,
  Zap,
  Filter,
  Download,
  Play,
  Pause,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_BASE } from '../lib/apiConfig';

interface MatchStats {
  totalMatches: number;
  totalStartups: number;
  totalInvestors: number;
  avgMatchScore: number;
  highQualityMatches: number;
  matchesLast24h: number;
  matchesLastHour: number;
  queueStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

interface MatchQualityDistribution {
  excellent: number; // 80-100
  good: number; // 60-79
  fair: number; // 40-59
  poor: number; // 0-39
}

export default function MatchingEngineAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<MatchStats>({
    totalMatches: 0,
    totalStartups: 0,
    totalInvestors: 0,
    avgMatchScore: 0,
    highQualityMatches: 0,
    matchesLast24h: 0,
    matchesLastHour: 0,
    queueStatus: { pending: 0, processing: 0, completed: 0, failed: 0 }
  });
  const [qualityDistribution, setQualityDistribution] = useState<MatchQualityDistribution>({
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [expandedStartups, setExpandedStartups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setRefreshing(true);

      // Load all stats in parallel - use efficient queries
      const [
        matchesCountRes,
        matchesSampleRes,
        startupsRes,
        investorsRes,
        queueRes,
        recentMatchesRes
      ] = await Promise.all([
        // Total count only
        supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
        // Sample for stats calculation (limit to avoid memory issues)
        supabase.from('startup_investor_matches')
          .select('match_score, created_at')
          .order('created_at', { ascending: false })
          .limit(10000), // Sample last 10k matches for stats
        supabase.from('startup_uploads').select('id', { count: 'exact' }).eq('status', 'approved'),
        supabase.from('investors').select('id', { count: 'exact' }).eq('status', 'active'),
        supabase.from('matching_queue').select('status'),
        // Recent matches - query without foreign key joins first (more reliable with RLS)
        supabase
          .from('startup_investor_matches')
          .select(`
            id,
            match_score,
            confidence_level,
            created_at,
            startup_id,
            investor_id
          `)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      // Get matches for time-based stats (use efficient queries)
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      // Query for matches in last 24h and 1h separately (more efficient)
      const [matches24hRes, matches1hRes] = await Promise.all([
        supabase
          .from('startup_investor_matches')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', last24h),
        supabase
          .from('startup_investor_matches')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', lastHour)
      ]);

      const matches24h = matches24hRes.count || 0;
      const matches1h = matches1hRes.count || 0;
      
      // Use sample for stats calculation
      const matches = matchesSampleRes.data || [];
      const scores = matches.map((m: any) => parseFloat(m.match_score) || 0).filter(s => s > 0);
      const avgScore = scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0;

      // Quality distribution - scale from sample to total
      const totalMatches = matchesCountRes.count || 0;
      const sampleSize = matches.length;
      const scaleFactor = sampleSize > 0 ? totalMatches / sampleSize : 1;

      const distribution: MatchQualityDistribution = {
        excellent: Math.round(scores.filter(s => s >= 80).length * scaleFactor),
        good: Math.round(scores.filter(s => s >= 60 && s < 80).length * scaleFactor),
        fair: Math.round(scores.filter(s => s >= 40 && s < 60).length * scaleFactor),
        poor: Math.round(scores.filter(s => s < 40).length * scaleFactor)
      };

      // Queue status
      const queueStatus = {
        pending: queueRes.data?.filter((q: any) => q.status === 'pending').length || 0,
        processing: queueRes.data?.filter((q: any) => q.status === 'processing').length || 0,
        completed: queueRes.data?.filter((q: any) => q.status === 'completed').length || 0,
        failed: queueRes.data?.filter((q: any) => q.status === 'failed').length || 0
      };

      // High quality matches count (70+)
      const highQualityCount = Math.round(scores.filter(s => s >= 70).length * scaleFactor);

      setStats({
        totalMatches: totalMatches,
        totalStartups: startupsRes.count || 0,
        totalInvestors: investorsRes.count || 0,
        avgMatchScore: Math.round(avgScore * 10) / 10,
        highQualityMatches: highQualityCount,
        matchesLast24h: matches24h,
        matchesLastHour: matches1h,
        queueStatus
      });

      setQualityDistribution(distribution);
      
      // Process recent matches - always fetch related data separately to avoid RLS issues
      const recentMatchesData = recentMatchesRes.data || [];
      
      if (recentMatchesData.length > 0) {
        // Get unique startup and investor IDs
        const startupIds = [...new Set(recentMatchesData.map((m: any) => m.startup_id).filter(Boolean))];
        const investorIds = [...new Set(recentMatchesData.map((m: any) => m.investor_id).filter(Boolean))];
        
        // Fetch startup and investor details separately (avoids RLS join issues)
        const [startupsRes, investorsRes] = await Promise.all([
          startupIds.length > 0 
            ? supabase
                .from('startup_uploads')
                .select('id, name')
                .in('id', startupIds)
            : Promise.resolve({ data: [], error: null }),
          investorIds.length > 0
            ? supabase
                .from('investors')
                .select('id, name, firm')
                .in('id', investorIds)
            : Promise.resolve({ data: [], error: null })
        ]);
        
        // Log any errors from related table queries
        if (startupsRes.error) {
          console.warn('⚠️ Error fetching startup details:', startupsRes.error);
        }
        if (investorsRes.error) {
          console.warn('⚠️ Error fetching investor details:', investorsRes.error);
        }
        
        // Create lookup maps
        const startupsMap = new Map((startupsRes.data || []).map((s: any) => [s.id, s]));
        const investorsMap = new Map((investorsRes.data || []).map((i: any) => [i.id, i]));
        
        // Combine match data with startup and investor details
        const processedMatches = recentMatchesData.map((match: any) => ({
          ...match,
          startup_uploads: startupsMap.get(match.startup_id) || { 
            id: match.startup_id, 
            name: `Startup ${match.startup_id?.substring(0, 8)}...` 
          },
          investors: investorsMap.get(match.investor_id) || { 
            id: match.investor_id, 
            name: `Investor ${match.investor_id?.substring(0, 8)}...`, 
            firm: null 
          }
        }));
        
        setRecentMatches(processedMatches);
      } else {
        setRecentMatches([]);
        
        // Log for debugging
        if (totalMatches > 0) {
          console.error('⚠️ Recent matches query returned 0 results but total matches:', totalMatches);
          console.error('Query response:', {
            data: recentMatchesRes.data,
            error: recentMatchesRes.error,
            count: recentMatchesRes.count
          });
          
          // Try a simpler query to see if basic access works
          const { data: testData, error: testError } = await supabase
            .from('startup_investor_matches')
            .select('id, startup_id, investor_id, match_score')
            .limit(5);
          
          console.log('Simple test query:', { testData, testError });
        }
      }
    } catch (error) {
      console.error('Error loading matching engine data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const triggerQueueProcessor = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/scrapers/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scriptName: 'scripts/core/queue-processor-v16.js',
          description: 'Queue Processor v16'
        })
      });
      
      // Handle network errors (fetch fails)
      if (!response) {
        throw new Error('Network error: Could not connect to server. Is the server running?');
      }
      
      // Try to parse JSON, but handle non-JSON responses
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        const text = await response.text();
        throw new Error(`Server returned invalid response: ${text.substring(0, 200)}`);
      }
      
      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }
      
      alert('✅ Queue processor triggered! Check server logs for progress.');
      
      // Refresh data after a short delay
      setTimeout(() => {
        loadData();
      }, 3000);
    } catch (error: any) {
      console.error('Error triggering queue processor:', error);
      const errorMessage = error.message || 'Unknown error';
      
      // Provide helpful error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network error')) {
        alert(`❌ Failed to trigger queue processor: ${errorMessage}\n\n💡 Make sure the server is running on port 3002.`);
      } else {
        alert(`❌ Failed to trigger queue processor: ${errorMessage}`);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading Matching Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2 flex items-center gap-3">
              <Target className="w-10 h-10 text-cyan-400" />
              Matching Engine Admin
            </h1>
            <p className="text-slate-400">Backend view: Monitor and manage the matching system</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerQueueProcessor}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all"
            >
              <Play className="w-4 h-4" />
              Trigger Queue Processor
            </button>
            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              to="/matching"
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 transition-all"
            >
              View Frontend
            </Link>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border border-cyan-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-cyan-400">{stats.totalMatches.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Total Matches</div>
          </div>
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400">{stats.highQualityMatches.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">High Quality (70+)</div>
          </div>
          <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-400">{stats.avgMatchScore}</div>
            <div className="text-xs text-gray-400 mt-1">Avg Score</div>
          </div>
          <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border border-orange-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-orange-400">{stats.matchesLast24h.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Last 24h</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border border-yellow-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.matchesLastHour.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Last Hour</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border border-blue-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.totalStartups.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Startups</div>
          </div>
          <div className="bg-gradient-to-br from-teal-900/50 to-cyan-900/50 border border-teal-500/30 rounded-xl p-4">
            <div className="text-2xl font-bold text-teal-400">{stats.totalInvestors.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-1">Investors</div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Queue Status
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-700/50 rounded-lg p-4 border border-yellow-500/30">
              <div className="text-2xl font-bold text-yellow-400">{stats.queueStatus.pending}</div>
              <div className="text-sm text-gray-400 mt-1">Pending</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-blue-500/30">
              <div className="text-2xl font-bold text-blue-400">{stats.queueStatus.processing}</div>
              <div className="text-sm text-gray-400 mt-1">Processing</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-green-500/30">
              <div className="text-2xl font-bold text-green-400">{stats.queueStatus.completed}</div>
              <div className="text-sm text-gray-400 mt-1">Completed</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-red-500/30">
              <div className="text-2xl font-bold text-red-400">{stats.queueStatus.failed}</div>
              <div className="text-sm text-gray-400 mt-1">Failed</div>
            </div>
          </div>
        </div>

        {/* Match Quality Distribution */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Match Quality Distribution
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 border border-green-500/30 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{qualityDistribution.excellent.toLocaleString()}</div>
              <div className="text-sm text-gray-400 mt-1">Excellent (80-100)</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border border-yellow-500/30 rounded-lg p-4">
              <div className="text-3xl font-bold text-yellow-400">{qualityDistribution.good.toLocaleString()}</div>
              <div className="text-sm text-gray-400 mt-1">Good (60-79)</div>
            </div>
            <div className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border border-orange-500/30 rounded-lg p-4">
              <div className="text-3xl font-bold text-orange-400">{qualityDistribution.fair.toLocaleString()}</div>
              <div className="text-sm text-gray-400 mt-1">Fair (40-59)</div>
            </div>
            <div className="bg-gradient-to-br from-red-900/50 to-pink-900/50 border border-red-500/30 rounded-lg p-4">
              <div className="text-3xl font-bold text-red-400">{qualityDistribution.poor.toLocaleString()}</div>
              <div className="text-sm text-gray-400 mt-1">Poor (0-39)</div>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Recent Matches
          </h2>
          {recentMatches.length > 0 ? (
            <div className="space-y-2">
              {(() => {
                // Group matches by startup_id
                const groupedMatches = recentMatches.reduce((acc: any, match: any) => {
                  const startupId = match.startup_id || match.startup_uploads?.id || 'unknown';
                  if (!acc[startupId]) {
                    acc[startupId] = {
                      startup: match.startup_uploads || { id: startupId, name: 'Unknown Startup' },
                      matches: []
                    };
                  }
                  acc[startupId].matches.push(match);
                  return acc;
                }, {});

                // Sort matches within each group by score (highest first)
                Object.keys(groupedMatches).forEach(startupId => {
                  groupedMatches[startupId].matches.sort((a: any, b: any) => 
                    parseFloat(b.match_score || 0) - parseFloat(a.match_score || 0)
                  );
                });

                // Convert to array and sort by highest match score
                const startupGroups = Object.values(groupedMatches).sort((a: any, b: any) => {
                  const aMax = Math.max(...a.matches.map((m: any) => parseFloat(m.match_score || 0)));
                  const bMax = Math.max(...b.matches.map((m: any) => parseFloat(m.match_score || 0)));
                  return bMax - aMax;
                });

                return startupGroups.map((group: any) => {
                  const startupId = group.startup.id || 'unknown';
                  const isExpanded = expandedStartups.has(startupId);
                  const matchCount = group.matches.length;
                  const topMatch = group.matches[0];
                  const avgScore = group.matches.reduce((sum: number, m: any) => sum + parseFloat(m.match_score || 0), 0) / matchCount;

                  return (
                    <div key={startupId} className="border border-slate-700/50 rounded-lg overflow-hidden">
                      {/* Startup Header - Clickable to expand/collapse */}
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedStartups);
                          if (newExpanded.has(startupId)) {
                            newExpanded.delete(startupId);
                          } else {
                            newExpanded.add(startupId);
                          }
                          setExpandedStartups(newExpanded);
                        }}
                        className="w-full px-4 py-3 bg-slate-700/30 hover:bg-slate-700/50 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          )}
                          {group.startup.name ? (
                            <Link 
                              to={`/startup/${startupId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-cyan-400 hover:text-cyan-300 font-semibold"
                            >
                              {group.startup.name}
                            </Link>
                          ) : (
                            <span className="text-gray-500">Startup ID: {startupId.substring(0, 8)}...</span>
                          )}
                          <span className="text-gray-500 text-sm">({matchCount} {matchCount === 1 ? 'match' : 'matches'})</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Top Score</div>
                            <span className={`text-lg font-bold ${getScoreColor(parseFloat(topMatch.match_score) || 0)}`}>
                              {parseFloat(topMatch.match_score || 0).toFixed(1)}
                            </span>
                          </div>
                          {matchCount > 1 && (
                            <div className="text-right">
                              <div className="text-xs text-gray-400">Avg</div>
                              <span className={`text-sm font-semibold ${getScoreColor(avgScore)}`}>
                                {avgScore.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Expanded Matches List */}
                      {isExpanded && (
                        <div className="bg-slate-800/30 border-t border-slate-700/50">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-700/30">
                                <tr>
                                  <th className="text-left px-4 py-2 text-gray-400">Investor</th>
                                  <th className="text-center px-4 py-2 text-gray-400">Score</th>
                                  <th className="text-center px-4 py-2 text-gray-400">Confidence</th>
                                  <th className="text-right px-4 py-2 text-gray-400">Created</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.matches.map((match: any) => (
                                  <tr key={match.id} className="border-t border-slate-700/30 hover:bg-slate-700/20">
                                    <td className="px-4 py-3">
                                      {match.investors ? (
                                        <Link 
                                          to={`/investor/${match.investors.id || match.investor_id}`}
                                          className="text-blue-400 hover:text-blue-300 font-medium"
                                        >
                                          {match.investors.name || 'Unknown Investor'}
                                          {match.investors.firm && (
                                            <span className="text-gray-500 text-xs ml-1">({match.investors.firm})</span>
                                          )}
                                        </Link>
                                      ) : (
                                        <span className="text-gray-500">Investor ID: {match.investor_id?.substring(0, 8)}...</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`text-lg font-bold ${getScoreColor(parseFloat(match.match_score) || 0)}`}>
                                        {parseFloat(match.match_score || 0).toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-1 rounded text-xs border ${getConfidenceColor(match.confidence_level || 'low')}`}>
                                        {(match.confidence_level || 'low').toUpperCase()}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                                      {match.created_at ? new Date(match.created_at).toLocaleString() : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              {stats.totalMatches > 0 ? (
                <div className="space-y-2">
                  <div className="text-yellow-400 font-semibold">
                    ⚠️ Query Issue: {stats.totalMatches.toLocaleString()} matches exist but recent matches query returned empty.
                  </div>
                  <div className="text-sm text-gray-400">
                    This may be due to missing foreign key relationships or RLS policies.
                    <br />
                    Check browser console for details.
                  </div>
                </div>
              ) : (
                'No matches found. Run the queue processor to generate matches.'
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-4">
          <Link
            to="/admin/ml-dashboard"
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-all"
          >
            ML Dashboard
          </Link>
          <Link
            to="/admin/god-scores"
            className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg text-orange-400 transition-all"
          >
            GOD Scores
          </Link>
          <Link
            to="/admin/control"
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-cyan-400 transition-all"
          >
            Control Center
          </Link>
        </div>
      </div>
    </div>
  );
}
