import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ShareButton from "../../components/ShareButton";
import SaveToSignalCard from "../../components/SaveToSignalCard";

interface ConvergenceData {
  startup: {
    id: string;
    url: string;
    name?: string;
  };
  status: {
    velocity_class: string;
    signal_strength_0_10: number;
    fomo_state: string;
    observers_7d: number;
    comparable_tier: string;
    confidence: string;
  };
  visible_investors: Array<{
    name: string;
    thesis: string;
    match_score: number;
  }>;
  hidden_investors_total: number;
  comparable_startups: Array<{
    name: string;
    similarity_score: number;
  }>;
  alignment: {
    team_0_1: number;
    market_0_1: number;
    execution_0_1: number;
    portfolio_0_1: number;
    message: string;
  };
  improve_actions: Array<{
    title: string;
    impact_pct: number;
    steps: string[];
    category: string;
  }>;
}

export default function StartupIntelligence() {
  const { id } = useParams();
  const [data, setData] = useState<ConvergenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConvergence() {
      try {
        setLoading(true);
        // Try to fetch from convergence endpoint
        // id might be a URL or startup ID
        const urlParam = id?.startsWith('http') ? id : `https://${id}`;
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/discovery/convergence?url=${encodeURIComponent(urlParam)}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch startup intelligence');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchConvergence();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
          <div className="h-3 bg-white/10 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-white/10 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="text-sm font-semibold text-red-400">Error</div>
        <div className="mt-2 text-sm text-white/60">{error || 'No data available'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-2xl font-bold text-white">{data.startup.name || data.startup.url}</div>
            <div className="mt-1 text-sm text-white/60">{data.startup.id}</div>
          </div>
          <div className="flex items-center gap-3">
            <SaveToSignalCard
              entityType="startup"
              entityId={data.startup.id}
              entityName={data.startup.name || data.startup.url}
              scoreValue={data.status.signal_strength_0_10 * 10}
              context="from intelligence"
              size="sm"
            />
            <ShareButton
              payload={{
                type: 'score_snapshot',
                startupName: data.startup.name || data.startup.url,
                lensLabel: 'Signal Intelligence',
                score: data.status.signal_strength_0_10 * 10,
                topDrivers: [
                  `Velocity: ${data.status.velocity_class}`,
                  `FOMO State: ${data.status.fomo_state}`,
                  `Observers (7d): ${data.status.observers_7d}`,
                ],
              }}
              size="sm"
            />
            <div className="rounded-lg bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
              {data.status.confidence.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-white/50 uppercase">Velocity</div>
            <div className="mt-1 text-lg font-semibold text-white">{data.status.velocity_class}</div>
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase">Signal Strength</div>
            <div className="mt-1 text-lg font-semibold text-white">{data.status.signal_strength_0_10.toFixed(1)}/10</div>
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase">FOMO State</div>
            <div className="mt-1 text-lg font-semibold text-white capitalize">{data.status.fomo_state}</div>
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase">Observers (7d)</div>
            <div className="mt-1 text-lg font-semibold text-white">{data.status.observers_7d}</div>
          </div>
        </div>
      </div>

      {/* Alignment Scores */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold text-white mb-4">Alignment Scores</div>
        <div className="space-y-3">
          {[
            { label: 'Team', value: data.alignment.team_0_1 },
            { label: 'Market', value: data.alignment.market_0_1 },
            { label: 'Execution', value: data.alignment.execution_0_1 },
            { label: 'Portfolio Fit', value: data.alignment.portfolio_0_1 }
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">{item.label}</span>
                <span className="text-white font-medium">{Math.round(item.value * 100)}%</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{ width: `${item.value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {data.alignment.message && (
          <div className="mt-4 text-sm text-white/60 italic">{data.alignment.message}</div>
        )}
      </div>

      {/* Visible Investors */}
      {data.visible_investors.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-white">Top Matches</div>
            {data.hidden_investors_total > 0 && (
              <div className="text-sm text-white/50">+{data.hidden_investors_total} more</div>
            )}
          </div>
          <div className="space-y-3">
            {data.visible_investors.map((investor, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 rounded-lg bg-white/5">
                <div className="flex-1">
                  <div className="font-medium text-white">{investor.name}</div>
                  <div className="text-sm text-white/60 mt-1">{investor.thesis}</div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-lg font-semibold text-emerald-400">{investor.match_score}%</div>
                  <div className="text-xs text-white/50">match</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Actions */}
      {data.improve_actions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold text-white mb-4">Recommended Actions</div>
          <div className="space-y-4">
            {data.improve_actions.map((action, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-white/5">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-white">{action.title}</div>
                  <div className="text-emerald-400 text-sm font-semibold">+{action.impact_pct}%</div>
                </div>
                <ul className="space-y-1 text-sm text-white/60">
                  {action.steps.map((step, sidx) => (
                    <li key={sidx} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparable Startups */}
      {data.comparable_startups.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold text-white mb-4">Similar Startups</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.comparable_startups.map((startup, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-white/5 text-center">
                <div className="text-sm font-medium text-white">{startup.name}</div>
                <div className="text-xs text-white/50 mt-1">{Math.round(startup.similarity_score * 100)}% similar</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
