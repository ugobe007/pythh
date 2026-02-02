/**
 * ScorecardBlock Component v2
 * 
 * Canonical scorecard UI matching the verification pipeline spec.
 * 
 * Shows:
 * - Signal Score + GOD Score with deltas
 * - Confidence/Verification/Freshness badges
 * - Top movers (why it moved) with reason chips
 * - Blocking factors (hard/soft) with fix paths
 * - Connected sources status
 * - Action CTAs
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle, 
  XCircle, 
  CheckCircle,
  RefreshCw,
  Plus,
  Link2,
  ChevronDown,
  ChevronUp,
  Clock,
  Shield,
  Zap,
  ExternalLink,
  Plug,
  FileText,
  AlertCircle
} from 'lucide-react';
import type { 
  ScorecardData, 
  BlockingFactor, 
  ConnectorProvider, 
  ConnectorStatus,
  DeltaReason 
} from '@/types/verification';

// ============================================================================
// TYPES
// ============================================================================

interface ScorecardBlockProps {
  startupId: string;
  mode?: 'compact' | 'full';
  onReportAction?: () => void;
  onConnectSources?: () => void;
  onFix?: (path: string) => void;
  onViewEvidence?: () => void;
  className?: string;
}

interface ApiScorecardData {
  signalScore: number;
  godScore: number;
  delta: {
    signal: number;
    god: number;
    direction: 'up' | 'down' | 'flat';
  };
  confidence: number;
  verification: number;
  freshness: number;
  lastUpdated: string;
  topMovers: Array<{
    featureId: string;
    label: string;
    delta: number;
    reasons: DeltaReason[];
  }>;
  blockers: BlockingFactor[];
  connectedSources: Array<{
    provider: ConnectorProvider;
    status: ConnectorStatus;
  }>;
  pendingActions: number;
  verifiedActions: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRecency(isoString: string): string {
  if (!isoString) return 'never';
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

function formatReasonChip(reason: DeltaReason): string {
  const labels: Record<string, string> = {
    new_feature_added: 'new',
    feature_removed: 'removed',
    signal_strength_changed: 'signal',
    confidence_changed: 'confidence',
    verification_changed: 'verified ✓',
    freshness_changed: 'freshness',
    weight_changed: 'weight'
  };
  return labels[reason] || reason;
}

function getProviderIcon(provider: ConnectorProvider): string {
  const icons: Record<string, string> = {
    stripe: '💳',
    github: '🐙',
    ga4: '📊',
    plaid: '🏦',
    hubspot: '🔶',
    linear: '📐',
    notion: '📓'
  };
  return icons[provider] || '🔗';
}

function getProviderLabel(provider: ConnectorProvider): string {
  const labels: Record<string, string> = {
    stripe: 'Stripe',
    github: 'GitHub',
    ga4: 'GA4',
    plaid: 'Plaid',
    hubspot: 'HubSpot',
    linear: 'Linear',
    notion: 'Notion'
  };
  return labels[provider] || provider;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Score Header with both Signal and GOD
const ScoreHeader: React.FC<{
  signalScore: number;
  godScore: number;
  delta: { signal: number; god: number; direction: 'up' | 'down' | 'flat' };
  confidence: number;
  verification: number;
  freshness: number;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  compact?: boolean;
}> = ({ signalScore, godScore, delta, confidence, verification, freshness, lastUpdated, onRefresh, isRefreshing, compact }) => {
  const getDeltaIcon = (direction: 'up' | 'down' | 'flat') => {
    if (direction === 'up') return <TrendingUp className="w-4 h-4" />;
    if (direction === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };
  
  const getDeltaColor = (value: number) => {
    if (value > 0.01) return 'text-emerald-500';
    if (value < -0.01) return 'text-red-500';
    return 'text-gray-400';
  };

  return (
    <div className="mb-4">
      {/* Scores row */}
      <div className="flex items-start justify-between">
        <div className="flex gap-6">
          {/* Signal Score */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Signal</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {(signalScore * 100).toFixed(1)}
              </span>
              <div className={`flex items-center gap-1 text-sm ${getDeltaColor(delta.signal)}`}>
                {getDeltaIcon(delta.direction)}
                <span className="font-semibold">
                  {delta.signal >= 0 ? '+' : ''}{(delta.signal * 100).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
          
          {/* GOD Score */}
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">GOD</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {godScore.toFixed(1)}
              </span>
              <div className={`flex items-center gap-1 text-sm ${getDeltaColor(delta.god)}`}>
                {getDeltaIcon(delta.god >= 0.01 ? 'up' : delta.god <= -0.01 ? 'down' : 'flat')}
                <span className="font-semibold">
                  {delta.god >= 0 ? '+' : ''}{delta.god.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            title="Refresh scorecard"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs text-gray-400">{formatRecency(lastUpdated)}</span>
        </div>
      </div>
      
      {/* Quality badges */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
          <Shield className="w-3 h-3 text-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">Conf</span>
          <span className="font-semibold text-gray-900 dark:text-white">{(confidence * 100).toFixed(0)}%</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          <span className="text-gray-600 dark:text-gray-400">Ver</span>
          <span className="font-semibold text-gray-900 dark:text-white">{(verification * 100).toFixed(0)}%</span>
        </span>
        <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800">
          <Zap className="w-3 h-3 text-amber-500" />
          <span className="text-gray-600 dark:text-gray-400">Fresh</span>
          <span className="font-semibold text-gray-900 dark:text-white">{(freshness * 100).toFixed(0)}%</span>
        </span>
      </div>
    </div>
  );
};

// Top Movers Section
const TopMoversSection: React.FC<{
  movers: Array<{
    featureId: string;
    label: string;
    delta: number;
    reasons: DeltaReason[];
  }>;
  onViewEvidence?: () => void;
}> = ({ movers, onViewEvidence }) => {
  if (movers.length === 0) return null;
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Why It Moved
      </h4>
      <div className="space-y-2">
        {movers.slice(0, 5).map((mover, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-semibold min-w-[40px] ${
                mover.delta > 0 ? 'text-emerald-500' : mover.delta < 0 ? 'text-red-500' : 'text-gray-400'
              }`}>
                {mover.delta > 0 ? '+' : ''}{(mover.delta * 100).toFixed(1)}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {mover.label}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {mover.reasons.slice(0, 2).map((reason, i) => (
                <span
                  key={i}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    reason === 'verification_changed'
                      ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {formatReasonChip(reason)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {onViewEvidence && (
        <button
          onClick={onViewEvidence}
          className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          View evidence <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// Blocking Factors Section
const BlockingFactorsSection: React.FC<{
  blockers: BlockingFactor[];
  onFix?: (path: string) => void;
}> = ({ blockers, onFix }) => {
  const [expanded, setExpanded] = useState(blockers.some(b => b.severity === 'hard'));
  
  if (blockers.length === 0) return null;
  
  const hardBlockers = blockers.filter(b => b.severity === 'hard');
  const softBlockers = blockers.filter(b => b.severity === 'soft');
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
      >
        <span className="flex items-center gap-2">
          Blocking Factors
          {hardBlockers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px]">
              {hardBlockers.length} hard
            </span>
          )}
          {softBlockers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">
              {softBlockers.length} soft
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="space-y-2">
          {/* Hard blockers */}
          {hardBlockers.map((blocker, idx) => (
            <div
              key={`hard-${idx}`}
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800"
            >
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400">HARD</span>
                    <span className="text-xs font-mono text-red-500">{blocker.id}</span>
                  </div>
                  <p className="text-sm text-red-800 dark:text-red-200 mt-1">{blocker.message}</p>
                  {onFix && (
                    <button
                      onClick={() => onFix(blocker.fixPath)}
                      className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      Fix Now → <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Soft blockers */}
          {softBlockers.map((blocker, idx) => (
            <div
              key={`soft-${idx}`}
              className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">SOFT</span>
                    <span className="text-xs font-mono text-amber-500">{blocker.id}</span>
                  </div>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{blocker.message}</p>
                  {onFix && (
                    <button
                      onClick={() => onFix(blocker.fixPath)}
                      className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      Upload Proof → <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Connected Sources Mini Panel
const ConnectedSourcesSection: React.FC<{
  sources: Array<{ provider: ConnectorProvider; status: ConnectorStatus }>;
  onConnect?: () => void;
}> = ({ sources, onConnect }) => {
  const allProviders: ConnectorProvider[] = ['stripe', 'ga4', 'github', 'plaid', 'hubspot'];
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Connected Sources
      </h4>
      <div className="flex flex-wrap gap-2">
        {allProviders.map(provider => {
          const source = sources.find(s => s.provider === provider);
          const status = source?.status || 'not_connected';
          
          return (
            <div
              key={provider}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                status === 'connected'
                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                  : status === 'error' || status === 'expired'
                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              <span>{getProviderIcon(provider)}</span>
              <span>{getProviderLabel(provider)}</span>
              {status === 'connected' && <CheckCircle className="w-3 h-3" />}
              {status === 'error' && <AlertCircle className="w-3 h-3" />}
              {status === 'expired' && <Clock className="w-3 h-3" />}
            </div>
          );
        })}
      </div>
      {onConnect && (
        <button
          onClick={onConnect}
          className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          <Plug className="w-3 h-3" /> Connect more sources
        </button>
      )}
    </div>
  );
};

// Action CTAs
const ActionCTAs: React.FC<{
  pendingActions: number;
  verifiedActions: number;
  onReportAction?: () => void;
  onConnectSources?: () => void;
}> = ({ pendingActions, verifiedActions, onReportAction, onConnectSources }) => {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">
          {pendingActions} pending · {verifiedActions} verified
        </span>
      </div>
      <div className="flex gap-2">
        {onReportAction && (
          <button
            onClick={onReportAction}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Action
          </button>
        )}
        {onConnectSources && (
          <button
            onClick={onConnectSources}
            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ScorecardBlockV2: React.FC<ScorecardBlockProps> = ({
  startupId,
  mode = 'compact',
  onReportAction,
  onConnectSources,
  onFix,
  onViewEvidence,
  className = ''
}) => {
  const [data, setData] = useState<ApiScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchScorecard = useCallback(async () => {
    try {
      // Use canonical endpoint (not v1/v2 path)
      const response = await fetch(`/api/scorecard/${startupId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch scorecard');
      }
      
      const json = await response.json();
      if (json.ok && json.data) {
        // Map canonical response to component shape
        const raw = json.data;
        const mapped: ApiScorecardData = {
          signalScore: (raw.signal?.value || 0) / 100, // Normalize to 0-1
          godScore: raw.god?.value || 0,
          delta: {
            signal: (raw.signal?.delta || 0) / 100,
            god: raw.god?.delta || 0,
            direction: (raw.signal?.delta || 0) > 0.01 ? 'up' : (raw.signal?.delta || 0) < -0.01 ? 'down' : 'flat'
          },
          confidence: raw.badges?.confidence || 0.7,
          verification: raw.badges?.verification || 0.2,
          freshness: raw.badges?.freshness || 0.5,
          lastUpdated: raw.badges?.updatedAt || new Date().toISOString(),
          topMovers: (raw.movers || []).map((m: any) => ({
            featureId: m.featureId || m.label?.toLowerCase().replace(/\s/g, '_') || 'unknown',
            label: m.label || 'Unknown',
            delta: m.delta || 0,
            reasons: m.chips || []
          })),
          blockers: (raw.blockers || []).map((b: any) => ({
            id: b.id,
            severity: b.severity,
            message: b.message,
            fixPath: b.ctaPath || '/settings'
          })),
          connectedSources: (raw.sources || []).map((s: any) => ({
            provider: s.provider,
            status: s.status
          })),
          pendingActions: raw.snapshot?.pendingActions || 0,
          verifiedActions: raw.snapshot?.verifiedActions || 0
        };
        setData(mapped);
        setError(null);
      } else {
        throw new Error(json.error?.message || 'Invalid response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [startupId]);

  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchScorecard();
  };

  if (loading && !data) {
    return (
      <div className={`p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`p-6 bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-800 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-4 text-sm text-indigo-600 hover:text-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          Scorecard
        </h3>
      </div>

      {/* Score Header */}
      <ScoreHeader
        signalScore={data.signalScore}
        godScore={data.godScore}
        delta={data.delta}
        confidence={data.confidence}
        verification={data.verification}
        freshness={data.freshness}
        lastUpdated={data.lastUpdated}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        compact={mode === 'compact'}
      />

      {/* Top Movers */}
      <TopMoversSection
        movers={data.topMovers}
        onViewEvidence={onViewEvidence}
      />

      {/* Blocking Factors */}
      <BlockingFactorsSection
        blockers={data.blockers}
        onFix={onFix}
      />

      {/* Connected Sources (only in full mode or if there are issues) */}
      {(mode === 'full' || data.connectedSources.some(s => s.status !== 'connected')) && (
        <ConnectedSourcesSection
          sources={data.connectedSources}
          onConnect={onConnectSources}
        />
      )}

      {/* Action CTAs */}
      <ActionCTAs
        pendingActions={data.pendingActions}
        verifiedActions={data.verifiedActions}
        onReportAction={onReportAction}
        onConnectSources={mode === 'compact' ? onConnectSources : undefined}
      />
    </div>
  );
};

export default ScorecardBlockV2;
