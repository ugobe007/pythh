/**
 * SCORE DRILL-DOWN DRAWER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: When a founder clicks a score, they instantly learn:
 * - What this lens values (without a lecture)
 * - Why this startup ranks here (evidence + weights)
 * - What would move the score (actionable but not preachy)
 * 
 * Rules:
 * - No charts
 * - No long prose
 * - No onboarding overlays
 * - No "contact investor" CTA
 * - This is a single glance tool
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, useState } from 'react';
import SaveToSignalCard from './SaveToSignalCard';
import ShareButton from './ShareButton';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface WeightItem {
  factor: string;
  label: string;
  weight: number;
}

interface BreakdownItem {
  factor: string;
  label: string;
  contribution: number;
}

interface EvidenceItem {
  claim: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

interface EvidenceGroup {
  factor: string;
  label: string;
  items: EvidenceItem[];
}

interface SensitivityItem {
  factor: string;
  label: string;
  range: string;
}

interface DrilldownData {
  startup: {
    id: string;
    name: string;
    sector: string;
  };
  lens: {
    id: string;
    label: string;
    accent: string;
  };
  score: {
    value: number;
    rank: number;
    delta: number;
    velocity: string;
    window: string;
  };
  weights: WeightItem[];
  breakdown: BreakdownItem[];
  evidence: EvidenceGroup[];
  sensitivity: SensitivityItem[];
}

interface ScoreDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrilldownData | null;
  isLoading?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════

const SkeletonLine: React.FC<{ width?: string }> = ({ width = '100%' }) => (
  <div 
    className="h-4 bg-zinc-800 rounded animate-pulse"
    style={{ width }}
  />
);

const SkeletonSection: React.FC<{ lines: number }> = ({ lines }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonLine key={i} width={`${85 - i * 10}%`} />
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// CONFIDENCE BADGE
// ═══════════════════════════════════════════════════════════════

const ConfidenceBadge: React.FC<{ confidence: string }> = ({ confidence }) => {
  const colors = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-zinc-500',
  };
  return (
    <span className={`text-xs ${colors[confidence as keyof typeof colors] || colors.low}`}>
      {confidence}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const ScoreDrilldownDrawer: React.FC<ScoreDrilldownDrawerProps> = ({
  isOpen,
  onClose,
  data,
  isLoading = false,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      // Delay to prevent immediate close on the click that opened it
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Reset evidence expansion when drawer closes
  useEffect(() => {
    if (!isOpen) setShowAllEvidence(false);
  }, [isOpen]);

  // Copy summary to clipboard - enhanced format
  const handleCopySummary = () => {
    if (!data) return;
    
    // Get top drivers from breakdown
    const topDrivers = data.breakdown
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map(d => `${d.label}: ${Math.round(d.contribution)}%`);
    
    const lines: string[] = [
      `📊 ${data.startup.name} — ${data.lens.label} Lens`,
      '',
      `Score: ${data.score.value} · Rank #${data.score.rank}${data.score.delta !== 0 ? ` (${data.score.delta > 0 ? '↑' : '↓'}${Math.abs(data.score.delta)} this week)` : ''}`,
      `Window: ${data.score.window}`,
      '',
      'Top drivers:',
      ...topDrivers.map(d => `• ${d}`),
      '',
      '— via Pythh'
    ];
    
    navigator.clipboard.writeText(lines.join('\n'));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200"
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`
          fixed top-0 right-0 h-full w-[420px] max-w-[90vw]
          bg-[#0d1117] border-l border-zinc-800
          z-50 overflow-hidden
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <div className="h-full flex flex-col">
          {/* ═══════════════════════════════════════════════════════════════
              HEADER
          ═══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-4 border-b border-zinc-800/60">
            {isLoading || !data ? (
              <div className="space-y-3">
                <SkeletonLine width="60%" />
                <SkeletonLine width="80%" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {/* Lens badge */}
                  <span 
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ 
                      backgroundColor: `${data.lens.accent}20`,
                      color: data.lens.accent,
                    }}
                  >
                    {data.lens.label}
                  </span>
                  {/* Startup name */}
                  <span className="text-white font-medium truncate">
                    {data.startup.name}
                  </span>
                </div>
                {/* Score metrics row */}
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-zinc-500">Score</span>
                    <span 
                      className="ml-2 font-mono font-semibold"
                      style={{ color: data.lens.accent }}
                    >
                      {data.score.value.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Rank</span>
                    <span className="ml-2 text-white font-medium">
                      #{data.score.rank}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Δ</span>
                    <span className={`ml-2 font-mono ${
                      data.score.delta > 0 ? 'text-emerald-400' : 
                      data.score.delta < 0 ? 'text-red-400' : 'text-zinc-500'
                    }`}>
                      {data.score.delta > 0 ? '+' : ''}{data.score.delta}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Window</span>
                    <span className="ml-2 text-zinc-300">{data.score.window}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SCROLLABLE CONTENT
          ═══════════════════════════════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto">
            {isLoading || !data ? (
              <div className="p-5 space-y-8">
                <div>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Emphasis (weights)</div>
                  <SkeletonSection lines={6} />
                </div>
                <div>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Score breakdown</div>
                  <SkeletonSection lines={7} />
                </div>
                <div>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">Evidence</div>
                  <SkeletonSection lines={4} />
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-6">
                {/* ═══════════════════════════════════════════════════════════
                    SECTION A: LENS DNA (WEIGHTS)
                ═══════════════════════════════════════════════════════════ */}
                <section>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">
                    Emphasis (weights)
                  </div>
                  <div className="space-y-2">
                    {data.weights.map((w) => (
                      <div 
                        key={w.factor}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-zinc-400">• {w.label}</span>
                        <span className={`font-mono tabular-nums ${
                          w.weight < 0 ? 'text-red-400' : 'text-zinc-300'
                        }`}>
                          {w.weight >= 0 ? w.weight.toFixed(2) : w.weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════
                    SECTION B: SCORE BREAKDOWN
                ═══════════════════════════════════════════════════════════ */}
                <section>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">
                    Score breakdown ({data.score.value.toFixed(1)})
                  </div>
                  <div className="space-y-2">
                    {data.breakdown.map((b) => (
                      <div 
                        key={b.factor}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className={b.contribution < 0 ? 'text-red-400' : 'text-zinc-400'}>
                          {b.contribution >= 0 ? '+' : ''} {b.label}
                        </span>
                        <span className={`font-mono tabular-nums ${
                          b.contribution < 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {b.contribution >= 0 ? '+' : ''}{b.contribution.toFixed(1)}
                        </span>
                      </div>
                    ))}
                    {/* Total line */}
                    <div className="border-t border-zinc-800 pt-2 mt-2 flex items-center justify-between text-sm">
                      <span className="text-zinc-300 font-medium">Total</span>
                      <span 
                        className="font-mono tabular-nums font-semibold"
                        style={{ color: data.lens.accent }}
                      >
                        {data.score.value.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════
                    SECTION C: EVIDENCE
                ═══════════════════════════════════════════════════════════ */}
                <section>
                  <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">
                    Evidence (top signals)
                  </div>
                  <div className="space-y-4">
                    {data.evidence.slice(0, showAllEvidence ? undefined : 3).map((group) => (
                      <div key={group.factor}>
                        <div className="text-zinc-300 text-sm font-medium mb-2">
                          {group.label}
                        </div>
                        <div className="space-y-1.5 pl-2">
                          {group.items.map((item, idx) => (
                            <div 
                              key={idx}
                              className="flex items-start justify-between text-xs gap-2"
                            >
                              <span className="text-zinc-500">
                                • {item.claim} <span className="text-zinc-600">({item.source})</span>
                              </span>
                              <ConfidenceBadge confidence={item.confidence} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {data.evidence.length > 3 && !showAllEvidence && (
                      <button
                        onClick={() => setShowAllEvidence(true)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Show more ({data.evidence.length - 3} more)
                      </button>
                    )}
                  </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════
                    SECTION D: SENSITIVITY
                ═══════════════════════════════════════════════════════════ */}
                {data.sensitivity.length > 0 && (
                  <section>
                    <div className="text-xs text-zinc-600 uppercase tracking-wider mb-3">
                      Sensitivity
                    </div>
                    <div className="space-y-2">
                      {data.sensitivity.map((s) => (
                        <div 
                          key={s.factor}
                          className="text-sm text-zinc-500"
                        >
                          If {s.label.toLowerCase()} → <span className="text-zinc-300">{s.range}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              FOOTER
          ═══════════════════════════════════════════════════════════════ */}
          <div className="px-5 py-4 border-t border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {data && (
                <ShareButton
                  payload={{
                    type: 'score_snapshot',
                    startupName: data.startup.name,
                    lensId: data.lens.id,
                    lensLabel: data.lens.label,
                    window: data.score.window,
                    score: data.score.value,
                    rank: data.score.rank,
                    rankDelta: data.score.delta,
                    topDrivers: data.breakdown?.slice(0, 3).map(b => b.label) || [],
                  }}
                  expandable
                  linkPayload={{
                    share_type: 'score_snapshot',
                    startup_id: data.startup.id,
                    startup_name: data.startup.name,
                    lens_id: data.lens.id,
                    window: data.score.window,
                    snapshot: {
                      startup_name: data.startup.name,
                      lens_label: data.lens.label,
                      score: data.score.value,
                      rank: data.score.rank,
                      rank_delta: data.score.delta,
                      velocity: data.score.velocity || 'steady',
                      top_drivers: data.breakdown?.slice(0, 3).map(b => ({ label: b.label, pct: Math.round(b.contribution) })) || [],
                      breakdown: data.breakdown?.slice(0, 10).map(b => ({ factor: b.key, label: b.label, contribution: b.contribution })) || [],
                    },
                    // Evidence: max 3 factors, max 2 items each, with public-safe format
                    evidence: data.evidence?.slice(0, 3).map(group => ({
                      factor: group.label,
                      items: group.items.slice(0, 2).map(item => ({
                        claim: item.claim.slice(0, 120), // Cap at 120 chars
                        source: item.source,
                        confidence: item.confidence,
                        visibility: 'public', // Mark as public-safe
                      })),
                    })) || [],
                    redaction_level: 'public',
                  }}
                  showLabel
                  size="md"
                />
              )}
              {data && (
                <SaveToSignalCard
                  entityType="score_snapshot"
                  entityId={data.startup.id}
                  entityName={data.startup.name}
                  lensId={data.lens.id as any}
                  window={data.score.window as any}
                  scoreValue={data.score.value}
                  rank={data.score.rank}
                  rankDelta={data.score.delta}
                  context="from score drawer"
                  size="md"
                />
              )}
            </div>
            <button
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScoreDrilldownDrawer;
