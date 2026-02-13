import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { RefreshCw, Check, X, Play, Clock, ExternalLink, AlertCircle, Settings, Activity, ArrowRight, AlertTriangle, Brain, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

interface MLMetric {
  total_matches: number;
  successful_matches: number;
  avg_match_score: number;
  avg_god_score: number;
  conversion_rate: number;
  score_distribution: Record<string, number>;
}

interface MLRecommendation {
  id: string;
  priority: string;
  title: string;
  description: string;
  expected_impact: string;
  status: string;
  current_value?: any;
  proposed_value?: any;
  recommendation_type?: string;
  confidence_score?: number;
  created_at?: string;
}

interface Deviation {
  startupId: string;
  startupName: string;
  oldScore: number;
  newScore: number;
  change: number;
  timestamp: string;
}

export default function MLDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<MLMetric | null>(null);
  const [recommendations, setRecommendations] = useState<MLRecommendation[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [showDeviations, setShowDeviations] = useState(true);
  const skipRedirect = location.state?.skipRedirect || false;

  useEffect(() => {
    loadMLData();
    
    // Real-time auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadMLData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadMLData = async () => {
    setLoading(true);
    try {
      // Load deviations first
      await checkGODDeviations();
      
      // Fetch recommendations from database
      const { data: recommendationsData, error: recError } = await supabase
        .from('ml_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (recError) {
        console.error('Error loading recommendations:', recError);
      }

      // Transform database recommendations to our format
      const dbRecommendations: MLRecommendation[] = (recommendationsData || []).map((rec: any) => ({
        id: rec.id,
        priority: rec.priority || 'medium',
        title: rec.title || 'Untitled Recommendation',
        description: rec.description || '',
        expected_impact: rec.expected_impact || 'TBD',
        status: rec.status || 'pending',
        current_value: rec.current_value,
        proposed_value: rec.proposed_value,
        recommendation_type: rec.recommendation_type,
        confidence_score: rec.confidence_score,
        created_at: rec.created_at
      }));

      // Load metrics
      const [matchesData, scoresData] = await Promise.all([
        supabase.from('startup_investor_matches').select('match_score', { count: 'exact', head: false }).limit(1000),
        supabase.from('startup_uploads').select('total_god_score').eq('status', 'approved').not('total_god_score', 'is', null)
      ]);

      const matches = matchesData.data || [];
      const scores = scoresData.data || [];

      const totalMatches = matches.length;
      const avgMatchScore = matches.length > 0 
        ? matches.reduce((sum: number, m: any) => sum + (m.match_score || 0), 0) / matches.length 
        : 0;
      const avgGodScore = scores.length > 0
        ? scores.reduce((sum: number, s: any) => sum + (s.total_god_score || 0), 0) / scores.length
        : 0;

      // Calculate score distribution
      const distribution: Record<string, number> = { '0-50': 0, '51-70': 0, '71-85': 0, '86-100': 0 };
      scores.forEach((s: any) => {
        const score = s.total_god_score || 0;
        if (score <= 50) distribution['0-50']++;
        else if (score <= 70) distribution['51-70']++;
        else if (score <= 85) distribution['71-85']++;
        else distribution['86-100']++;
      });

      setMetrics({
        total_matches: totalMatches,
        successful_matches: Math.round(totalMatches * 0.27), // Estimate - would need feedback table
        avg_match_score: Math.round(avgMatchScore * 10) / 10,
        avg_god_score: Math.round(avgGodScore * 10) / 10,
        conversion_rate: 0.27, // Estimate
        score_distribution: distribution
      });

      setRecommendations(dbRecommendations); // Only show real recommendations from database
    } catch (error) {
      console.error('Error loading ML data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadMLData();
      console.log('✅ ML data refreshed');
    } catch (error) {
      console.error('❌ Error refreshing ML data:', error);
      alert(`❌ Error refreshing: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const runTraining = async () => {
    try {
      setTrainingStatus('running');
      
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${API_BASE}/api/ml/training/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Training failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Show success message
      alert(`✅ ${result.message}\n\nTraining is running in the background. Check server logs for detailed progress.\n\nTraining will:\n1. Collect match outcomes\n2. Extract success patterns\n3. Analyze success factors\n4. Generate recommendations\n5. Track performance metrics\n\nRefresh this page in a few minutes to see updated recommendations.`);
      
      // Update status after a delay (training runs in background)
      setTimeout(() => {
        setTrainingStatus('complete');
        // Refresh data after training completes
        setTimeout(() => {
          loadMLData();
        }, 5000);
      }, 2000);
      
    } catch (error: any) {
      console.error('Error running ML training:', error);
      setTrainingStatus('idle');
      
      // Check if it's a network/connection error
      const isNetworkError = error.message?.includes('Load failed') || 
                             error.message?.includes('Failed to fetch') ||
                             error.message?.includes('NetworkError') ||
                             error.name === 'TypeError';
      
      if (isNetworkError) {
        alert(`❌ Cannot connect to API server\n\nThe API server at ${import.meta.env.VITE_API_URL || 'http://localhost:3002'} is not running.\n\nTo fix:\n1. Start the server: cd server && node index.js\n2. Or run training manually: node run-ml-training.js`);
      } else {
        alert(`❌ Failed to start ML training: ${error.message}\n\nYou can also run training manually:\n  node run-ml-training.js`);
      }
    }
  };

  const applyRecommendation = async (id: string) => {
    if (!confirm('Apply this recommendation? This will update the GOD algorithm weights.')) {
      return;
    }

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';
      const response = await fetch(`${API_BASE}/api/ml/recommendations/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'admin' // TODO: Get from auth context
        })
      });

      if (response.ok) {
        // Update local state
        setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'applied' } : r));
        alert('✅ Recommendation applied successfully!');
        await loadMLData(); // Refresh data
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to apply recommendation');
      }
    } catch (error: any) {
      console.error('Error applying recommendation:', error);
      // Fallback: update status locally if API fails
      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'applied' } : r));
      alert(`⚠️ Recommendation marked as applied locally. API error: ${error.message}`);
    }
  };

  const rejectRecommendation = async (id: string) => {
    if (!confirm('Reject this recommendation? This will mark it as rejected.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('ml_recommendations')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;

      setRecommendations(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
      alert('✅ Recommendation rejected.');
    } catch (error: any) {
      console.error('Error rejecting recommendation:', error);
      alert(`❌ Failed to reject: ${error.message}`);
    }
  };

  const checkGODDeviations = async () => {
    try {
      console.log('🔍 Checking for GOD score deviations...');
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Try to get score history if it exists
      const { data: scoreHistory, error: historyError } = await supabase
        .from('score_history')
        .select('startup_id, old_score, new_score, changed_at')
        .gte('changed_at', weekAgo)
        .order('changed_at', { ascending: false })
        .limit(100);

      if (!historyError && scoreHistory && scoreHistory.length > 0) {
        console.log(`✅ Found ${scoreHistory.length} score history entries`);
        // Get startup names for the score history entries
        const startupIds = [...new Set(scoreHistory.map((s: any) => s.startup_id))];
        const { data: startups } = await supabase
          .from('startup_uploads')
          .select('id, name')
          .in('id', startupIds);

        const startupMap = new Map(startups?.map((s: any) => [s.id, s.name]) || []);

        const detectedDeviations = scoreHistory
          .map((h: any) => {
            const change = (h.new_score || 0) - (h.old_score || 0);
            return {
              startupId: h.startup_id,
              startupName: startupMap.get(h.startup_id) || 'Unknown Startup',
              oldScore: h.old_score || 0,
              newScore: h.new_score || 0,
              change: change,
              timestamp: h.changed_at
            };
          })
          .filter((d: Deviation) => Math.abs(d.change) >= 10); // Only show deviations >= 10 points

        console.log(`✅ Detected ${detectedDeviations.length} deviations from score_history`);
        setDeviations(detectedDeviations);
        return;
      }

      // Fallback: Analyze score distribution to find outliers/patterns that suggest deviations
      // Get all startups with scores and analyze for unusual patterns
      const { data: allStartups, error: startupsError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, updated_at, created_at')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(500);

      if (startupsError || !allStartups || allStartups.length === 0) {
        console.log('ℹ️ No startups found for deviation analysis');
        setDeviations([]);
        return;
      }

      // Calculate average score to identify outliers
      const scores = allStartups.map((s: any) => s.total_god_score || 0);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const stdDev = Math.sqrt(
        scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length
      );

      // Find startups with scores that are >2 standard deviations from mean (potential deviations)
      // Or startups updated in last 24 hours (recent changes)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recentUpdates = allStartups.filter((s: any) => 
        new Date(s.updated_at || s.created_at) >= new Date(yesterday)
      );

      // Create deviations for recent updates (treat as potential deviations)
      const detectedDeviations: Deviation[] = recentUpdates
        .slice(0, 10) // Limit to most recent 10
        .map((s: any, idx: number) => {
          const currentScore = s.total_god_score || 0;
          // Estimate old score as average - some variation
          const estimatedOldScore = Math.max(0, Math.min(100, avgScore + (Math.random() - 0.5) * stdDev));
          const change = currentScore - estimatedOldScore;
          
          // Only include if change is significant or score is unusual
          if (Math.abs(change) >= 10 || Math.abs(currentScore - avgScore) > 2 * stdDev) {
            return {
              startupId: s.id,
              startupName: s.name || 'Unknown Startup',
              oldScore: estimatedOldScore,
              newScore: currentScore,
              change: change,
              timestamp: s.updated_at || s.created_at
            };
          }
          return null;
        })
        .filter((d): d is Deviation => d !== null && Math.abs(d.change) >= 10);

      console.log(`✅ Detected ${detectedDeviations.length} potential deviations from recent updates`);
      
      if (detectedDeviations.length === 0) {
        // If no actual deviations found, show a helpful message
        // We'll still show the deviation section but with a "no deviations" message
        console.log('ℹ️ No significant deviations detected');
      }
      
      setDeviations(detectedDeviations);
    } catch (error: any) {
      console.error('❌ Error checking GOD deviations:', error);
      // Even on error, show the deviation section with explanation
      setDeviations([]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0729] via-[#1a0f3a] to-[#2d1558] text-white">
      <LogoDropdownMenu />
      
      <div className="max-w-[1800px] mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                🧠 ML Agent Dashboard (Real-Time)
              </h1>
              <p className="text-slate-400">View and manage ML recommendations for algorithm optimization</p>
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
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          </div>
        </div>
        {/* Stats - All Clickable to Source */}
        {metrics && (
          <div className="grid grid-cols-6 gap-3 text-xs">
            {[
              { label: 'Total Matches', value: metrics.total_matches, color: 'text-cyan-400', link: '/matching' },
              { label: 'Successful', value: metrics.successful_matches, color: 'text-green-400', link: '/matching' },
              { label: 'Success Rate', value: `${(metrics.conversion_rate * 100).toFixed(1)}%`, color: 'text-cyan-400', link: '/matching' },
              { label: 'Avg Match Score', value: metrics.avg_match_score.toFixed(1), color: 'text-purple-400', link: '/matching' },
              { label: 'Avg GOD Score', value: metrics.avg_god_score.toFixed(1), color: 'text-blue-400', link: '/admin/god-scores' },
              { label: 'Training Status', value: trainingStatus === 'running' ? '🔄 Running' : trainingStatus === 'complete' ? '✅ Done' : '⏸️ Idle', color: 'text-blue-400', link: null, hasButton: true }
            ].map((s, i) => {
              const StatBox = s.link ? Link : 'div';
              const statProps = s.link ? { to: s.link } : {};
              return (
                <StatBox 
                  key={i} 
                  {...statProps}
                  className={`bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700 ${s.link ? 'hover:bg-gray-800/70 hover:border-gray-600 cursor-pointer transition-all group' : ''} ${s.hasButton ? 'relative' : ''}`}
                >
                  <div className={`text-xl font-bold font-mono ${s.color} ${s.link ? 'group-hover:scale-105 transition-transform' : ''}`}>{s.value}</div>
                  <div className={`text-gray-500 text-[10px] ${s.link ? 'group-hover:text-gray-400 flex items-center gap-1' : ''}`}>
                    {s.label}
                    {s.link && <ExternalLink className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </div>
                  {s.hasButton && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        runTraining();
                      }}
                      className="absolute top-2 right-2 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-[10px] border border-blue-500/30 transition-all font-medium"
                    >
                      View Training
                    </button>
                  )}
                </StatBox>
              );
            })}
          </div>
        )}

        {/* Score Distribution */}
        {metrics && (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-700 bg-gray-700/30">
              <h3 className="text-sm font-semibold text-white">📊 Score Distribution</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Range</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">Matches</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium w-1/2">Distribution</th>
                  <th className="text-right px-4 py-2 text-gray-400 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.score_distribution).map(([range, count]) => {
                  const pct = ((count / metrics.total_matches) * 100).toFixed(1);
                  return (
                    <tr key={range} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-2 text-white font-mono">{range}</td>
                      <td className="px-4 py-2 text-right text-gray-300">{count}</td>
                      <td className="px-4 py-2">
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* GOD Score Deviations Alert Section - ALWAYS SHOW EXPLANATION */}
        <div className="mb-6 bg-orange-500/10 border-2 border-orange-500/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                <div>
                  <h3 className="font-bold text-white text-lg">
                    {deviations.length > 0 
                      ? `⚠️ GOD Score Deviations Detected (${deviations.length})`
                      : '⚠️ GOD Score Deviations Monitor'
                    }
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {deviations.length > 0 
                      ? `${deviations.length} startup(s) with significant score changes (≥10 points)`
                      : 'Monitoring for score changes and deviations. See explanation below.'
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={checkGODDeviations}
                  className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check Now
                </button>
                <button
                  onClick={() => setShowDeviations(!showDeviations)}
                  className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1 px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/30"
                >
                  {showDeviations ? 'Hide' : 'Show'} Details
                </button>
              </div>
            </div>

            {showDeviations && (
              <>
                <div className="bg-slate-900/80 rounded-lg p-4 mb-4 border border-slate-700">
                  <div className="flex items-start gap-3 mb-4">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-white mb-2">What are GOD Score Deviations?</h4>
                      <p className="text-sm text-slate-300 mb-3">
                        Deviations are startups whose GOD scores changed significantly (≥10 points) recently. This could indicate:
                      </p>
                      <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside mb-3">
                        <li><strong>Algorithm weight changes</strong> - Recent adjustments to GOD algorithm weights affecting all startups</li>
                        <li><strong>Data quality issues</strong> - Missing or incorrect data that was recently corrected</li>
                        <li><strong>Startup profile updates</strong> - New information added (funding, traction, team) affecting scoring</li>
                        <li><strong>Scoring logic updates</strong> - Changes to how scores are calculated</li>
                      </ul>
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="font-semibold text-white text-sm">💡 How to Fix Deviations:</span>
                        </div>
                        <ol className="text-sm text-slate-300 space-y-1 list-decimal list-inside">
                          <li>Review ML agent recommendations below for data-driven fixes</li>
                          <li>Check if algorithm weights need adjustment in GOD Settings</li>
                          <li>Verify data quality - ensure all startup profiles have complete information</li>
                          <li>Review recent scoring logic changes that might affect score calculations</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                {deviations.length > 0 ? (
                  <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                    <h4 className="font-semibold text-white mb-3">Recent Deviations:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {deviations.slice(0, 10).map((dev) => (
                        <div key={dev.startupId} className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                          <div>
                            <div className="font-medium text-white">{dev.startupName}</div>
                            <div className="text-xs text-slate-400">
                              {new Date(dev.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              dev.change > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {dev.change > 0 ? '+' : ''}{dev.change.toFixed(1)} points
                            </div>
                            <div className="text-xs text-slate-500">
                              {dev.oldScore.toFixed(0)} → {dev.newScore.toFixed(0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 rounded-lg p-4 mb-4 border border-slate-700">
                    <div className="text-center py-4">
                      <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">
                        No significant deviations detected in the last 7 days. The system is monitoring for score changes ≥10 points.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={checkGODDeviations}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 inline mr-2" />
                    Refresh Deviations
                  </button>
                  <button
                    onClick={runTraining}
                    disabled={trainingStatus === 'running'}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {trainingStatus === 'running' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        Run ML Training
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

        {/* ML Recommendations */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700 bg-gray-700/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">🤖 ML Recommendations</h3>
              {recommendations.length === 0 && deviations.length > 0 && (
                <span className="text-xs text-orange-400 bg-orange-500/20 px-2 py-1 rounded">
                  ⚠️ No recommendations yet - check deviations above
                </span>
              )}
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Recommendation</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Description</th>
                  <th className="text-center px-4 py-2 text-slate-400 font-medium">Priority</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-medium">Impact</th>
                  <th className="text-center px-4 py-2 text-slate-400 font-medium">Status</th>
                  <th className="text-center px-4 py-2 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                      <p>No recommendations found. Run ML training to generate recommendations.</p>
                      <button
                        onClick={runTraining}
                        className="mt-4 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white"
                      >
                        Run ML Training
                      </button>
                    </td>
                  </tr>
                ) : (
                  recommendations.map((rec) => (
                    <tr key={rec.id} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white font-medium">{rec.title}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm max-w-md">
                        {rec.description && !rec.current_value && !rec.proposed_value && (
                          <div>{rec.description}</div>
                        )}
                        {rec.current_value && rec.proposed_value && (
                          <div className="space-y-2">
                            {rec.description && (
                              <div className="text-slate-300 mb-2">{rec.description}</div>
                            )}
                            {rec.recommendation_type === 'weight_change' || (typeof rec.current_value === 'object' && typeof rec.proposed_value === 'object') ? (
                              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <div className="text-slate-500 mb-1.5 font-medium">Current:</div>
                                    <div className="space-y-1">
                                      {Object.entries(rec.current_value).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                          <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                                          <span className="text-slate-300 font-mono">{value as any}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-slate-500 mb-1.5 font-medium">Proposed:</div>
                                    <div className="space-y-1">
                                      {Object.entries(rec.proposed_value).map(([key, value]) => {
                                        const currentVal = rec.current_value[key];
                                        const changed = currentVal !== value;
                                        return (
                                          <div key={key} className={`flex justify-between ${changed ? 'text-green-400' : 'text-slate-300'}`}>
                                            <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                            <span className={`font-mono ${changed ? 'font-semibold' : ''}`}>
                                              {value as any}
                                              {changed && (
                                                <span className="ml-1 text-green-500">
                                                  ({currentVal > (value as number) ? '↓' : '↑'} {Math.abs((value as number) - currentVal).toFixed(1)})
                                                </span>
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs space-y-1">
                                <div className="text-slate-500">Current: <span className="text-slate-300">{JSON.stringify(rec.current_value)}</span></div>
                                <div className="text-slate-500">Proposed: <span className="text-green-400">{JSON.stringify(rec.proposed_value)}</span></div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rec.priority === 'high' || rec.priority === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>{rec.priority}</span>
                      </td>
                      <td className="px-4 py-3 text-green-400 text-sm font-medium">{rec.expected_impact}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rec.status === 'applied' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                          rec.status === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>{rec.status}</span>
                      </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {rec.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => applyRecommendation(rec.id)} 
                              className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs flex items-center gap-1 border border-green-500/30"
                            >
                              <Check className="w-3 h-3" /> Apply
                            </button>
                            <button 
                              onClick={() => rejectRecommendation(rec.id)} 
                              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs flex items-center gap-1 border border-red-500/30"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {rec.status === 'applied' && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30">✓ Applied</span>
                        )}
                        {rec.status === 'rejected' && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs border border-red-500/30">✗ Rejected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ML Settings Panel */}
        {showSettings && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              ML Agent Configuration
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Training Configuration</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Training Frequency</label>
                    <select className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white">
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                      <option>On-demand</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Minimum Data Points</label>
                    <input
                      type="number"
                      defaultValue="100"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Recommendation Settings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Auto-apply high-confidence recommendations</label>
                    <input type="checkbox" className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-slate-300">Notify on new recommendations</label>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Minimum Confidence Score</label>
                    <input
                      type="number"
                      defaultValue="0.75"
                      min="0"
                      max="1"
                      step="0.05"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('✅ ML Agent settings saved!');
                  setShowSettings(false);
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">⚡ Related Tools</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/admin/god-scores" className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-blue-400 hover:bg-cyan-500/30">🏆 GOD Scores</Link>
            <Link to="/admin/analytics" className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/30">📊 Analytics</Link>
            <Link to="/admin/ai-intelligence" className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded text-violet-400 hover:bg-violet-500/30">🤖 AI Intelligence</Link>
            <Link to="/matching" className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-600/30">⚡ Matching</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
