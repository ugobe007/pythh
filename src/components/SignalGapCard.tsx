/**
 * SignalGapCard.tsx
 * 
 * The Missing Primitive: Shows founders why their score isn't moving.
 * This is NOT advice. This is a diff between VC expectation and observed evidence.
 * 
 * Display (per spec):
 *   Sequoia Lens — Blocked
 *   Primary blocker: Category clarity
 *   Confidence: High
 *   "This lens historically does not move without narrative convergence."
 * 
 * No "do this" coaching. Pure mechanical causality.
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  ChevronDown, 
  ChevronRight,
  Target,
  Clock,
  Zap
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Blocker {
  factor: string;
  label: string;
  confidence: 'High' | 'Medium' | 'Low';
  expected: number;
  observed: number;
  delta: number;
}

interface Lever {
  id: string;
  type: string;
  description: string;
  expected_signal: string;
  lag_days: number;
}

interface Gap {
  id: string;
  factor: string;
  label: string;
  severity: 'minor' | 'material' | 'critical';
  delta: number;
}

interface SignalGapData {
  startup_id: string;
  lens: string;
  blocked: boolean;
  severity: 'clear' | 'minor' | 'material' | 'critical';
  primary_blocker: Blocker | null;
  interpretation: string | null;
  levers: Lever[];
  all_gaps: Gap[];
}

interface SignalGapCardProps {
  data: SignalGapData;
  onAcknowledge?: (gapId: string, leverId?: string) => void;
  compact?: boolean;
}

// ============================================================================
// STYLING
// ============================================================================

const SEVERITY_STYLES = {
  clear: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400'
  },
  minor: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400'
  },
  material: {
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/20',
    icon: 'text-orange-400',
    badge: 'bg-orange-500/10 text-orange-400'
  },
  critical: {
    bg: 'bg-red-500/5',
    border: 'border-red-500/20',
    icon: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400'
  }
};

const LENS_LABELS: Record<string, string> = {
  sequoia: 'Sequoia',
  yc: 'YC',
  a16z: 'a16z',
  foundersfund: 'Founders Fund',
  greylock: 'Greylock',
  god: 'GOD'
};

const CONFIDENCE_COLORS: Record<string, string> = {
  High: 'text-emerald-400',
  Medium: 'text-amber-400',
  Low: 'text-zinc-500'
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SignalGapCard({ 
  data, 
  onAcknowledge,
  compact = false 
}: SignalGapCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [showLevers, setShowLevers] = useState(false);
  const [selectedLever, setSelectedLever] = useState<string | null>(null);
  
  const styles = SEVERITY_STYLES[data.severity] || SEVERITY_STYLES.minor;
  const lensLabel = LENS_LABELS[data.lens] || data.lens;
  
  // Clear state - no blockers
  if (!data.blocked || data.severity === 'clear') {
    return (
      <div className={`rounded-lg border ${SEVERITY_STYLES.clear.border} ${SEVERITY_STYLES.clear.bg} p-4`}>
        <div className="flex items-center gap-2">
          <CheckCircle className={`w-4 h-4 ${SEVERITY_STYLES.clear.icon}`} />
          <span className="text-sm text-zinc-300">
            <span className="font-medium">{lensLabel} Lens</span>
            <span className="text-zinc-500"> — </span>
            <span className="text-emerald-400">Clear</span>
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          No blocking signals detected under this lens.
        </p>
      </div>
    );
  }
  
  const blocker = data.primary_blocker;
  
  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} overflow-hidden`}>
      {/* ════════════════════════════════════════════════════════════════
          HEADER: Lens + Status
      ════════════════════════════════════════════════════════════════ */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${styles.icon}`} />
          <span className="text-sm text-zinc-300">
            <span className="font-medium">{lensLabel} Lens</span>
            <span className="text-zinc-500"> — </span>
            <span className={styles.icon}>Blocked</span>
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${styles.badge}`}>
            {data.severity}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>
      
      {/* ════════════════════════════════════════════════════════════════
          CONTENT: Primary Blocker + Interpretation
      ════════════════════════════════════════════════════════════════ */}
      {expanded && blocker && (
        <div className="px-4 pb-4 space-y-4">
          {/* Primary Blocker */}
          <div className="pt-2 border-t border-zinc-800/50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">Primary blocker</div>
                <div className="text-sm text-white font-medium">{blocker.label}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-600 mb-1">Confidence</div>
                <div className={`text-sm font-medium ${CONFIDENCE_COLORS[blocker.confidence]}`}>
                  {blocker.confidence}
                </div>
              </div>
            </div>
            
            {/* Delta visualization */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                  <span>Expected: {Math.round(blocker.expected * 100)}%</span>
                  <span>Observed: {Math.round(blocker.observed * 100)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                  {/* Expected marker */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-zinc-500"
                    style={{ left: `${blocker.expected * 100}%` }}
                  />
                  {/* Observed fill */}
                  <div 
                    className={`h-full rounded-full ${styles.icon.replace('text-', 'bg-')}`}
                    style={{ width: `${blocker.observed * 100}%` }}
                  />
                </div>
              </div>
              <div className="text-xs font-mono text-zinc-500">
                -{Math.round(blocker.delta * 100)}%
              </div>
            </div>
          </div>
          
          {/* Interpretation */}
          {data.interpretation && (
            <div className="bg-zinc-900/30 rounded-lg p-3">
              <p className="text-xs text-zinc-400 italic leading-relaxed">
                "{data.interpretation}"
              </p>
            </div>
          )}
          
          {/* ════════════════════════════════════════════════════════════
              LEVERS: Known mechanisms (optional expand)
          ════════════════════════════════════════════════════════════ */}
          {data.levers.length > 0 && (
            <div>
              <button
                onClick={() => setShowLevers(!showLevers)}
                className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                <Target className="w-3 h-3" />
                <span>Known mechanisms ({data.levers.length})</span>
                {showLevers ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              
              {showLevers && (
                <div className="mt-2 space-y-2">
                  {data.levers.map((lever) => (
                    <div 
                      key={lever.id}
                      className={`
                        p-2 rounded border transition-all cursor-pointer
                        ${selectedLever === lever.id 
                          ? 'border-cyan-500/30 bg-cyan-500/5' 
                          : 'border-zinc-800 hover:border-zinc-700'
                        }
                      `}
                      onClick={() => setSelectedLever(
                        selectedLever === lever.id ? null : lever.id
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-zinc-300">{lever.description}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" />
                              {lever.expected_signal}
                            </span>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {lever.lag_days}d
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* ════════════════════════════════════════════════════════════
              ACKNOWLEDGE BUTTON (minimal action)
          ════════════════════════════════════════════════════════════ */}
          {onAcknowledge && data.all_gaps.length > 0 && (
            <button
              onClick={() => onAcknowledge(data.all_gaps[0].id, selectedLever || undefined)}
              className="
                w-full py-2 rounded-lg text-xs font-medium
                bg-zinc-800 hover:bg-zinc-700 text-zinc-300
                border border-zinc-700 hover:border-zinc-600
                transition-colors
              "
            >
              Acknowledge gap
              {selectedLever && <span className="text-zinc-500 ml-1">(with selected lever)</span>}
            </button>
          )}
          
          {/* Other gaps (collapsed) */}
          {data.all_gaps.length > 1 && (
            <div className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-800/50">
              + {data.all_gaps.length - 1} other gap{data.all_gaps.length > 2 ? 's' : ''}: {
                data.all_gaps.slice(1).map(g => g.label).join(', ')
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MULTI-LENS VIEW (shows gaps across all lenses)
// ============================================================================

interface MultiLensGapsProps {
  gaps: SignalGapData[];
  onAcknowledge?: (gapId: string, leverId?: string) => void;
}

export function MultiLensGaps({ gaps, onAcknowledge }: MultiLensGapsProps) {
  if (!gaps || gaps.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4 text-center">
        No gap data available
      </div>
    );
  }
  
  // Sort: blocked first, then by severity
  const sortedGaps = [...gaps].sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? -1 : 1;
    const severityOrder = { critical: 0, material: 1, minor: 2, clear: 3 };
    return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
  });
  
  return (
    <div className="space-y-3">
      {sortedGaps.map((gap) => (
        <SignalGapCard
          key={gap.lens}
          data={gap}
          onAcknowledge={onAcknowledge}
          compact={sortedGaps.length > 2}
        />
      ))}
    </div>
  );
}

// ============================================================================
// HOOK: Fetch gaps from API
// ============================================================================

export function useSignalGaps(startupId: string | null, lens?: string) {
  const [data, setData] = React.useState<SignalGapData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    if (!startupId) return;
    
    const fetchGaps = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const url = lens
          ? `/api/v1/gaps/${startupId}/${lens}`
          : `/api/v1/gaps/${startupId}`;
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (!json.ok) {
          throw new Error(json.error?.message || 'Failed to fetch gaps');
        }
        
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchGaps();
  }, [startupId, lens]);
  
  return { data, loading, error };
}
