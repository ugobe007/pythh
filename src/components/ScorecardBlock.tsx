/**
 * ScorecardBlock Component
 * 
 * The canonical scorecard UI block that appears on:
 * - Signals Radar right column (compact mode)
 * - Startup Scorecard page (full mode)
 * 
 * Shows:
 * - Signal Score with delta
 * - Confidence/Verification/Freshness badges
 * - Top movers (why it moved)
 * - Blocking factors (hard/soft)
 * - Evidence status
 * - Action CTAs
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
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
  ExternalLink
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface TopMover {
  featureId: string;
  featureName: string;
  delta: number;
  direction: 'up' | 'down';
  reasons: string[];
  verification: number;
}

interface Blocker {
  id: string;
  message: string;
  fixPath: string;
  affectedFeatures: string[];
}

interface ConnectedSource {
  type: string;
  name: string;
  status: 'active' | 'expired' | 'disconnected' | 'error';
  lastSync: string | null;
}

interface PendingVerification {
  id: string;
  title: string;
  category: string;
  deadline: string;
}

interface ScorecardData {
  signalScore: number;
  delta: {
    value: number;
    direction: 'up' | 'down';
  };
  confidence: number;
  verification: number;
  freshness: number;
  lastUpdated: string;
  topMovers: TopMover[];
  blockingFactors: {
    hard: Blocker[];
    soft: Blocker[];
    count: number;
  };
  evidence: {
    connectedSources: ConnectedSource[];
    pendingVerifications: PendingVerification[];
  };
}

interface ScorecardBlockProps {
  startupId: string;
  mode?: 'compact' | 'full';
  onReportAction?: () => void;
  onConnectSources?: () => void;
  onResolveConflicts?: () => void;
  className?: string;
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

function formatReasonChip(reason: string): string {
  const labels: Record<string, string> = {
    new_feature_added: 'new',
    feature_removed: 'removed',
    signal_strength_changed: 'signal',
    confidence_changed: 'confidence',
    verification_changed: 'verified',
    freshness_changed: 'freshness',
    weight_changed: 'weight'
  };
  return labels[reason] || reason;
}

function getSourceIcon(type: string): string {
  const icons: Record<string, string> = {
    stripe: '💳',
    github: '🐙',
    ga4: '📊',
    plaid: '🏦',
    hubspot: '🔶',
    domain: '🌐',
    document: '📄'
  };
  return icons[type] || '🔗';
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Score Header
const ScoreHeader: React.FC<{
  score: number;
  delta: { value: number; direction: 'up' | 'down' };
  confidence: number;
  verification: number;
  freshness: number;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}> = ({ score, delta, confidence, verification, freshness, lastUpdated, onRefresh, isRefreshing }) => {
  const deltaColor = delta.direction === 'up' ? 'text-emerald-500' : 'text-red-500';
  const DeltaIcon = delta.direction === 'up' ? TrendingUp : TrendingDown;
  
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">
            {score.toFixed(1)}
          </span>
          <div className={`flex items-center gap-1 ${deltaColor}`}>
            <DeltaIcon className="w-4 h-4" />
            <span className="font-semibold">
              {delta.direction === 'up' ? '+' : ''}{delta.value.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1 text-gray-500">
            <Shield className="w-3 h-3" />
            Conf {(confidence * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <CheckCircle className="w-3 h-3" />
            Ver {(verification * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <Zap className="w-3 h-3" />
            Fresh {(freshness * 100).toFixed(0)}%
          </span>
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
  );
};

// Top Movers Section
const TopMoversSection: React.FC<{
  movers: TopMover[];
  onViewEvidence?: () => void;
}> = ({ movers, onViewEvidence }) => {
  if (movers.length === 0) return null;
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Why It Moved
      </h4>
      <div className="space-y-2">
        {movers.map((mover, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-semibold ${
                mover.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {mover.direction === 'up' ? '+' : ''}{mover.delta.toFixed(1)}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {mover.featureName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {mover.reasons.slice(0, 2).map((reason, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
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
          View Evidence <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// Blocking Factors Section
const BlockingFactorsSection: React.FC<{
  blockers: { hard: Blocker[]; soft: Blocker[]; count: number };
  onFix?: (path: string) => void;
}> = ({ blockers, onFix }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (blockers.count === 0) return null;
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"
      >
        <span className="flex items-center gap-2">
          Blocking Factors
          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px]">
            {blockers.count}
          </span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      {expanded && (
        <div className="space-y-3">
          {/* Hard blockers */}
          {blockers.hard.map((blocker, idx) => (
            <div
              key={`hard-${idx}`}
              className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
            >
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 dark:text-red-200">{blocker.message}</p>
                  {onFix && (
                    <button
                      onClick={() => onFix(blocker.fixPath)}
                      className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      Fix Now <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Soft blockers */}
          {blockers.soft.map((blocker, idx) => (
            <div
              key={`soft-${idx}`}
              className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800 dark:text-amber-200">{blocker.message}</p>
                  {onFix && (
                    <button
                      onClick={() => onFix(blocker.fixPath)}
                      className="mt-2 text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      Fix Now <ExternalLink className="w-3 h-3" />
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

// Evidence Tray
const EvidenceTray: React.FC<{
  sources: ConnectedSource[];
  pending: PendingVerification[];
  onConnect?: () => void;
}> = ({ sources, pending, onConnect }) => {
  const activeCount = sources.filter(s => s.status === 'active').length;
  const expiredCount = sources.filter(s => s.status === 'expired').length;
  
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Evidence Sources
      </h4>
      
      {/* Connected sources icons */}
      <div className="flex items-center gap-2 mb-3">
        {sources.map((source, idx) => (
          <div
            key={idx}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
              source.status === 'active'
                ? 'bg-emerald-100 dark:bg-emerald-900'
                : source.status === 'expired'
                ? 'bg-amber-100 dark:bg-amber-900'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
            title={`${source.name} (${source.status})`}
          >
            {getSourceIcon(source.type)}
          </div>
        ))}
        {onConnect && (
          <button
            onClick={onConnect}
            className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-indigo-500 hover:text-indigo-500 transition-colors"
            title="Connect new source"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          {activeCount} active
        </span>
        {expiredCount > 0 && (
          <span className="flex items-center gap-1 text-amber-500">
            <AlertTriangle className="w-3 h-3" />
            {expiredCount} expired
          </span>
        )}
      </div>
      
      {/* Pending verifications */}
      {pending.length > 0 && (
        <div className="mt-3 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-1">
            {pending.length} pending verification{pending.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {pending.slice(0, 2).map((p, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
                <Clock className="w-3 h-3" />
                <span className="truncate">{p.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Action CTAs
const ActionCTAs: React.FC<{
  onReportAction?: () => void;
  onConnectSources?: () => void;
  hasConflicts?: boolean;
  onResolveConflicts?: () => void;
}> = ({ onReportAction, onConnectSources, hasConflicts, onResolveConflicts }) => {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex flex-wrap gap-2">
        {onReportAction && (
          <button
            onClick={onReportAction}
            className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Action
          </button>
        )}
        {onConnectSources && (
          <button
            onClick={onConnectSources}
            className="flex-1 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Connect
          </button>
        )}
        {hasConflicts && onResolveConflicts && (
          <button
            onClick={onResolveConflicts}
            className="py-2 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Resolve
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ScorecardBlock: React.FC<ScorecardBlockProps> = ({
  startupId,
  mode = 'compact',
  onReportAction,
  onConnectSources,
  onResolveConflicts,
  className = ''
}) => {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const fetchScorecard = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      else setLoading(true);
      
      const endpoint = forceRefresh 
        ? `/api/v1/scorecard/${startupId}/refresh`
        : `/api/v1/scorecard/${startupId}`;
      
      const method = forceRefresh ? 'POST' : 'GET';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Pythh-Key': localStorage.getItem('pythh_api_key') || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch scorecard');
      }
      
      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchScorecard();
  }, [startupId]);
  
  const handleRefresh = () => {
    fetchScorecard(true);
  };
  
  const handleFix = (path: string) => {
    window.location.href = path;
  };
  
  if (loading) {
    return (
      <div className={`p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${className}`}>
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className={`p-4 rounded-xl bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">{error || 'Failed to load scorecard'}</span>
        </div>
        <button
          onClick={() => fetchScorecard()}
          className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
        >
          Try again
        </button>
      </div>
    );
  }
  
  const hasConflicts = data.blockingFactors.hard.some(b => b.id === 'inconsistency_detected');
  
  return (
    <div className={`p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Scorecard
        </h3>
      </div>
      
      {/* Score Header */}
      <ScoreHeader
        score={data.signalScore}
        delta={data.delta}
        confidence={data.confidence}
        verification={data.verification}
        freshness={data.freshness}
        lastUpdated={data.lastUpdated}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />
      
      {/* Top Movers */}
      <TopMoversSection movers={data.topMovers.slice(0, mode === 'compact' ? 3 : 5)} />
      
      {/* Blocking Factors */}
      <BlockingFactorsSection blockers={data.blockingFactors} onFix={handleFix} />
      
      {/* Evidence Tray (full mode only) */}
      {mode === 'full' && (
        <EvidenceTray
          sources={data.evidence.connectedSources}
          pending={data.evidence.pendingVerifications}
          onConnect={onConnectSources}
        />
      )}
      
      {/* Action CTAs */}
      <ActionCTAs
        onReportAction={onReportAction}
        onConnectSources={onConnectSources}
        hasConflicts={hasConflicts}
        onResolveConflicts={onResolveConflicts}
      />
    </div>
  );
};

// ============================================================================
// HOOK FOR EXTERNAL USE
// ============================================================================

export function useScorecardData(startupId: string) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetch = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/scorecard/${startupId}`, {
        headers: {
          'X-Pythh-Key': localStorage.getItem('pythh_api_key') || ''
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch');
      
      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetch();
  }, [startupId]);
  
  return { data, loading, error, refetch: fetch };
}

export default ScorecardBlock;
