/**
 * SignalProofCard.tsx
 * 
 * Exportable 1-page market signal profile.
 * "The pitch deck for their Pythh journey" - a visual artifact
 * founders can share with co-founders, advisors, or investors.
 * 
 * Contains:
 * - Signal trajectory overview
 * - Active strategy with context
 * - Key metrics snapshot
 * - Anonymized relative context (where available)
 */

import React, { useState, useRef } from 'react';
import { Download, Share2, X, TrendingUp, Target, Zap, Clock, BarChart2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface SignalSnapshot {
  entityName: string;
  entityType: 'startup' | 'investor';
  lensId?: string;
  timingState: string;
  signalStrength: number;
  rank?: number;
  rankDelta?: number;
  category?: string;
  velocity?: string;
}

interface ActiveStrategy {
  strategyKey: string;
  lens: string;
  timing: string;
  title: string;
  rationale: string;
  vectors: string[];
  daysActive: number;
  contextAtActivation?: {
    strength?: number;
    timingState?: string;
  };
}

interface StrategyStats {
  total: number;
  positiveRate: number | null;
  avgDuration: number | null;
}

interface SignalProofCardProps {
  signal: SignalSnapshot;
  strategy?: ActiveStrategy;
  strategyStats?: StrategyStats;
  generatedAt?: string;
  onClose?: () => void;
  onDownload?: () => void;
}

// ═══════════════════════════════════════════════════════════════
// LENS STYLING
// ═══════════════════════════════════════════════════════════════

const LENS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  sequoia: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Sequoia' },
  yc: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', label: 'YC' },
  a16z: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', label: 'a16z' },
  foundersfund: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Founders Fund' },
  greylock: { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', label: 'Greylock' },
  god: { color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.1)', label: 'GOD Score' },
};

const TIMING_CONFIG: Record<string, { color: string; label: string }> = {
  warming: { color: '#fbbf24', label: 'Warming' },
  prime: { color: '#34d399', label: 'Prime' },
  cooling: { color: '#60a5fa', label: 'Cooling' },
  dormant: { color: '#6b7280', label: 'Dormant' },
};

// ═══════════════════════════════════════════════════════════════
// SIGNAL STRENGTH BAR
// ═══════════════════════════════════════════════════════════════

const StrengthBar: React.FC<{ value: number; label?: string }> = ({ value, label }) => {
  const percentage = Math.min(100, Math.max(0, value));
  const color = value >= 80 ? '#34d399' : value >= 60 ? '#fbbf24' : value >= 40 ? '#fb923c' : '#f87171';
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>{label}</span>
          <span>{value}</span>
        </div>
      )}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SignalProofCard({
  signal,
  strategy,
  strategyStats,
  generatedAt,
  onClose,
  onDownload,
}: SignalProofCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const lens = LENS_CONFIG[signal.lensId || 'god'] || LENS_CONFIG.god;
  const timing = TIMING_CONFIG[signal.timingState] || TIMING_CONFIG.dormant;
  const dateStr = generatedAt 
    ? new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Handle export (simplified - in production would use html2canvas)
  const handleExport = async () => {
    setIsExporting(true);
    
    // Trigger download callback if provided
    if (onDownload) {
      await onDownload();
    }
    
    // Fallback: print-friendly view
    if (cardRef.current) {
      window.print();
    }
    
    setIsExporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      {/* Card container */}
      <div 
        ref={cardRef}
        className="w-full max-w-md bg-[#0f0f0f] rounded-xl border border-zinc-800 overflow-hidden shadow-2xl"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {/* Print-friendly styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .signal-proof-card, .signal-proof-card * { visibility: visible; }
            .signal-proof-card { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: lens.bg }}
            >
              <BarChart2 className="w-4 h-4" style={{ color: lens.color }} />
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{signal.entityName}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Signal Proof Card
              </div>
            </div>
          </div>
          
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="p-5 space-y-5 signal-proof-card">
          {/* Signal Snapshot */}
          <div className="space-y-3">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider">
              Signal Snapshot
            </div>
            
            {/* Strength */}
            <StrengthBar value={signal.signalStrength} label="Signal Strength" />
            
            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-3">
              {/* Timing */}
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-zinc-600 mb-1">Timing</div>
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: timing.color }}
                  />
                  <span className="text-xs text-white font-medium">{timing.label}</span>
                </div>
              </div>
              
              {/* Rank */}
              {signal.rank && (
                <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-zinc-600 mb-1">Rank</div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white font-medium">#{signal.rank}</span>
                    {signal.rankDelta !== undefined && signal.rankDelta !== 0 && (
                      <span className={`text-[10px] ${signal.rankDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {signal.rankDelta > 0 ? '+' : ''}{signal.rankDelta}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Lens */}
              <div className="bg-zinc-900/50 rounded-lg px-3 py-2">
                <div className="text-[10px] text-zinc-600 mb-1">Lens</div>
                <span className="text-xs font-medium" style={{ color: lens.color }}>
                  {lens.label}
                </span>
              </div>
            </div>
            
            {/* Category */}
            {signal.category && (
              <div className="text-[11px] text-zinc-500">
                Category: <span className="text-zinc-400">{signal.category}</span>
              </div>
            )}
          </div>
          
          {/* Strategy Section */}
          {strategy && (
            <div className="space-y-3 pt-4 border-t border-zinc-800/50">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                  Active Strategy
                </span>
              </div>
              
              {/* Strategy card */}
              <div className="bg-zinc-900/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div 
                    className="w-1 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: LENS_CONFIG[strategy.lens]?.color || '#22d3ee' }}
                  />
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium mb-2">
                      {strategy.title}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {strategy.rationale}
                    </p>
                    
                    {/* Vectors */}
                    {strategy.vectors && strategy.vectors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {strategy.vectors.slice(0, 3).map((v, i) => (
                          <span 
                            key={i}
                            className="text-[10px] text-zinc-500 px-2 py-0.5 rounded bg-zinc-800/50"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Strategy metadata */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800/50">
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {strategy.daysActive}d active
                  </span>
                  
                  {/* Relative context - anonymized */}
                  {strategyStats && strategyStats.total >= 10 && strategyStats.positiveRate !== null && (
                    <span className="text-[10px] text-zinc-500">
                      {strategyStats.positiveRate}% positive outcomes (n={strategyStats.total})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-semibold text-cyan-400 tracking-wider">
                PYTHH
              </div>
              <span className="text-[10px] text-zinc-600">
                {dateStr}
              </span>
            </div>
            
            <div className="text-[9px] text-zinc-600 italic">
              Signal intelligence, not advice
            </div>
          </div>
        </div>
        
        {/* Action bar */}
        <div className="px-5 py-3 border-t border-zinc-800/50 flex items-center justify-end gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRIGGER BUTTON (for use in lists)
// ═══════════════════════════════════════════════════════════════

interface ProofCardTriggerProps {
  signal: SignalSnapshot;
  strategy?: ActiveStrategy;
  strategyStats?: StrategyStats;
  className?: string;
}

export function ProofCardTrigger({ signal, strategy, strategyStats, className = '' }: ProofCardTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
          text-[11px] text-zinc-400 hover:text-white
          bg-zinc-800/50 hover:bg-zinc-800 
          border border-zinc-700/50 hover:border-zinc-600
          transition-all ${className}
        `}
      >
        <BarChart2 className="w-3 h-3" />
        Proof Card
      </button>
      
      {isOpen && (
        <SignalProofCard
          signal={signal}
          strategy={strategy}
          strategyStats={strategyStats}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
