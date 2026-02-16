import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Activity, Database, Brain, Zap, Users, Building2, ExternalLink, ArrowRight } from 'lucide-react';
import GODScoreTrendChart from '../components/charts/GODScoreTrendChart';
import InferenceDataCoverageChart from '../components/charts/InferenceDataCoverageChart';
import MatchQualityChart from '../components/charts/MatchQualityChart';
import InferenceImpactChart from '../components/charts/InferenceImpactChart';

interface HealthCheck {
  name: string;
  status: 'OK' | 'WARN' | 'ERROR' | 'LOADING';
  value?: string | number;
  issues?: string[];
}

interface SystemStats {
  startups: { total: number; approved: number; pending: number; avgScore: number };
  investors: { total: number; withEmbedding: number };
  matches: { total: number; highQuality: number; avgScore: number };
  scrapers: { discovered24h: number; lastActivity: string };
  godScores: { avgScore: number; distribution: { low: number; medium: number; high: number; elite: number } };
}

interface Deltas {
  startups24h: number;
  investors24h: number;
  matches24h: number;
  avgGod7dDelta: number;
  avgMatch7dDelta: number;
  hqRate7dDeltaPct: number;
}

interface ChangeStripItem {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
}

export default function SystemHealthDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [deltas, setDeltas] = useState<Deltas | null>(null);
  const [changeStrip, setChangeStrip] = useState<ChangeStripItem[]>([]);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  console.log('[SystemHealthDashboard] Component rendered, loading:', loading, 'error:', error);

  const loadSystemHealth = async () => {
    console.log('[SystemHealthDashboard] Starting loadSystemHealth');
    setRefreshing(true);
    setError(null);
    
    try {
      // Get startup stats
      const { count: totalStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true });
      
      const { count: approvedStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      
      const { count: pendingStartups } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      const { data: avgScoreData } = await supabase
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null);
      
      const avgGodScore = avgScoreData && avgScoreData.length > 0
        ? avgScoreData.reduce((acc, s) => acc + (s.total_god_score || 0), 0) / avgScoreData.length
        : 0;
      
      // Get investor stats
      const { count: totalInvestors } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true });
      
      const { count: investorsWithEmbedding } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);
      
      // Get match stats (with error handling for large table)
      let totalMatches = 0;
      let highQualityMatches = 0;
      let avgMatchScore = 0;
      
      try {
        const { count: matchCount, error: matchError } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true });
        
        if (!matchError) {
          totalMatches = matchCount || 0;
          
          const { count: hqCount } = await supabase
            .from('startup_investor_matches')
            .select('*', { count: 'exact', head: true })
            .gte('match_score', 70);
          
          highQualityMatches = hqCount || 0;
          
          const { data: matchAvgData } = await supabase
            .from('startup_investor_matches')
            .select('match_score')
            .limit(500); // Reduced from 1000
          
          avgMatchScore = matchAvgData && matchAvgData.length > 0
            ? matchAvgData.reduce((acc, m) => acc + (m.match_score || 0), 0) / matchAvgData.length
            : 0;
        } else {
          console.warn('Match query error:', matchError);
          // Use fallback values
          totalMatches = 0;
          highQualityMatches = 0;
          avgMatchScore = 0;
        }
      } catch (matchQueryError) {
        console.error('Match stats failed, using fallback values:', matchQueryError);
        totalMatches = 0;
        highQualityMatches = 0;
        avgMatchScore = 0;
      }
      
      // Get recent discoveries
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { count: discovered24h } = await supabase
        .from('discovered_startups')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo);

      // 24h delta queries
      const { count: startups24h } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo);

      const { count: investors24h } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo);

      let matches24h = 0;
      try {
        const { count: matchCount } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneDayAgo);
        matches24h = matchCount || 0;
      } catch (e) {
        console.warn('24h match count failed:', e);
        matches24h = 0;
      }

      // 7-day GOD score data for delta calculation
      const { data: god7dData } = await supabase
        .from('startup_uploads')
        .select('total_god_score, created_at')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .lte('created_at', sevenDaysAgo);

      const avgGod7dAgo = god7dData && god7dData.length > 0
        ? god7dData.reduce((acc, s) => acc + (s.total_god_score || 0), 0) / god7dData.length
        : avgGodScore;

      // 7-day match data for delta calculation (with error handling)
      let avgMatch7dAgo = avgMatchScore;
      try {
        const { data: match7dData } = await supabase
          .from('startup_investor_matches')
          .select('match_score')
          .lte('created_at', sevenDaysAgo)
          .limit(500); // Reduced from 1000
        
        avgMatch7dAgo = match7dData && match7dData.length > 0
          ? match7dData.reduce((acc, m) => acc + (m.match_score || 0), 0) / match7dData.length
          : avgMatchScore;
      } catch (e) {
        console.warn('7-day match data failed:', e);
        avgMatch7dAgo = avgMatchScore;
      }

      // 7-day historical match counts with error handling
      let totalMatches7d = totalMatches;
      let highQualityMatches7d = highQualityMatches;
      
      try {
        const { count: tm7d } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', sevenDaysAgo);
        totalMatches7d = tm7d || totalMatches;

        const { count: hq7d } = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true })
          .gte('match_score', 70)
          .lte('created_at', sevenDaysAgo);
        highQualityMatches7d = hq7d || highQualityMatches;
      } catch (e) {
        console.warn('7-day historical match counts failed:', e);
        totalMatches7d = totalMatches;
        highQualityMatches7d = highQualityMatches;
      }

      const hqRate7dAgo = (totalMatches7d || 1) > 0 
        ? ((highQualityMatches7d || 0) / (totalMatches7d || 1)) * 100 
        : 0;
      const hqRateNow = (totalMatches || 1) > 0 
        ? ((highQualityMatches || 0) / (totalMatches || 1)) * 100 
        : 0;
      
      // Get last activity
      const { data: lastActivity } = await supabase
        .from('startup_uploads')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Get GOD score distribution
      const { data: scoreDistribution } = await supabase
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null);
      
      const distribution = { low: 0, medium: 0, high: 0, elite: 0 };
      if (scoreDistribution) {
        scoreDistribution.forEach(s => {
          const score = s.total_god_score || 0;
          if (score < 50) distribution.low++;
          else if (score < 70) distribution.medium++;
          else if (score < 85) distribution.high++;
          else distribution.elite++;
        });
      }
      
      // Get recent guardian logs - note: ai_logs uses 'operation' column, not 'type'
      // Using type assertion since ai_logs isn't in generated types yet
      const { data: guardianLogs, error: logsError } = await (supabase as any)
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (logsError) {
        console.log('[SystemHealthDashboard] ai_logs query error (non-fatal):', logsError.message);
      }
      
      setRecentLogs(guardianLogs || []);
      
      // Set stats
      setStats({
        startups: {
          total: totalStartups || 0,
          approved: approvedStartups || 0,
          pending: pendingStartups || 0,
          avgScore: avgGodScore
        },
        investors: {
          total: totalInvestors || 0,
          withEmbedding: investorsWithEmbedding || 0
        },
        matches: {
          total: totalMatches || 0,
          highQuality: highQualityMatches || 0,
          avgScore: avgMatchScore
        },
        scrapers: {
          discovered24h: discovered24h || 0,
          lastActivity: lastActivity?.created_at || 'Never'
        },
        godScores: {
          avgScore: avgGodScore,
          distribution
        }
      });

      // Compute and set deltas
      const computedDeltas: Deltas = {
        startups24h: startups24h || 0,
        investors24h: investors24h || 0,
        matches24h: matches24h || 0,
        avgGod7dDelta: avgGodScore - avgGod7dAgo,
        avgMatch7dDelta: avgMatchScore - avgMatch7dAgo,
        hqRate7dDeltaPct: hqRateNow - hqRate7dAgo
      };
      setDeltas(computedDeltas);

      // Build change strip items
      const stripItems: ChangeStripItem[] = [];
      if (computedDeltas.startups24h > 0) {
        stripItems.push({ 
          label: 'Startups', 
          value: `+${computedDeltas.startups24h}`, 
          trend: 'up' 
        });
      }
      if (computedDeltas.investors24h > 0) {
        stripItems.push({ 
          label: 'Investors', 
          value: `+${computedDeltas.investors24h}`, 
          trend: 'up' 
        });
      }
      if (computedDeltas.matches24h > 0) {
        stripItems.push({ 
          label: 'Matches', 
          value: `+${computedDeltas.matches24h}`, 
          trend: 'up' 
        });
      }
      if (Math.abs(computedDeltas.avgGod7dDelta) > 0.5) {
        stripItems.push({
          label: 'GOD Avg',
          value: `${computedDeltas.avgGod7dDelta > 0 ? '+' : ''}${computedDeltas.avgGod7dDelta.toFixed(1)}`,
          trend: computedDeltas.avgGod7dDelta > 0 ? 'up' : 'down'
        });
      }
      if (Math.abs(computedDeltas.hqRate7dDeltaPct) > 0.1) {
        stripItems.push({
          label: 'HQ Rate',
          value: `${computedDeltas.hqRate7dDeltaPct > 0 ? '+' : ''}${computedDeltas.hqRate7dDeltaPct.toFixed(1)}%`,
          trend: computedDeltas.hqRate7dDeltaPct > 0 ? 'up' : 'down'
        });
      }
      setChangeStrip(stripItems);
      
      // Generate health checks
      const newChecks: HealthCheck[] = [];
      
      // Check 1: Startup Pipeline
      const startupHealth = (approvedStartups || 0) > 100 ? 'OK' : (approvedStartups || 0) > 50 ? 'WARN' : 'ERROR';
      newChecks.push({
        name: 'Startup Pipeline',
        status: startupHealth,
        value: `${approvedStartups} approved, ${pendingStartups} pending`,
        issues: startupHealth === 'ERROR' ? ['Low startup count'] : []
      });
      
      // Check 2: Match Quality
      const matchQuality = (totalMatches || 0) > 5000 ? 'OK' : (totalMatches || 0) > 1000 ? 'WARN' : 'ERROR';
      newChecks.push({
        name: 'Match Quality',
        status: matchQuality,
        value: `${totalMatches?.toLocaleString()} matches, avg ${avgMatchScore.toFixed(0)}`,
        issues: matchQuality === 'ERROR' ? ['Match count too low'] : []
      });
      
      // Check 3: GOD Score Health
      const scoreHealth = avgGodScore >= 35 && avgGodScore <= 75 ? 'OK' : 'WARN';
      newChecks.push({
        name: 'GOD Score Health',
        status: scoreHealth,
        value: `Avg: ${avgGodScore.toFixed(1)}, Elite: ${distribution.elite}`,
        issues: scoreHealth === 'WARN' ? ['Score distribution may be skewed'] : []
      });
      
      // Check 4: Data Freshness
      const hoursSinceActivity = lastActivity?.created_at 
        ? (Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60)
        : 999;
      const freshnessHealth = hoursSinceActivity < 24 ? 'OK' : hoursSinceActivity < 48 ? 'WARN' : 'ERROR';
      newChecks.push({
        name: 'Data Freshness',
        status: freshnessHealth,
        value: `Last: ${hoursSinceActivity.toFixed(0)}h ago · Discovered (24h): ${discovered24h}`,
        issues: freshnessHealth !== 'OK' ? ['Data may be stale'] : []
      });
      
      // Check 5: ML Pipeline
      const mlHealth = (investorsWithEmbedding || 0) / (totalInvestors || 1) > 0.3 ? 'OK' : 'WARN';
      newChecks.push({
        name: 'ML Pipeline',
        status: mlHealth,
        value: `${((investorsWithEmbedding || 0) / (totalInvestors || 1) * 100).toFixed(0)}% embedded`,
        issues: mlHealth === 'WARN' ? ['Low embedding coverage'] : []
      });
      
      setChecks(newChecks);
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error('Failed to load health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load health data');
    }
    
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'OK': return <CheckCircle className="text-green-500" size={20} />;
      case 'WARN': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'ERROR': return <XCircle className="text-red-500" size={20} />;
      default: return <Activity className="text-gray-500 animate-pulse" size={20} />;
    }
  };

  const overallStatus = checks.some(c => c.status === 'ERROR') ? 'ERROR' :
                       checks.some(c => c.status === 'WARN') ? 'WARN' : 'OK';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl flex items-center gap-3">
          <RefreshCw className="animate-spin" />
          Loading system health...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-white text-xl mb-2">Failed to load health data</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button 
            onClick={loadSystemHealth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            🛡️ System Health Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Real-time monitoring of all [pyth] ai systems
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Updated: {lastUpdated?.toLocaleTimeString()}
          </span>
          <button
            onClick={loadSystemHealth}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner - Clickable when issues detected */}
      {(overallStatus === 'WARN' || overallStatus === 'ERROR') ? (
        <button
          onClick={() => {
            // Scroll to health checks section
            const healthChecksSection = document.getElementById('health-checks-section');
            if (healthChecksSection) {
              healthChecksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={`w-full mb-8 p-4 rounded-xl hover:scale-[1.02] transition-all cursor-pointer text-left ${
            overallStatus === 'WARN' ? 'bg-yellow-900/30 border border-yellow-500/30 hover:bg-yellow-900/40 hover:border-yellow-500/50' :
            'bg-red-900/30 border border-red-500/30 hover:bg-red-900/40 hover:border-red-500/50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusIcon status={overallStatus} />
              <span className="text-xl font-semibold">
                System Status: {overallStatus === 'WARN' ? 'Some Issues Detected' :
                              'Critical Issues Require Attention'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity">
              <span>Click to review issues</span>
              <ArrowRight size={16} />
            </div>
          </div>
        </button>
      ) : (
        <div className={`mb-8 p-4 rounded-xl ${
          'bg-green-900/30 border border-green-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <StatusIcon status={overallStatus} />
            <span className="text-xl font-semibold">
              System Status: All Systems Operational
            </span>
          </div>
        </div>
      )}

      {/* What Changed? Strip */}
      {changeStrip.length > 0 && (
        <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
          <div className="flex items-center gap-6 overflow-x-auto">
            <span className="text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap">What changed?</span>
            {changeStrip.map((item, i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm text-gray-400">{item.label}:</span>
                <span className={`text-sm font-medium ${
                  item.trend === 'up' ? 'text-emerald-400' : 
                  item.trend === 'down' ? 'text-red-400' : 
                  'text-gray-300'
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
            <span className="text-xs text-gray-600 ml-auto whitespace-nowrap">24h / 7d</span>
          </div>
        </div>
      )}

      {/* Quick Stats Grid - All Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/admin/edit-startups" className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 hover:from-emerald-800/50 hover:to-emerald-900/50 border border-emerald-500/30 rounded-xl p-4 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <Building2 size={18} />
              <span>Approved Startups</span>
            </div>
            <ExternalLink size={14} className="text-emerald-500/50 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{stats?.startups.approved.toLocaleString()}</span>
            {deltas && deltas.startups24h > 0 && (
              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">+{deltas.startups24h}</span>
            )}
          </div>
          <div className="text-sm text-emerald-400/70">
            {stats?.startups.pending} pending review
          </div>
        </Link>
        
        <Link to="/admin/discovered-investors" className="bg-gradient-to-br from-blue-900/40 to-blue-950/40 hover:from-blue-800/50 hover:to-blue-900/50 border border-blue-500/30 rounded-xl p-4 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-400">
              <Users size={18} />
              <span>Investors</span>
            </div>
            <ExternalLink size={14} className="text-blue-500/50 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{stats?.investors.total.toLocaleString()}</span>
            {deltas && deltas.investors24h > 0 && (
              <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">+{deltas.investors24h}</span>
            )}
          </div>
          <div className="text-sm text-blue-400/70">
            {((stats?.investors.withEmbedding || 0) / (stats?.investors.total || 1) * 100).toFixed(0)}% with ML
          </div>
        </Link>
        
        <Link to="/admin" className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 hover:from-slate-700/50 hover:to-slate-800/50 border border-cyan-500/30 rounded-xl p-4 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-400">
              <Zap size={18} />
              <span>Matches</span>
            </div>
            <ExternalLink size={14} className="text-blue-400/50 group-hover:text-blue-400 transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{stats?.matches.total.toLocaleString()}</span>
            {deltas && deltas.matches24h > 0 && (
              <span className="text-xs text-cyan-400 bg-cyan-500/20 px-1.5 py-0.5 rounded">+{deltas.matches24h}</span>
            )}
          </div>
          <div className="text-sm text-blue-400/70">
            {stats?.matches.highQuality.toLocaleString()} high quality · avg {stats?.matches.avgScore.toFixed(0)}
          </div>
        </Link>
        
        <Link to="/admin/god-scores" className="bg-gradient-to-br from-purple-900/40 to-purple-950/40 hover:from-purple-800/50 hover:to-purple-900/50 border border-purple-500/30 rounded-xl p-4 transition-all group">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-purple-400">
              <Brain size={18} />
              <span>Avg GOD Score</span>
            </div>
            <ExternalLink size={14} className="text-purple-500/50 group-hover:text-purple-400 transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{stats?.godScores.avgScore.toFixed(1)}</span>
            {deltas && Math.abs(deltas.avgGod7dDelta) > 0.5 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                deltas.avgGod7dDelta > 0 
                  ? 'text-emerald-400 bg-emerald-500/20' 
                  : 'text-red-400 bg-red-500/20'
              }`}>
                {deltas.avgGod7dDelta > 0 ? '+' : ''}{deltas.avgGod7dDelta.toFixed(1)} 7d
              </span>
            )}
          </div>
          <div className="text-sm text-purple-400/70">
            {stats?.godScores.distribution.elite} elite startups
          </div>
        </Link>
      </div>

      {/* Health Checks Grid - All Clickable */}
      <div id="health-checks-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {checks.map((check, i) => {
          // Map check names to their relevant admin pages
          const checkLinks: Record<string, string> = {
            'Startup Pipeline': '/admin/edit-startups',
            'Match Quality': '/admin',
            'GOD Score Health': '/admin/god-scores',
            'Data Freshness': '/admin/discovered-startups',
            'ML Pipeline': '/admin/ai-intelligence',
          };
          const linkPath = checkLinks[check.name] || '/admin/control';
          
          return (
            <Link 
              key={i} 
              to={linkPath}
              className={`bg-gray-800/80 hover:bg-gray-700/80 rounded-xl p-4 border-l-4 transition-all group ${
                check.status === 'OK' ? 'border-green-500' :
                check.status === 'WARN' ? 'border-yellow-500' :
                'border-red-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{check.name}</span>
                <div className="flex items-center gap-2">
                  <StatusIcon status={check.status} />
                  <ArrowRight size={14} className="text-gray-500 group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="text-gray-400 text-sm">{check.value}</div>
              {check.issues && check.issues.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  {check.issues.join(', ')}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* GOD Score Distribution - Clickable */}
      <Link to="/admin/god-scores" className="block bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 hover:border-purple-500/30 rounded-xl p-6 mb-8 transition-all group">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">GOD Score Distribution</h3>
          <div className="flex items-center gap-2 text-gray-500 group-hover:text-purple-400 transition-colors">
            <span className="text-base">View Details</span>
            <ArrowRight size={18} />
          </div>
        </div>
        <div className="flex items-end gap-4 h-40">
          {[
            { label: 'Low (<50)', value: stats?.godScores.distribution.low || 0, color: 'bg-gradient-to-t from-red-600 to-red-400', textColor: 'text-red-400' },
            { label: 'Medium (50-70)', value: stats?.godScores.distribution.medium || 0, color: 'bg-gradient-to-t from-yellow-600 to-yellow-400', textColor: 'text-yellow-400' },
            { label: 'High (70-85)', value: stats?.godScores.distribution.high || 0, color: 'bg-gradient-to-t from-green-600 to-green-400', textColor: 'text-green-400' },
            { label: 'Elite (85+)', value: stats?.godScores.distribution.elite || 0, color: 'bg-gradient-to-t from-purple-600 to-purple-400', textColor: 'text-purple-400' },
          ].map((bar, i) => {
            const maxVal = Math.max(
              stats?.godScores.distribution.low || 0,
              stats?.godScores.distribution.medium || 0,
              stats?.godScores.distribution.high || 0,
              stats?.godScores.distribution.elite || 0,
              1
            );
            const height = (bar.value / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`text-2xl font-bold ${bar.textColor} mb-2`}>{bar.value}</div>
                <div 
                  className={`w-full ${bar.color} rounded-t-lg transition-all duration-500 shadow-lg`}
                  style={{ height: `${Math.max(height, 8)}%` }}
                />
                <div className="text-sm text-gray-400 mt-3 text-center">{bar.label}</div>
              </div>
            );
          })}
        </div>
      </Link>

      {/* Analytics Charts Section */}
      <div className="mb-8 space-y-6">
        <h2 className="text-2xl font-bold mb-4">📊 Real-Time Analytics</h2>
        
        {/* GOD Score Trend Chart */}
        <GODScoreTrendChart />

        {/* Inference Data Coverage Chart */}
        <InferenceDataCoverageChart />

        {/* Inference Impact Chart - Shows how inference improves GOD scores */}
        <InferenceImpactChart />

        {/* Match Quality Chart */}
        <MatchQualityChart />
      </div>

      {/* Recent Guardian Reports - Enhanced */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent System Guardian Reports</h3>
          <Link 
            to="/admin/ai-logs" 
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            View All Logs <ArrowRight size={14} />
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No recent guardian reports</p>
            <p className="text-gray-600 text-sm mt-1">Reports appear here when System Guardian runs</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <StatusIcon status={log.output?.overall || 'OK'} />
                  <div>
                    <span className="text-sm text-white">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    <p className="text-xs text-gray-500">
                      {log.action || 'Health Check'}
                    </p>
                  </div>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  log.status === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  log.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {log.output?.checks?.filter((c: any) => c.status !== 'OK').length || 0} issues
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions - Using Link instead of onClick */}
      <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link 
            to="/admin/edit-startups"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/30"
          >
            📋 Review Queue ({stats?.startups.pending})
          </Link>
          <Link 
            to="/admin/god-scores"
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30"
          >
            🎯 GOD Scores
          </Link>
          <Link 
            to="/admin/rss-manager"
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
          >
            📡 RSS Sources
          </Link>
          <Link 
            to="/admin/control"
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/30"
          >
            ⚙️  Control Center
          </Link>
          <Link 
            to="/admin/ai-logs"
            className="px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 rounded-lg font-medium transition-all flex items-center gap-2"
          >
            📜 AI Logs
          </Link>
          <button
            onClick={() => {
              fetch('/api/run-guardian').catch(() => {});
              alert('Guardian check triggered!');
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30"
          >
            🛡️ Run Guardian Check
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
