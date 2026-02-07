// ============================================================================
// Pythh Oracle — Signal Actions Page
// ============================================================================
// Full view of all signal actions (tasks) for a startup.
// Filterable by status, priority, signal dimension.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Target,
  Loader2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Zap,
  Filter,
  TrendingUp,
  Clock,
  X,
} from 'lucide-react';
import {
  getStartupActions,
  updateActionStatus,
  type OracleAction,
} from '../../services/oracleService';
import { useOracleStartupId } from '../../hooks/useOracleStartupId';

const DIMENSION_LABELS: Record<string, string> = {
  founder_language_shift: 'Founder Language',
  investor_receptivity: 'Investor Receptivity',
  news_momentum: 'News Momentum',
  capital_convergence: 'Capital Convergence',
  execution_velocity: 'Execution Velocity',
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function OracleActionsPage() {
  const navigate = useNavigate();
  const startupId = useOracleStartupId();

  const [actions, setActions] = useState<OracleAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'dismissed'>('all');

  useEffect(() => {
    if (!startupId) return;
    getStartupActions(startupId)
      .then(setActions)
      .catch(() => setActions([]))
      .finally(() => setLoading(false));
  }, [startupId]);

  const filtered = useMemo(() => {
    let list = [...actions];
    if (filter !== 'all') {
      list = list.filter((a) =>
        filter === 'pending'
          ? a.status === 'pending' || a.status === 'in_progress'
          : a.status === filter,
      );
    }
    return list.sort((a, b) => (PRIORITY_ORDER[a.priority] || 3) - (PRIORITY_ORDER[b.priority] || 3));
  }, [actions, filter]);

  const handleUpdate = async (id: string, status: 'in_progress' | 'completed' | 'dismissed') => {
    if (!startupId) return;
    setUpdating(id);
    try {
      await updateActionStatus(id, status);
      const updated = await getStartupActions(startupId);
      setActions(updated);
    } finally {
      setUpdating(null);
    }
  };

  const totalLift = actions
    .filter((a) => a.status === 'pending' || a.status === 'in_progress')
    .reduce((sum, a) => sum + (a.estimated_lift || 0), 0);

  const completedCount = actions.filter((a) => a.status === 'completed').length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/app/oracle')}
            className="text-white/40 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Target className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-semibold text-white/90">Signal Actions</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{actions.length}</p>
            <p className="text-xs text-white/40">Total Actions</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{completedCount}</p>
            <p className="text-xs text-emerald-400/60">Completed</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">+{totalLift.toFixed(1)}</p>
            <p className="text-xs text-amber-400/60">Potential Signal Lift</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/30" />
          {(['all', 'pending', 'completed', 'dismissed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition border ${
                filter === f
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Actions List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Target className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">
              {filter === 'all'
                ? 'No actions yet. Complete the wizard to generate tasks.'
                : `No ${filter} actions.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                updating={updating === action.id}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Card
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  updating,
  onUpdate,
}: {
  action: OracleAction;
  updating: boolean;
  onUpdate: (id: string, status: 'in_progress' | 'completed' | 'dismissed') => Promise<void>;
}) {
  const priorityBadge = () => {
    switch (action.priority) {
      case 'critical':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Critical
          </span>
        );
      case 'high':
        return (
          <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3" /> High
          </span>
        );
      case 'medium':
        return (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
            Medium
          </span>
        );
      default:
        return (
          <span className="text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded-full">Low</span>
        );
    }
  };

  const statusBadge = () => {
    switch (action.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'dismissed':
        return <X className="w-5 h-5 text-white/30" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-amber-400" />;
      default:
        return <Circle className="w-5 h-5 text-white/20" />;
    }
  };

  const isActionable = action.status === 'pending' || action.status === 'in_progress';

  return (
    <div
      className={`border rounded-2xl p-5 transition ${
        action.status === 'completed'
          ? 'bg-emerald-500/5 border-emerald-500/20 opacity-70'
          : action.status === 'dismissed'
          ? 'bg-white/[0.02] border-white/5 opacity-50'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{statusBadge()}</div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-medium text-white/90">{action.title}</h3>
            {priorityBadge()}
          </div>
          <p className="text-xs text-white/50">{action.description}</p>

          <div className="flex items-center gap-4 text-xs text-white/30">
            {action.signal_dimension && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {DIMENSION_LABELS[action.signal_dimension] || action.signal_dimension}
              </span>
            )}
            {action.estimated_lift > 0 && (
              <span className="text-emerald-400/60">
                +{action.estimated_lift.toFixed(1)} potential lift
              </span>
            )}
          </div>

          {isActionable && !updating && (
            <div className="flex items-center gap-2 pt-2">
              {action.status === 'pending' && (
                <button
                  onClick={() => onUpdate(action.id, 'in_progress')}
                  className="text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg transition"
                >
                  Start Working
                </button>
              )}
              <button
                onClick={() => onUpdate(action.id, 'completed')}
                className="text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition"
              >
                Mark Done
              </button>
              <button
                onClick={() => onUpdate(action.id, 'dismissed')}
                className="text-xs text-white/30 hover:text-white/60 px-3 py-1.5 rounded-lg transition"
              >
                Dismiss
              </button>
            </div>
          )}
          {updating && <Loader2 className="w-4 h-4 text-white/30 animate-spin mt-2" />}
        </div>
      </div>
    </div>
  );
}
