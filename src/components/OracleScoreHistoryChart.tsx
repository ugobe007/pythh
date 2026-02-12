// ============================================================================
// Oracle Score History Chart
// ============================================================================
// Visualizes fundraising readiness score improvements over time
// Shows:
//   - Total score trend line with benchmark at 70
//   - Category breakdown (team, traction, market, product, execution)
//   - Percentile ranking among all Oracle users
//   - Milestone markers
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Award, Calendar, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ScoreHistoryEntry {
  id: string;
  total_score: number;
  breakdown: {
    team?: number;
    traction?: number;
    market?: number;
    product?: number;
    execution?: number;
  } | null;
  milestone: string | null;
  recorded_at: string;
}

interface ScoreStats {
  currentScore: number;
  previousScore: number | null;
  change: number | null;
  percentile: number | null;
  trend: 'up' | 'down' | 'stable' | null;
}

interface OracleScoreHistoryChartProps {
  userId?: string;
  startupId?: string;
  height?: number;
  showBreakdown?: boolean;
}

export const OracleScoreHistoryChart: React.FC<OracleScoreHistoryChartProps> = ({
  userId,
  startupId,
  height = 400,
  showBreakdown = true,
}) => {
  const [history, setHistory] = useState<ScoreHistoryEntry[]>([]);
  const [stats, setStats] = useState<ScoreStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'total' | 'breakdown'>('total');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScoreHistory();
  }, [userId, startupId]);

  const fetchScoreHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch('/api/oracle/score-history', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch score history');
      }

      const data = await response.json();
      setHistory(data.history || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to fetch score history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load score history');
    } finally {
      setLoading(false);
    }
  };

  // Transform data for chart
  const chartData = history.map((entry) => ({
    date: new Date(entry.recorded_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: entry.recorded_at,
    totalScore: entry.total_score,
    team: entry.breakdown?.team || 0,
    traction: entry.breakdown?.traction || 0,
    market: entry.breakdown?.market || 0,
    product: entry.breakdown?.product || 0,
    execution: entry.breakdown?.execution || 0,
    milestone: entry.milestone,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-white/10 rounded-lg p-4 shadow-xl">
        <p className="text-white font-semibold text-sm mb-2">{data.date}</p>
        
        {view === 'total' ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/60 text-xs">Total Score:</span>
              <span className="text-purple-400 font-bold">{data.totalScore.toFixed(1)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-blue-400 text-xs">Team:</span>
              <span className="text-white font-semibold">{data.team.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-green-400 text-xs">Traction:</span>
              <span className="text-white font-semibold">{data.traction.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-yellow-400 text-xs">Market:</span>
              <span className="text-white font-semibold">{data.market.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-orange-400 text-xs">Product:</span>
              <span className="text-white font-semibold">{data.product.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-purple-400 text-xs">Execution:</span>
              <span className="text-white font-semibold">{data.execution.toFixed(1)}</span>
            </div>
          </div>
        )}
        
        {data.milestone && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <p className="text-amber-400 text-xs">🎉 {data.milestone}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-sm">
            No score history yet. Complete the Oracle wizard to start tracking your progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Score Progress
          </h3>
          <p className="text-white/40 text-sm mt-1">
            Track your fundraising readiness over time
          </p>
        </div>

        {showBreakdown && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('total')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                view === 'total'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              Total Score
            </button>
            <button
              onClick={() => setView('breakdown')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                view === 'breakdown'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              Categories
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Score */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Current Score</span>
              <Target className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-white">
                {stats.currentScore.toFixed(1)}
              </span>
              <span className="text-white/40 text-sm ml-1">/100</span>
            </div>
            {stats.change !== null && (
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={`text-xs font-medium ${
                    stats.change > 0
                      ? 'text-green-400'
                      : stats.change < 0
                      ? 'text-red-400'
                      : 'text-white/40'
                  }`}
                >
                  {stats.change > 0 ? '+' : ''}
                  {stats.change.toFixed(1)} vs last week
                </span>
              </div>
            )}
          </div>

          {/* Trend */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Trend</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              {stats.trend === 'up' && (
                <span className="text-emerald-400 text-lg font-semibold">↗ Rising</span>
              )}
              {stats.trend === 'down' && (
                <span className="text-red-400 text-lg font-semibold">↘ Declining</span>
              )}
              {stats.trend === 'stable' && (
                <span className="text-white/60 text-lg font-semibold">→ Stable</span>
              )}
              {stats.trend === null && (
                <span className="text-white/40 text-sm">Not enough data</span>
              )}
            </div>
          </div>

          {/* Percentile */}
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">Ranking</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              {stats.percentile !== null ? (
                <>
                  <span className="text-amber-400 text-lg font-semibold">
                    Top {stats.percentile}%
                  </span>
                  <p className="text-white/40 text-xs mt-1">Among Oracle users</p>
                </>
              ) : (
                <span className="text-white/40 text-sm">Computing...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-black/20 rounded-xl p-4">
        <ResponsiveContainer width="100%" height={height}>
          {view === 'total' ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                stroke="#ffffff40"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#ffffff60' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#ffffff40"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#ffffff60' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={70}
                stroke="#10b981"
                strokeDasharray="5 5"
                label={{
                  value: 'Fundable',
                  position: 'right',
                  fill: '#10b981',
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="totalScore"
                stroke="#a855f7"
                strokeWidth={3}
                fill="url(#scoreGradient)"
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                stroke="#ffffff40"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#ffffff60' }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#ffffff40"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#ffffff60' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="team"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Team"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="traction"
                stroke="#10b981"
                strokeWidth={2}
                name="Traction"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="market"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Market"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="product"
                stroke="#f97316"
                strokeWidth={2}
                name="Product"
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="execution"
                stroke="#a855f7"
                strokeWidth={2}
                name="Execution"
                dot={{ r: 3 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Fundable Threshold Indicator */}
      {stats && stats.currentScore < 70 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-300 text-sm font-medium">
                {(70 - stats.currentScore).toFixed(1)} points to "Fundable" threshold
              </p>
              <p className="text-amber-400/60 text-xs mt-1">
                Complete recommended actions to improve your score
              </p>
            </div>
          </div>
        </div>
      )}

      {stats && stats.currentScore >= 70 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-300 text-sm font-medium">
                🎉 You've reached "Fundable" status!
              </p>
              <p className="text-green-400/60 text-xs mt-1">
                Your startup is ready for investor conversations
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
