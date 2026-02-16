import React, { useState, useEffect, useMemo, memo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Award,
  RefreshCw,
  ExternalLink,
  Filter,
  Search,
  ArrowUp,
  ArrowDown,
  Minus,
  Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface IndustryRanking {
  industry: string;
  startup_count: number;
  avg_god_score: number;
  min_score: number;
  max_score: number;
  high_scorers: number;
  high_score_percentage: number;
  top_startups: Array<{
    id: string;
    name: string;
    total_god_score: number;
  }>;
}

export default function IndustryRankingsPage() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<IndustryRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'count' | 'high'>('score');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadRankings();
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadRankings();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadRankings = async () => {
    try {
      setRefreshing(true);
      
      // Get startups with scores and sectors
      const { data: startups, error } = await supabase
        .from('startup_uploads')
        .select('id, name, sectors, total_god_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .not('sectors', 'is', null);

      if (error) throw error;

      // Group by industry/sector
      const industryMap = new Map<string, {
        scores: number[];
        startups: Array<{ id: string; name: string; total_god_score: number }>;
      }>();

      (startups || []).forEach(startup => {
        const industries = startup.sectors || [];
        industries.forEach((industry: string) => {
          if (!industry) return;
          
          if (!industryMap.has(industry)) {
            industryMap.set(industry, { scores: [], startups: [] });
          }
          
          const data = industryMap.get(industry)!;
          data.scores.push(startup.total_god_score || 0);
          data.startups.push({
            id: startup.id,
            name: startup.name,
            total_god_score: startup.total_god_score || 0
          });
        });
      });

      // Calculate statistics for each industry
      const industryRankings: IndustryRanking[] = Array.from(industryMap.entries())
        .map(([industry, data]) => {
          const scores = data.scores;
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const highScorers = scores.filter(s => s >= 80).length;
          
          // Get top 5 startups for this industry
          const topStartups = data.startups
            .sort((a, b) => b.total_god_score - a.total_god_score)
            .slice(0, 5);

          return {
            industry,
            startup_count: scores.length,
            avg_god_score: Math.round(avg * 10) / 10,
            min_score: Math.min(...scores),
            max_score: Math.max(...scores),
            high_scorers: highScorers,
            high_score_percentage: Math.round((highScorers / scores.length) * 100 * 10) / 10,
            top_startups: topStartups
          };
        });

      // Sort based on selected criteria
      let sorted = [...industryRankings];
      switch (sortBy) {
        case 'score':
          sorted.sort((a, b) => b.avg_god_score - a.avg_god_score);
          break;
        case 'count':
          sorted.sort((a, b) => b.startup_count - a.startup_count);
          break;
        case 'high':
          sorted.sort((a, b) => b.high_scorers - a.high_scorers);
          break;
      }

      setRankings(sorted);
    } catch (error: any) {
      console.error('Error loading industry rankings:', error);
      alert(`Error loading rankings: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: 'Elite', color: 'bg-gradient-to-r from-blue-500 to-purple-500' };
    if (score >= 70) return { label: 'Excellent', color: 'bg-gradient-to-r from-green-500 to-emerald-500' };
    if (score >= 60) return { label: 'Good', color: 'bg-gradient-to-r from-cyan-500 to-blue-500' };
    if (score >= 50) return { label: 'Average', color: 'bg-gradient-to-r from-yellow-500 to-orange-500' };
    return { label: 'Needs Work', color: 'bg-gradient-to-r from-red-500 to-orange-500' };
  };

  // Memoize filtered rankings to avoid re-filtering on every render
  const filteredRankings = useMemo(() => 
    rankings.filter(r => r.industry.toLowerCase().includes(searchQuery.toLowerCase())),
    [rankings, searchQuery]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent mb-2">
              📊 Industry GOD Score Rankings
            </h1>
            <p className="text-slate-400">See how different industries score on the GOD algorithm</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                autoRefresh
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-700 text-slate-400 border border-slate-600'
              }`}
            >
              <Activity className="w-4 h-4" />
              Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => navigate('/admin/god-settings')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-semibold rounded-lg transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              GOD Settings
            </button>
            <button
              onClick={loadRankings}
              disabled={refreshing}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700">
            <div className="text-sm text-gray-500 mb-1">Total Industries</div>
            <div className="text-2xl font-bold text-white">{rankings.length}</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700">
            <div className="text-sm text-gray-500 mb-1">Top Industry Avg</div>
            <div className="text-2xl font-bold text-green-400">
              {rankings.length > 0 ? rankings[0].avg_god_score.toFixed(1) : '0'}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700">
            <div className="text-sm text-gray-500 mb-1">Total Startups</div>
            <div className="text-2xl font-bold text-blue-400">
              {rankings.reduce((sum, r) => sum + r.startup_count, 0)}
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg px-4 py-3 border border-gray-700">
            <div className="text-sm text-gray-500 mb-1">Elite Startups (80+)</div>
            <div className="text-2xl font-bold text-purple-400">
              {rankings.reduce((sum, r) => sum + r.high_scorers, 0)}
            </div>
          </div>
        </div>

        {/* Horizontal Bar Chart - Top 5 Industries */}
        {rankings.length > 0 && (() => {
          const top5 = rankings.slice(0, 5);
          const maxScore = Math.max(...top5.map(r => r.max_score));
          const minScore = Math.min(...top5.map(r => r.min_score));
          
          return (
            <div className="mb-6 bg-gray-800/50 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Top 5 Industries by GOD Score</h3>
                <div className="text-xs text-gray-400">
                  Score Range: <span className="text-red-400">{minScore}</span> - <span className="text-green-400">{maxScore}</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {top5.map((ranking, idx) => {
                  // Scale: 0 (left) to maxScore (right)
                  const barWidth = (ranking.avg_god_score / maxScore) * 100;
                  const barColor = ranking.avg_god_score >= 70 ? 'from-green-500 to-emerald-500' :
                                   ranking.avg_god_score >= 60 ? 'from-blue-500 to-cyan-500' :
                                   ranking.avg_god_score >= 50 ? 'from-yellow-500 to-orange-500' :
                                   'from-red-500 to-orange-500';
                  
                  return (
                    <div key={ranking.industry} className="flex items-center gap-3">
                      <div className="w-24 text-xs text-gray-300 font-medium truncate" title={ranking.industry}>
                        {idx === 0 && <Award className="w-3 h-3 text-yellow-400 inline mr-1" />}
                        {ranking.industry}
                      </div>
                      <div className="flex-1 relative">
                        <div className="h-5 bg-slate-700/50 rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-500 flex items-center justify-end pr-2 min-w-[60px]`}
                            style={{ width: `${Math.max(barWidth, (60 / maxScore) * 100)}%` }}
                          >
                            <span className="text-[10px] font-bold text-white drop-shadow-lg whitespace-nowrap">
                              {ranking.avg_god_score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        {/* Scale markers: 0 (left) to maxScore (right) */}
                        <div className="absolute -bottom-4 left-0 text-[9px] text-gray-500">0</div>
                        <div className="absolute -bottom-4 right-0 text-[9px] text-gray-500">{maxScore}</div>
                      </div>
                      <div className="w-20 text-right text-xs text-gray-400">
                        {ranking.startup_count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-400">"Needs Work"</strong> means the industry's average GOD score is below 60, indicating startups in this sector may need to improve team composition, traction metrics, market positioning, product development, or strategic vision to meet investment-grade standards.
                </p>
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search industries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:border-cyan-500 outline-none"
            >
              <option value="score">Avg GOD Score</option>
              <option value="count">Startup Count</option>
              <option value="high">High Scorers (80+)</option>
            </select>
          </div>
        </div>

        {/* Rankings Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading rankings...</div>
        ) : (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-400 font-medium w-16">Rank</th>
                    <th className="text-left px-6 py-3 text-gray-400 font-medium">Industry</th>
                    <th className="text-right px-6 py-3 text-gray-400 font-medium">Startups</th>
                    <th className="text-right px-6 py-3 text-gray-400 font-medium">Avg Score</th>
                    <th className="text-right px-6 py-3 text-gray-400 font-medium">Range</th>
                    <th className="text-right px-6 py-3 text-gray-400 font-medium">Elite (80+)</th>
                    <th className="text-left px-6 py-3 text-gray-400 font-medium">Top Startups</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings.map((ranking, idx) => {
                    const badge = getScoreBadge(ranking.avg_god_score);
                    return (
                      <tr key={ranking.industry} className="border-t border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <Award className="w-4 h-4 text-yellow-400" />}
                            <span className="text-gray-500 font-mono">{idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-white hover:text-cyan-400 transition-colors cursor-default">
                            {ranking.industry}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${badge.color} text-white`}>
                            {badge.label}
                          </div>
                          {badge.label === 'Needs Work' && (
                            <div className="text-[10px] text-gray-500 mt-1 max-w-[200px]">
                              Avg score &lt;60. Industry startups may need to improve team, traction, market fit, product, or vision.
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300 font-mono">{ranking.startup_count}</td>
                        <td className={`px-6 py-4 text-right font-bold font-mono text-lg ${getScoreColor(ranking.avg_god_score)}`}>
                          {ranking.avg_god_score.toFixed(1)}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400 text-xs font-mono">
                          {ranking.min_score} - {ranking.max_score}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-purple-400 font-medium">{ranking.high_scorers}</span>
                            <span className="text-gray-500 text-xs">({ranking.high_score_percentage}%)</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {ranking.top_startups.slice(0, 3).map(startup => (
                              <Link
                                key={startup.id}
                                to={`/startup/${startup.id}`}
                                className="text-xs px-2 py-1 bg-slate-700/50 hover:bg-slate-600 rounded border border-slate-600 hover:border-cyan-500 text-cyan-300 hover:text-cyan-200 transition-all flex items-center gap-1"
                              >
                                {startup.name}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            ))}
                            {ranking.top_startups.length > 3 && (
                              <span className="text-xs text-gray-500">+{ranking.top_startups.length - 3} more</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRankings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No industries found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">⚡ Related Pages</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/admin/god-scores" className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 hover:bg-purple-500/30">
              🎯 GOD Scores
            </Link>
            <Link to="/admin/god-settings" className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/30">
              ⚙️ GOD Settings
            </Link>
            <Link to="/admin/ai-intelligence" className="px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 hover:bg-blue-500/30">
              🧠 ML Dashboard
            </Link>
            <Link to="/rankings" className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded text-green-400 hover:bg-green-500/30">
              🔥 Trending
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
