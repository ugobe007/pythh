/**
 * GOD Score Monitor - Real-time score distribution and health monitoring
 * Core admin tool for managing the GOD Algorithm
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, RefreshCw, AlertTriangle, CheckCircle, 
  TrendingUp, BarChart3, Play, Activity, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { API_BASE } from '../../lib/apiConfig';

interface ScoreDistribution {
  range: string;
  count: number;
  percent: number;
  color: string;
}

interface GODScoreHealth {
  status: 'healthy' | 'warning' | 'error';
  avgScore: number;
  totalStartups: number;
  distribution: ScoreDistribution[];
  alerts: string[];
}

export default function GODScoreMonitor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [health, setHealth] = useState<GODScoreHealth>({
    status: 'healthy',
    avgScore: 0,
    totalStartups: 0,
    distribution: [],
    alerts: []
  });
  const [lastRecalc, setLastRecalc] = useState<string | null>(null);

  useEffect(() => {
    loadScoreHealth();
    const interval = setInterval(loadScoreHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadScoreHealth = async () => {
    try {
      const { data: scores } = await supabase
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved');

      if (!scores || scores.length === 0) {
        setHealth({ status: 'warning', avgScore: 0, totalStartups: 0, distribution: [], alerts: ['No approved startups found'] });
        return;
      }

      const total = scores.length;
      const avg = scores.reduce((a, s) => a + (s.total_god_score || 0), 0) / total;

      // Calculate distribution
      const ranges = [
        { range: '40-49', min: 40, max: 50, color: 'bg-red-500' },
        { range: '50-59', min: 50, max: 60, color: 'bg-orange-500' },
        { range: '60-69', min: 60, max: 70, color: 'bg-yellow-500' },
        { range: '70-79', min: 70, max: 80, color: 'bg-green-500' },
        { range: '80+', min: 80, max: 101, color: 'bg-emerald-500' },
      ];

      const distribution: ScoreDistribution[] = ranges.map(r => {
        const count = scores.filter(s => s.total_god_score >= r.min && s.total_god_score < r.max).length;
        return {
          range: r.range,
          count,
          percent: Math.round((count / total) * 100 * 10) / 10,
          color: r.color
        };
      });

      // Check for health issues
      const alerts: string[] = [];
      let status: 'healthy' | 'warning' | 'error' = 'healthy';

      // Alert if too many in 40-49 range (legacy bug indicator)
      const lowBandPercent = distribution[0].percent;
      if (lowBandPercent > 30) {
        alerts.push(`⚠️ ${lowBandPercent}% of startups in 40-49 band - possible scoring issue`);
        status = 'error';
      } else if (lowBandPercent > 10) {
        alerts.push(`Note: ${lowBandPercent}% in 40-49 band`);
        status = 'warning';
      }

      // Alert if average is off
      if (avg < 50) {
        alerts.push(`⚠️ Average score ${avg.toFixed(1)} is below 50`);
        status = 'error';
      } else if (avg < 55) {
        alerts.push(`Average score ${avg.toFixed(1)} is slightly low`);
        if (status === 'healthy') status = 'warning';
      }

      // Check for elite drought
      const elitePercent = distribution[4].percent;
      if (elitePercent < 0.5) {
        alerts.push(`Elite drought: Only ${elitePercent}% scoring 80+`);
        if (status === 'healthy') status = 'warning';
      }

      setHealth({ status, avgScore: avg, totalStartups: total, distribution, alerts });
    } catch (error) {
      console.error('Error loading score health:', error);
      setHealth({ status: 'error', avgScore: 0, totalStartups: 0, distribution: [], alerts: ['Failed to load scores'] });
    } finally {
      setLoading(false);
    }
  };

  const triggerRecalculation = async () => {
    if (recalculating) return;
    
    if (!confirm('Trigger full GOD score recalculation? This will update all startup scores using the official algorithm.')) {
      return;
    }

    setRecalculating(true);
    try {
      const response = await fetch(`${API_BASE}/api/scrapers/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName: 'scripts/recalculate-scores.ts',
          description: 'GOD Score Recalculation'
        })
      });

      if (response.ok) {
        setLastRecalc(new Date().toISOString());
        alert('✅ Score recalculation started! Check AI Logs for progress.');
        setTimeout(loadScoreHealth, 5000); // Reload after 5s
      } else {
        throw new Error('Failed to start recalculation');
      }
    } catch (error) {
      console.error('Error triggering recalculation:', error);
      alert('❌ Failed to start recalculation. You can run manually:\nnpx tsx scripts/recalculate-scores.ts');
    } finally {
      setRecalculating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'error': return 'text-red-400 bg-red-500/20 border-red-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'error': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-orange-400 animate-spin" />
          <span className="text-slate-400">Loading GOD Score health...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-white">GOD Score Health</h3>
            <p className="text-xs text-slate-400">Real-time algorithm monitoring</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor(health.status)}`}>
          <StatusIcon status={health.status} />
          <span className="text-sm font-medium capitalize">{health.status}</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-4 grid grid-cols-3 gap-4 border-b border-slate-700">
        <div className="text-center">
          <div className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            {health.avgScore.toFixed(1)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Avg Score</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{health.totalStartups.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Startups</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-cyan-400">
            {health.distribution[4]?.percent || 0}%
          </div>
          <div className="text-xs text-slate-400 mt-1">Elite (80+)</div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-sm font-medium text-slate-300 mb-3">Score Distribution</div>
        <div className="space-y-2">
          {health.distribution.map((d) => (
            <div key={d.range} className="flex items-center gap-3">
              <div className="w-14 text-xs text-slate-400 text-right">{d.range}</div>
              <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden">
                <div 
                  className={`h-full ${d.color} transition-all duration-500`}
                  style={{ width: `${Math.max(d.percent, 1)}%` }}
                />
              </div>
              <div className="w-16 text-xs text-slate-300">
                {d.count} ({d.percent}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {health.alerts.length > 0 && (
        <div className="p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="text-sm font-medium text-slate-300 mb-2">Alerts</div>
          <div className="space-y-1">
            {health.alerts.map((alert, i) => (
              <div key={i} className="text-xs text-slate-400 flex items-start gap-2">
                <span>•</span>
                <span>{alert}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={triggerRecalculation}
          disabled={recalculating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50"
        >
          {recalculating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Recalculating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Recalculate Scores
            </>
          )}
        </button>
        <button
          onClick={() => navigate('/admin/god-scores')}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
        >
          <BarChart3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate('/admin/god-settings')}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
        >
          <Zap className="w-4 h-4" />
        </button>
      </div>

      {lastRecalc && (
        <div className="px-4 pb-3 text-xs text-slate-500">
          Last triggered: {new Date(lastRecalc).toLocaleString()}
        </div>
      )}
    </div>
  );
}
