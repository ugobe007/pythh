import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { RefreshCw, Check, Play, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { API_BASE } from '../lib/apiConfig';

interface MLMetric {
  total_matches: number;
  high_quality_matches: number;
  avg_match_score: number;
  avg_god_score: number;
  pending_recs: number;
  applied_recs: number;
  score_distribution: Record<string, number>;
}

interface MLRecommendation {
  id: string;
  priority: string;
  title: string;
  description: string;
  expected_impact: string;
  confidence: number;
  status: string;
  recommended_weights: any;
  current_weights: any;
  created_at: string;
}

export default function MLDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<MLMetric | null>(null);
  const [recommendations, setRecommendations] = useState<MLRecommendation[]>([]);
  const [trainingStatus, setTrainingStatus] = useState<'idle' | 'running' | 'complete'>('idle');

  useEffect(() => {
    loadMLData();
  }, []);

  const loadMLData = async () => {
    setLoading(true);
    try {
      // Load real ML recommendations from database
      const { data: recs, error: recsError } = await supabase
        .from('ml_recommendations')
        .select('id, recommendation_type, recommended_weights, current_weights, confidence, reasoning, expected_improvement, status, created_at')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (recsError) throw recsError;

      const mappedRecs: MLRecommendation[] = (recs || []).map((rec: any) => ({
        id: rec.id,
        priority: rec.confidence >= 0.9 ? 'high' : rec.confidence >= 0.7 ? 'medium' : 'low',
        title: rec.recommendation_type === 'component_weight_adjustment'
          ? 'Component Weight Adjustment'
          : rec.recommendation_type?.replace(/_/g, ' ')?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Algorithm Optimization',
        description: Array.isArray(rec.reasoning) ? rec.reasoning.slice(0, 2).join(' ') : '',
        expected_impact: rec.expected_improvement != null
          ? `+${Number(rec.expected_improvement).toFixed(1)}% expected improvement`
          : 'Estimated improvement',
        confidence: rec.confidence,
        status: rec.status,
        recommended_weights: rec.recommended_weights,
        current_weights: rec.current_weights,
        created_at: rec.created_at,
      }));
      setRecommendations(mappedRecs);

      // Load match metrics
      const { count: totalMatches } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true });
      const { count: highQuality } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true })
        .gte('match_score', 80);
      const { count: pendingRecs } = await supabase
        .from('ml_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      const { count: appliedRecs } = await supabase
        .from('ml_recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'applied');

      const total = totalMatches || 0;
      const hq = highQuality || 0;
      // Build a simple 2-bucket distribution from what we have
      const scoreDistribution: Record<string, number> = total > 0 ? {
        '80-100 (High Quality)': hq,
        '0-79 (Standard)': total - hq,
      } : {};

      setMetrics({
        total_matches: total,
        high_quality_matches: hq,
        avg_match_score: total > 0 ? 0 : 0,
        avg_god_score: 0,
        pending_recs: pendingRecs || 0,
        applied_recs: appliedRecs || 0,
        score_distribution: scoreDistribution,
      });
    } catch (error) {
      console.error('Error loading ML data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadMLData();
    setRefreshing(false);
  };

  const runTraining = async () => {
    setTrainingStatus('running');
    try {
      const response = await fetch(`${API_BASE}/api/ml/training/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      console.log('ML training started:', result);
      setTrainingStatus('complete');
      setTimeout(async () => {
        setTrainingStatus('idle');
        await loadMLData(); // Refresh recommendations after training
      }, 3000);
    } catch (error: any) {
      console.error('Training error:', error);
      setTrainingStatus('idle');
      alert(`Failed to start training: ${error.message}`);
    }
  };

  const applyRecommendation = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/ml/recommendations/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin' }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || `HTTP ${response.status}`);
      }
      const result = await response.json();
      console.log('Applied recommendation:', result);
      // Refresh data
      await loadMLData();
      alert(`✅ Recommendation applied! Score recalculation queued.\n\nNew weights: ${JSON.stringify(result.new_weights, null, 2)}`);
    } catch (error: any) {
      console.error('Error applying recommendation:', error);
      alert(`❌ Failed to apply: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-auto">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white pl-20">🧠 ML Dashboard</h1>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="text-gray-400 hover:text-white">Home</Link>
            <Link to="/admin" className="text-gray-400 hover:text-white">Control Center</Link>
            <Link to="/admin/health" className="text-gray-400 hover:text-white">Operations</Link>
            <Link to="/admin" className="text-gray-400 hover:text-white">Dashboard</Link>
            <Link to="/matches" className="text-orange-400 hover:text-orange-300 font-bold">⚡ Match</Link>
            <button onClick={refresh} className="text-gray-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* Stats */}
        {metrics && (
          <div className="grid grid-cols-6 gap-3 text-xs">
            {[
              { label: 'Total Matches', value: metrics.total_matches.toLocaleString(), color: 'text-orange-400' },
              { label: 'High Quality (80+)', value: metrics.high_quality_matches.toLocaleString(), color: 'text-green-400' },
              { label: 'Quality Rate', value: metrics.total_matches > 0 ? `${((metrics.high_quality_matches / metrics.total_matches) * 100).toFixed(1)}%` : '0%', color: 'text-cyan-400' },
              { label: 'Pending Recs', value: metrics.pending_recs, color: 'text-purple-400' },
              { label: 'Applied Recs', value: metrics.applied_recs, color: 'text-amber-400' },
              { label: 'Training Status', value: trainingStatus === 'running' ? '🔄 Running' : trainingStatus === 'complete' ? '✅ Done' : '⏸️ Idle', color: 'text-blue-400' }
            ].map((s, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700">
                <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
                <div className="text-gray-500 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Score Distribution */}
        {metrics && (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-700 bg-gray-700/30 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white">📊 Score Distribution</h3>
              <button
                onClick={runTraining}
                disabled={trainingStatus === 'running'}
                className={`px-3 py-1 rounded text-xs flex items-center gap-1 ${
                  trainingStatus === 'running' ? 'bg-yellow-500/20 text-yellow-400' :
                  trainingStatus === 'complete' ? 'bg-green-500/20 text-green-400' :
                  'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                }`}
              >
                {trainingStatus === 'running' ? <Clock className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {trainingStatus === 'running' ? 'Training...' : trainingStatus === 'complete' ? 'Complete!' : 'Run Training'}
              </button>
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

        {/* ML Recommendations */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-700 bg-gray-700/30">
            <h3 className="text-sm font-semibold text-white">🤖 ML Recommendations</h3>
          </div>
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Recommendation</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Description</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Priority</th>
                  <th className="text-left px-4 py-2 text-gray-400 font-medium">Impact</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium">Status</th>
                  <th className="text-center px-4 py-2 text-gray-400 font-medium w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => (
                  <tr key={rec.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-2 text-white font-medium">{rec.title}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs max-w-64">{rec.description}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                        rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{rec.priority}</span>
                    </td>
                    <td className="px-4 py-2 text-green-400 text-xs">{rec.expected_impact}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        rec.status === 'applied' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>{rec.status}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {rec.status === 'pending' ? (
                        <button onClick={() => applyRecommendation(rec.id)} className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs flex items-center gap-1 mx-auto">
                          <Check className="w-3 h-3" /> Apply
                        </button>
                      ) : (
                        <span className="text-green-400 text-xs">✓ Applied</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">⚡ Related Tools</h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link to="/admin/god-scores" className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded text-amber-400 hover:bg-amber-500/30">🏆 GOD Scores</Link>
            <Link to="/admin/health" className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-400 hover:bg-cyan-500/30">📊 Analytics</Link>
            <Link to="/admin/ai-intelligence" className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/30 rounded text-violet-400 hover:bg-violet-500/30">🤖 AI Intelligence</Link>
            <Link to="/matches" className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 hover:bg-orange-500/30">⚡ Matching</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
