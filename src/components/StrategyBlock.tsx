/**
 * StrategyBlock.tsx (Final Form)
 * 
 * Displays active signal strategies for a founder.
 * This is evidence mechanics, not advice.
 * 
 * Structure:
 *   - Strategy title (bold)
 *   - Interpretation (what the signals indicate)
 *   - "How other founders handled this" (precedents)
 *   - Generate Readiness Brief button
 */

import React, { useState } from 'react';
import { Target, ChevronDown, ChevronUp, Sparkles, Users } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES (Canonical Schema)
// ═══════════════════════════════════════════════════════════════

export interface StrategyInstance {
  id: string;
  strategy_id: string;
  lens_id: string;
  sector?: string | null;
  timing_state: string;
  strength?: number;
  status: 'active' | 'resolved_positive' | 'resolved_negative' | 'expired';
  activated_at: string;
  reassess_at?: string | null;
  resolved_at?: string | null;
  // From joined strategy
  title: string;
  description: string;  // This is now the "interpretation"
  why_it_matters: string[];
  action_vectors: string[];
  // Precedents (locker-room wisdom)
  precedents?: string[];
  // Evidence mechanics
  interpretation?: string;
  evidence_gaps?: { criterion: string; gap: string }[];
  recommended_levers?: string[];
}

interface StrategyBlockProps {
  strategies: StrategyInstance[];
  onGenerateBrief?: (instance: StrategyInstance) => void;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════
// LENS STYLING
// ═══════════════════════════════════════════════════════════════

const LENS_STYLES: Record<string, { accent: string; bgAccent: string; label: string }> = {
  sequoia: { accent: 'text-red-400', bgAccent: 'bg-red-500/10 border-red-500/20', label: 'Sequoia' },
  yc: { accent: 'text-orange-400', bgAccent: 'bg-orange-500/10 border-orange-500/20', label: 'YC' },
  a16z: { accent: 'text-purple-400', bgAccent: 'bg-purple-500/10 border-purple-500/20', label: 'a16z' },
  foundersfund: { accent: 'text-green-400', bgAccent: 'bg-green-500/10 border-green-500/20', label: 'Founders Fund' },
  greylock: { accent: 'text-indigo-400', bgAccent: 'bg-indigo-500/10 border-indigo-500/20', label: 'Greylock' },
};

// ═══════════════════════════════════════════════════════════════
// STRATEGY CARD (Final Form)
// ═══════════════════════════════════════════════════════════════

function StrategyCard({ s, onGenerateBrief }: { s: StrategyInstance; onGenerateBrief?: (s: StrategyInstance) => void }) {
  const [expanded, setExpanded] = useState(true); // Default expanded for active
  
  const lens = LENS_STYLES[s.lens_id] || { accent: 'text-cyan-400', bgAccent: 'bg-cyan-500/10 border-cyan-500/20', label: s.lens_id };
  
  // Use interpretation if available, otherwise description
  const interpretation = s.interpretation || s.description;
  
  return (
    <div className={`rounded-lg border ${lens.bgAccent} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        <div className={`w-1.5 h-12 rounded-full ${lens.accent.replace('text-', 'bg-')}`} />
        
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Active Signal Strategy
          </div>
          <div className="text-sm text-white font-semibold">
            {s.title}
          </div>
        </div>
        
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        )}
      </button>
      
      {/* Expanded content - Final Form */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 ml-[18px]">
          
          {/* Interpretation */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
              Interpretation
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {interpretation}
            </p>
          </div>
          
          {/* How other founders handled this */}
          {s.precedents && s.precedents.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/50">
              <div className="flex items-center gap-1.5 mb-3">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  How other founders handled this
                </span>
              </div>
              <ul className="space-y-2">
                {s.precedents.slice(0, 3).map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-zinc-600 mt-0.5">•</span>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {/* Shorten to key insight */}
                      {p.length > 150 ? p.split('.').slice(0, 2).join('.') + '.' : p}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Generate Readiness Brief button */}
          {s.status === 'active' && onGenerateBrief && (
            <div className="pt-3 border-t border-zinc-800/50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateBrief(s);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 text-sm font-medium transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Readiness Brief
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function StrategyBlock({ strategies, onGenerateBrief, className = '' }: StrategyBlockProps) {
  const activeStrategies = strategies.filter(s => s.status === 'active');
  const resolvedStrategies = strategies.filter(s => s.status !== 'active');
  
  if (strategies.length === 0) {
    return null;
  }
  
  return (
    <div className={className}>
      {/* Active strategies */}
      <div className="space-y-3">
        {activeStrategies.map(s => (
          <StrategyCard key={s.id} s={s} onGenerateBrief={onGenerateBrief} />
        ))}
      </div>
      
      {/* Resolved strategies (collapsed) */}
      {resolvedStrategies.length > 0 && (
        <details className="mt-4">
          <summary className="text-[10px] text-zinc-600 cursor-pointer hover:text-zinc-500">
            {resolvedStrategies.length} resolved strateg{resolvedStrategies.length === 1 ? 'y' : 'ies'}
          </summary>
          <div className="space-y-2 mt-2 opacity-50">
            {resolvedStrategies.map(s => (
              <StrategyCard key={s.id} s={s} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPACT BADGE (for inline use)
// ═══════════════════════════════════════════════════════════════

export function StrategyBadge({ strategy, onClick }: { strategy: StrategyInstance; onClick?: () => void }) {
  const lens = LENS_STYLES[strategy.lens_id] || { accent: 'text-cyan-400', bgAccent: 'bg-cyan-500/10 border-cyan-500/20', label: strategy.lens_id };
  
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${lens.bgAccent} hover:brightness-110 transition-all text-left`}
      title={strategy.description}
    >
      <Target className={`w-3 h-3 ${lens.accent}`} />
      <span className="text-[11px] text-zinc-300 truncate max-w-[120px]">
        {strategy.title}
      </span>
    </button>
  );
}
