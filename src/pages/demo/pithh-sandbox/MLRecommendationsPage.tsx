/**
 * ML RECOMMENDATIONS PAGE — Production-Grade UI for ML Agent v2
 * ==============================================================
 * Displays recommendations from ml_recommendations table (new schema)
 * 
 * New Schema Fields:
 *  - weights_version: unique ID for this recommendation
 *  - source_weights_version: baseline weights being modified
 *  - current_weights: JSONB with componentWeights, signalMaxPoints, etc.
 *  - recommended_weights: JSONB with proposed componentWeights
 *  - reasoning: text[] array of ML insights
 *  - confidence: 0-1 score
 *  - sample_success_count, sample_fail_count, sample_positive_rate
 *  - cross_time_stable: boolean from gate check
 *  - status: 'draft' | 'active' | 'rejected' | 'superseded'
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Brain, TrendingUp, TrendingDown, CheckCircle, XCircle, 
  RefreshCw, ChevronRight, AlertTriangle, Zap, BarChart3,
  Shield, Clock, ArrowRight, Check, X, Loader2, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PythhTokens } from '../lib/designTokens';
import TopBar from './components/TopBar';
import './pithh.css';

interface ComponentWeights {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
  [key: string]: number;
}

interface WeightsPayload {
  componentWeights: ComponentWeights;
  signalMaxPoints: Record<string, number>;
  signals_contract_version?: string;
}

interface MLRecommendation {
  id: string;
  weights_version: string;
  source_weights_version: string | null;
  recommendation_type: string;
  current_weights: WeightsPayload;
  recommended_weights: WeightsPayload;
  reasoning: string[];
  confidence: number;
  expected_improvement: number | null;
  sample_success_count: number;
  sample_fail_count: number;
  sample_positive_rate: number;
  cross_time_stable: boolean;
  golden_tests_passed: boolean | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface GateCheckResult {
  passed: boolean;
  gates: {
    sample_size: { passed: boolean; success_count: number; fail_count: number };
    positive_rate: { passed: boolean; value: number };
    cross_time_stability: { passed: boolean; bucket_count: number };
  };
  summary: {
    total_samples: number;
    success_samples: number;
    positive_rate: number;
  };
}

const COMPONENT_LABELS: Record<string, string> = {
  team: '👥 Team',
  traction: '📈 Traction',
  market: '🎯 Market',
  product: '🛠️ Product',
  vision: '🔮 Vision',
};

export default function MLRecommendationsPage() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<MLRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gateCheck, setGateCheck] = useState<GateCheckResult | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadRecommendations(), loadGateCheck()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    const { data, error } = await supabase
      .from('ml_recommendations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    setRecommendations(data || []);
  };

  const loadGateCheck = async () => {
    try {
      const { data, error } = await supabase.rpc('ml_gate_check', { p_window: '180d' });
      if (error) {
        console.warn('Gate check failed:', error);
        return;
      }
      setGateCheck(data);
    } catch (err) {
      console.warn('Gate check unavailable:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (rec: MLRecommendation) => {
    if (!confirm(`Approve recommendation "${rec.weights_version}"?\n\nThis will activate the new weights.`)) {
      return;
    }

    setApplyingId(rec.id);
    try {
      // Update status to 'approved' and set reviewed metadata
      const { error } = await supabase
        .from('ml_recommendations')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin', // TODO: get from auth context
        })
        .eq('id', rec.id);

      if (error) throw error;

      // Update god_weight_versions table to activate new version
      await supabase
        .from('god_weight_versions')
        .update({ status: 'active' })
        .eq('weights_version', rec.weights_version);

      // Mark old active version as superseded
      await supabase
        .from('god_weight_versions')
        .update({ status: 'superseded' })
        .eq('status', 'active')
        .neq('weights_version', rec.weights_version);

      await loadRecommendations();
      alert('✅ Recommendation approved and activated!');
    } catch (err: any) {
      alert(`❌ Failed to approve: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  };

  const handleReject = async (rec: MLRecommendation) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // Cancelled

    setApplyingId(rec.id);
    try {
      const { error } = await supabase
        .from('ml_recommendations')
        .update({
          status: 'rejected',
          reviewed_by: 'admin',
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', rec.id);

      if (error) throw error;
      await loadRecommendations();
      alert('Recommendation rejected.');
    } catch (err: any) {
      alert(`❌ Failed to reject: ${err.message}`);
    } finally {
      setApplyingId(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
      expired: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status] || styles.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className={`min-h-screen ${PythhTokens.bg.page}`}>
      <TopBar status="ML Agent" subtitle="Weight Recommendations" />

      <main className={PythhTokens.spacing.page}>
        <div className={PythhTokens.container.standard}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-purple-400" />
                ML Recommendations
              </h1>
              <p className="text-white/60 mt-1">
                Review and approve weight adjustments from ML Agent v2
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`${PythhTokens.button.secondary} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Gate Check Status */}
          {gateCheck && (
            <div className={`${PythhTokens.bg.glasPanel} rounded-xl p-4 mb-6`}>
              <div className="flex items-center gap-3 mb-3">
                <Shield className={`w-5 h-5 ${gateCheck.passed ? 'text-emerald-400' : 'text-yellow-400'}`} />
                <span className="font-semibold text-white">
                  Data Quality Gates: {gateCheck.passed ? 'PASSING' : 'ISSUES DETECTED'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className={`p-3 rounded-lg ${gateCheck.gates.sample_size.passed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <div className="text-white/60">Sample Size</div>
                  <div className="text-lg font-mono text-white">
                    {gateCheck.gates.sample_size.success_count.toLocaleString()} ✓ / {gateCheck.gates.sample_size.fail_count.toLocaleString()} ✗
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${gateCheck.gates.positive_rate.passed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <div className="text-white/60">Positive Rate</div>
                  <div className="text-lg font-mono text-white">
                    {(gateCheck.gates.positive_rate.value * 100).toFixed(1)}%
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${gateCheck.gates.cross_time_stability.passed ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                  <div className="text-white/60">Time Stability</div>
                  <div className="text-lg font-mono text-white">
                    {gateCheck.gates.cross_time_stability.bucket_count} buckets
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className={`${PythhTokens.bg.error} rounded-xl p-4 mb-6`}>
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : recommendations.length === 0 ? (
            /* Empty State */
            <div className={`${PythhTokens.bg.glasPanel} rounded-xl p-12 text-center`}>
              <Brain className="w-16 h-16 text-purple-400/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Recommendations Yet</h3>
              <p className="text-white/60 mb-6">
                ML Agent hasn't generated any weight recommendations.
                <br />
                Run training to analyze success patterns.
              </p>
              <button
                onClick={() => navigate('/admin')}
                className={PythhTokens.button.primary}
              >
                Go to Admin Dashboard
              </button>
            </div>
          ) : (
            /* Recommendations List */
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  isApplying={applyingId === rec.id}
                  onApprove={() => handleApprove(rec)}
                  onReject={() => handleReject(rec)}
                  formatDate={formatDate}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => navigate('/admin')}
              className={`${PythhTokens.button.ghost} flex items-center gap-2`}
            >
              ← Back to Admin
            </button>
            <button
              onClick={() => navigate('/admin/health')}
              className={`${PythhTokens.button.ghost} flex items-center gap-2`}
            >
              System Health →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Recommendation Card Component
// ============================================================================

interface RecommendationCardProps {
  rec: MLRecommendation;
  isApplying: boolean;
  onApprove: () => void;
  onReject: () => void;
  formatDate: (iso: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function RecommendationCard({
  rec,
  isApplying,
  onApprove,
  onReject,
  formatDate,
  getStatusBadge,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(rec.status === 'pending');

  const currentWeights = rec.current_weights?.componentWeights || {};
  const recommendedWeights = rec.recommended_weights?.componentWeights || {};

  // Calculate diffs
  const diffs = Object.keys(COMPONENT_LABELS).map((key) => {
    const current = currentWeights[key] ?? 0;
    const recommended = recommendedWeights[key] ?? 0;
    const diff = recommended - current;
    return { key, label: COMPONENT_LABELS[key], current, recommended, diff };
  });

  const totalSamples = rec.sample_success_count + rec.sample_fail_count;

  return (
    <div className={`${PythhTokens.bg.glasPanel} rounded-xl overflow-hidden`}>
      {/* Header Row */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${rec.status === 'approved' ? 'bg-emerald-500/20' : 'bg-purple-500/20'}`}>
            <Zap className={`w-5 h-5 ${rec.status === 'approved' ? 'text-emerald-400' : 'text-purple-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{rec.weights_version}</span>
              {getStatusBadge(rec.status)}
            </div>
            <div className="text-sm text-white/50">
              {formatDate(rec.created_at)} • {totalSamples.toLocaleString()} samples • {(rec.confidence * 100).toFixed(0)}% confidence
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {rec.cross_time_stable && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Stable
            </span>
          )}
          <ChevronRight className={`w-5 h-5 text-white/50 transition ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10">
          {/* Weight Diffs Grid */}
          <div className="py-4">
            <h4 className="text-sm font-medium text-white/60 mb-3">Component Weight Changes</h4>
            <div className="grid grid-cols-5 gap-3">
              {diffs.map(({ key, label, current, recommended, diff }) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg text-center ${
                    Math.abs(diff) > 0.5 ? (diff > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10') : 'bg-white/5'
                  }`}
                >
                  <div className="text-xs text-white/50 mb-1">{label}</div>
                  <div className="text-lg font-mono text-white">
                    {current}% → {recommended}%
                  </div>
                  {diff !== 0 && (
                    <div className={`text-sm font-medium ${diff > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reasoning */}
          {rec.reasoning && rec.reasoning.length > 0 && (
            <div className="py-4 border-t border-white/10">
              <h4 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" /> ML Reasoning
              </h4>
              <ul className="space-y-1">
                {rec.reasoning.map((reason, i) => (
                  <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-purple-400 mt-1">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stats Row */}
          <div className="py-4 border-t border-white/10 grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-white/50">Success Samples</div>
              <div className="text-lg font-mono text-emerald-400">{rec.sample_success_count.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Fail Samples</div>
              <div className="text-lg font-mono text-red-400">{rec.sample_fail_count.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Positive Rate</div>
              <div className="text-lg font-mono text-white">{(rec.sample_positive_rate * 100).toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-xs text-white/50">Expected Lift</div>
              <div className="text-lg font-mono text-cyan-400">
                {rec.expected_improvement ? `+${rec.expected_improvement.toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>

          {/* Action Buttons (only for pending) */}
          {rec.status === 'pending' && (
            <div className="pt-4 border-t border-white/10 flex items-center gap-3">
              <button
                onClick={onApprove}
                disabled={isApplying}
                className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Approve & Activate
              </button>
              <button
                onClick={onReject}
                disabled={isApplying}
                className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}

          {/* Review Info (for approved/rejected) */}
          {(rec.status === 'approved' || rec.status === 'rejected') && rec.reviewed_at && (
            <div className="pt-4 border-t border-white/10 text-sm text-white/50">
              {rec.status === 'approved' ? '✅ Approved' : '❌ Rejected'} by {rec.reviewed_by || 'system'} on {formatDate(rec.reviewed_at)}
              {rec.rejection_reason && (
                <div className="mt-1 text-red-400">Reason: {rec.rejection_reason}</div>
              )}
            </div>
          )}
          
          {/* Expired Info */}
          {rec.status === 'expired' && (
            <div className="pt-4 border-t border-white/10 text-sm text-slate-500">
              ⏰ Expired (older than 7 days)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
