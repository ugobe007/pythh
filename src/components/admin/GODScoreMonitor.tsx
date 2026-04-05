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
import { API_BASE } from '../../lib/apiConfig';

interface ScoreDistribution {
  range: string;
  count: number;
  percent: number;
  color: string;
}

interface GodComponentAverages {
  n: number;
  team: number | null;
  traction: number | null;
  market: number | null;
  product: number | null;
  vision: number | null;
}

interface EnrichmentSummary {
  total: number;
  by_tier: { A: number; B: number; C: number; unknown: number };
  by_startup_status: Record<string, number>;
  needs_enrichment: number;
  criteria?: string;
}

interface InferencePipelinePayload {
  defaults?: Record<string, number | boolean>;
  resolved?: Record<string, number | boolean>;
  env_overrides?: Record<string, string>;
  error?: string;
}

interface GODScoreHealth {
  status: 'healthy' | 'warning' | 'error';
  avgScore: number;
  totalStartups: number;
  distribution: ScoreDistribution[];
  alerts: string[];
  godComponentAverages?: GodComponentAverages;
  enrichment?: EnrichmentSummary & {
    enrichment_signals?: {
      with_ontology_inference?: number;
      with_market_signals_in_extracted_data?: number;
    };
  };
  ontologyLibraries?: Record<string, unknown>;
  oracleSummary?: Record<string, unknown>;
  inferencePipeline?: InferencePipelinePayload;
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
    alerts: [],
    godComponentAverages: undefined,
    enrichment: undefined,
    ontologyLibraries: undefined,
    oracleSummary: undefined,
    inferencePipeline: undefined,
  });
  const [lastRecalc, setLastRecalc] = useState<string | null>(null);

  useEffect(() => {
    loadScoreHealth();
    const interval = setInterval(loadScoreHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadScoreHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/score-health`);
      if (!res.ok) throw new Error(`score-health ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error('Error loading score health:', error);
      setHealth({
        status: 'error',
        avgScore: 0,
        totalStartups: 0,
        distribution: [],
        alerts: ['Failed to load scores'],
      });
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

      {/* GOD component breakdown (same sub-scores as startupScoringService) */}
      {health.godComponentAverages && health.godComponentAverages.n > 0 && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-2">GOD component averages (approved)</div>
          <p className="text-xs text-slate-500 mb-3">
            Based on {health.godComponentAverages.n} startups with all five sub-scores present — use to spot drift before changing weights in{' '}
            <code className="text-slate-400">startupScoringService.ts</code>.
          </p>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {[
              ['Team', health.godComponentAverages.team],
              ['Traction', health.godComponentAverages.traction],
              ['Market', health.godComponentAverages.market],
              ['Product', health.godComponentAverages.product],
              ['Vision', health.godComponentAverages.vision],
            ].map(([label, v]) => (
              <div key={label as string} className="rounded-lg bg-slate-900/60 border border-slate-700/80 py-2">
                <div className="text-slate-500">{label}</div>
                <div className="text-lg font-semibold text-amber-300/90">{v != null ? v.toFixed(2) : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enrichment queue */}
      {health.enrichment && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-2">Enrichment & data tier</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-700">
              <div className="text-slate-500">Needs enrichment</div>
              <div className="text-xl font-bold text-orange-300">{health.enrichment.needs_enrichment}</div>
              <div className="text-slate-600 mt-1">/ {health.enrichment.total} rows</div>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-700">
              <div className="text-slate-500">Tier A / B / C</div>
              <div className="text-slate-200">
                {health.enrichment.by_tier.A} / {health.enrichment.by_tier.B} / {health.enrichment.by_tier.C}
              </div>
              <div className="text-slate-600 mt-1">unknown: {health.enrichment.by_tier.unknown}</div>
            </div>
            <div className="rounded-lg bg-slate-900/50 p-2 border border-slate-700 col-span-2">
              <div className="text-slate-500 mb-1">By startup status</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(health.enrichment.by_startup_status).map(([k, v]) => (
                  <span key={k} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {health.enrichment.criteria && (
            <p className="text-[11px] text-slate-600 mt-2">{health.enrichment.criteria}</p>
          )}
          {health.enrichment.enrichment_signals && (
            <div className="mt-3 rounded-lg bg-slate-900/40 border border-slate-700/80 p-2 text-[11px] text-slate-400">
              <span className="text-slate-500">News enrichment in </span>
              <code className="text-cyan-400/90">extracted_data</code>
              <span className="text-slate-500">: </span>
              ontology_inference{' '}
              <span className="text-slate-200">{health.enrichment.enrichment_signals.with_ontology_inference ?? 0}</span>
              {' · '}
              market_signals{' '}
              <span className="text-slate-200">
                {health.enrichment.enrichment_signals.with_market_signals_in_extracted_data ?? 0}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Inference pipeline config (RSS / ontology limits) */}
      {health.inferencePipeline && !health.inferencePipeline.error && health.inferencePipeline.resolved && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-2">Inference pipeline (resolved limits)</div>
          <div className="text-[11px] text-slate-500 font-mono space-y-1">
            <div>
              ENRICH_MAX_EXTENDED_SOURCES: {health.inferencePipeline.resolved.ENRICH_MAX_EXTENDED_SOURCES} ·
              SEARCH_MAX_ARTICLES: {health.inferencePipeline.resolved.SEARCH_MAX_ARTICLES} ·
              ONTOLOGY_NEWS_MAX_SENTENCES: {health.inferencePipeline.resolved.ONTOLOGY_NEWS_MAX_SENTENCES}
            </div>
            <div>
              INFERENCE_BATCH_LIMIT: {health.inferencePipeline.resolved.INFERENCE_BATCH_LIMIT} · RSS_ENRICH_DAYS_LOOKBACK:{' '}
              {health.inferencePipeline.resolved.RSS_ENRICH_DAYS_LOOKBACK}
            </div>
            <div>
              quickEnrich lite (GN only, no extended RSS):{' '}
              {health.inferencePipeline.resolved.QUICK_ENRICH_LITE === false ? 'off' : 'on'} · SPARSE_NEWS_TIMEOUT_MS:{' '}
              {health.inferencePipeline.resolved.SPARSE_ENRICH_NEWS_TIMEOUT_MS}
            </div>
            {health.inferencePipeline.env_overrides &&
              Object.keys(health.inferencePipeline.env_overrides).length > 0 && (
                <div className="text-amber-400/90 pt-1">
                  Env overrides: {JSON.stringify(health.inferencePipeline.env_overrides)}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Ontology libraries (parser-linked) */}
      {health.ontologyLibraries && !('error' in health.ontologyLibraries && health.ontologyLibraries.error) && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-2">Ontology libraries</div>
          <div className="text-xs text-slate-400 space-y-1 font-mono">
            {'signalOntology_v1_regex' in health.ontologyLibraries && (
              <div>
                signalOntology.js — ACTION_MAP:{' '}
                {(health.ontologyLibraries as { signalOntology_v1_regex?: { action_map_entries?: number } }).signalOntology_v1_regex?.action_map_entries ?? '—'}{' '}
                entries; anchors (v2):{' '}
                {(health.ontologyLibraries as { signal_ontology_v2_anchors?: { anchor_phrases_indexed?: number } }).signal_ontology_v2_anchors?.anchor_phrases_indexed ?? '—'}
              </div>
            )}
            {'wiring' in health.ontologyLibraries && (
              <div className="text-slate-500 mt-2 space-y-0.5">
                {Object.entries((health.ontologyLibraries as { wiring: Record<string, string> }).wiring).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-slate-600">{k}:</span> {v}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Oracle (signed-in product) */}
      {health.oracleSummary && health.oracleSummary.ok !== false && 'counts' in health.oracleSummary && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-2">Oracle service (DB)</div>
          <div className="text-xs text-slate-400 flex flex-wrap gap-3">
            <span>sessions: {(health.oracleSummary as { counts: { oracle_sessions: number } }).counts.oracle_sessions}</span>
            <span>actions: {(health.oracleSummary as { counts: { oracle_actions: number } }).counts.oracle_actions}</span>
            <span>insights: {(health.oracleSummary as { counts: { oracle_insights: number } }).counts.oracle_insights}</span>
          </div>
          {'oracle_sessions_by_status' in health.oracleSummary && (
            <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-2">
              {Object.entries((health.oracleSummary as { oracle_sessions_by_status: Record<string, number> }).oracle_sessions_by_status).map(
                ([k, v]) => (
                  <span key={k}>
                    {k}: {v}
                  </span>
                ),
              )}
            </div>
          )}
          {'note' in health.oracleSummary && (
            <p className="text-[11px] text-slate-600 mt-2">{(health.oracleSummary as { note?: string }).note}</p>
          )}
        </div>
      )}

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
