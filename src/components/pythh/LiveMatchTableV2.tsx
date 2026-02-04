// ============================================================================
// LiveMatchTable v2 - Canonical Data Contract Version
// ============================================================================
// This component ONLY RENDERS. It does NOT compute scores.
// All data transformation happens in radar-view-model.ts
// 
// Contract rules (LOCKED):
//   1. GOD is constant per startup (shown on every row)
//   2. No score derivation in this file
//   3. Glow is determined by view model, not inline
//   4. Row height is 64px
//   5. Sharp corners, no borders, glow-only decoration
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, ExternalLink } from 'lucide-react';
import type { RadarRowViewModel } from '@/lib/radar-view-model';
import { RADAR_THRESHOLDS } from '@/lib/radar-view-model';
import { UnlockButton } from './UnlockButton';

// -----------------------------------------------------------------------------
// PROPS (View Model Based)
// -----------------------------------------------------------------------------

interface LiveMatchTableProps {
  /** Unlocked rows (Ready) - sorted by rank */
  unlockedRows: RadarRowViewModel[];
  /** Locked rows - sorted by rank */
  lockedRows: RadarRowViewModel[];
  /** Loading state */
  loading: boolean;
  /** Check if a specific investor unlock is pending */
  isPending: (investorId: string) => boolean;
  /** Unlock handler */
  onUnlock: (investorId: string) => Promise<void>;
  /** Remaining daily unlocks */
  unlocksRemaining: number;
  /** Additional CSS classes */
  className?: string;
}

// -----------------------------------------------------------------------------
// GLOW COLORS (LOCKED per spec)
// -----------------------------------------------------------------------------

const GLOW_COLORS = {
  // Row glows
  signal: 'rgba(34, 211, 238, 0.25)',      // Cyan - high signal
  signalHover: 'rgba(34, 211, 238, 0.4)',
  good: 'rgba(34, 197, 94, 0.2)',          // Green - high fit
  goodHover: 'rgba(34, 197, 94, 0.35)',
  // Action column glow
  locked: 'rgba(251, 146, 60, 0.3)',       // Orange - locked
  // Neutral
  none: 'transparent',
  noneHover: 'rgba(255, 255, 255, 0.05)',
} as const;

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export function LiveMatchTable({
  unlockedRows,
  lockedRows,
  loading,
  isPending,
  onUnlock,
  unlocksRemaining,
  className = '',
}: LiveMatchTableProps) {
  const navigate = useNavigate();

  const handleView = (investorId: string) => {
    navigate(`/investor/${investorId}`);
  };

  // Empty states
  if (loading && unlockedRows.length === 0 && lockedRows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading matches...</span>
        </div>
      </div>
    );
  }

  if (unlockedRows.length === 0 && lockedRows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="text-center text-gray-400">
          <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No matches found</p>
          <p className="text-sm mt-1">Check back as more investors are analyzed</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="match-table"
      className={`space-y-0 ${className}`}
    >
      {/* Column Headers - Supabase style: minimal, clean */}
      <div className="h-10 flex items-center gap-4 px-4 text-xs font-medium text-zinc-500 border-b border-zinc-800/50">
        <div className="flex-1">Investor</div>
        <div className="w-20 text-center">Signal</div>
        <div className="w-16 text-center">GOD</div>
        <div className="w-16 text-center">YC++</div>
        <div className="w-12 text-center">Δ</div>
        <div className="w-20 text-center">Fit</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-28 text-right">Action</div>
      </div>

      {/* Unlocked rows first (Ready) */}
      {unlockedRows.map((row, index) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
          rowIndex={index}
          isPending={isPending(row.investorId)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={false}
        />
      ))}

      {/* Separator + CTA after top 5 */}
      {unlockedRows.length >= 5 && lockedRows.length > 0 && (
        <div className="h-12 flex items-center justify-center border-b border-zinc-800/50 bg-zinc-900/20">
          <div className="text-xs text-gray-400">
            <Lock className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            <span className="font-medium text-gray-300">{lockedRows.length} more matches</span>
            {' '}\u2014 unlock to reveal
          </div>
        </div>
      )}

      {/* Locked rows - no visual separator */}
      {lockedRows.map((row, index) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
          rowIndex={unlockedRows.length + index}
          isPending={isPending(row.investorId)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={unlocksRemaining === 0}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Radar Row (Pure Render - No Computations)
// -----------------------------------------------------------------------------

interface RadarTableRowProps {
  row: RadarRowViewModel;
  isPending: boolean;
  onUnlock: (investorId: string) => Promise<void>;
  onView: (investorId: string) => void;
  unlocksDisabled: boolean;
  rowIndex: number; // Add row index for blur logic
}

function RadarTableRow({ row, isPending, onUnlock, onView, unlocksDisabled, rowIndex }: RadarTableRowProps) {
  // Supabase style: no glows, just clean borders and hover states
  const isHighSignal = row.signal.value >= RADAR_THRESHOLDS.SIGNAL_WINDOW_OPENING;
  
  // Top 5 are unlocked, rows 6+ get blur effect if locked
  const shouldBlur = row.entity.isLocked && rowIndex >= 5;
  
  return (
    <div
      className={`relative h-14 w-full flex items-center gap-4 px-4 border-b border-zinc-800/30 hover:bg-zinc-900/40 transition-colors ${
        shouldBlur ? 'opacity-60' : ''
      }`}
      data-testid={`match-row-${row.investorId}`}
    >
      {/* Blur overlay for rows 6+ */}
      {shouldBlur && (
        <div className="absolute inset-0 backdrop-blur-[1.5px] pointer-events-none" />
      )}
      {/* ENTITY: Investor name + context - ALWAYS UNLOCKED */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* TOP 5 UNLOCKED: Clickable investor name with link */}
            {!row.entity.isLocked && rowIndex < 5 ? (
              <button
                onClick={() => onView(row.investorId)}
                className="font-medium text-sm text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 transition-colors"
              >
                {row.entity.name}
                <ExternalLink className="w-3 h-3" />
              </button>
            ) : (
              <span className="font-medium text-sm text-white">
                {row.entity.name}
              </span>
            )}
            {/* Warming badge for fallback tier */}
            {row.status === 'WARMING' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                Warming up
              </span>
            )}
          </div>
          {row.entity.context && (
            <div className="text-xs text-zinc-500 truncate">{row.entity.context}</div>
          )}
        </div>
      </div>

      {/* SIGNAL: value + direction arrow */}
      <div className="w-20 text-center">
        <SignalCell 
          value={row.signal.value} 
          direction={row.signal.direction} 
        />
      </div>

      {/* GOD: constant per startup */}
      <div className="w-16 text-center">
        <span className="font-mono text-sm text-zinc-200">{row.god}</span>
      </div>

      {/* YC++: perception score */}
      <div className="w-16 text-center">
        <YCPlusCell value={row.ycPlusPlus} />
      </div>

      {/* Δ: composite delta */}
      <div className="w-12 text-center">
        <DeltaCell value={row.delta} />
      </div>

      {/* FIT: bars only */}
      <div className="w-20 flex justify-center">
        <FitBars bars={row.fit.bars} />
      </div>

      {/* STATUS */}
      <div className="w-20 flex justify-center">
        <StatusBadge status={row.status} />
      </div>

      {/* ACTION - clean button, no glow */}
      <div className="w-28 text-right">
        <UnlockButton
          investorId={row.investorId}
          isLocked={row.entity.isLocked}
          isPending={isPending}
          onUnlock={onUnlock}
          onView={onView}
          disabled={unlocksDisabled}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cell Components (Pure Render)
// -----------------------------------------------------------------------------

function SignalCell({ value, direction }: { value: number; direction: 'up' | 'down' | 'flat' }) {
  const colorClass = value >= RADAR_THRESHOLDS.SIGNAL_WINDOW_OPENING
    ? 'text-emerald-400'
    : value >= RADAR_THRESHOLDS.SIGNAL_ACTIVE
      ? 'text-gray-300'
      : value >= RADAR_THRESHOLDS.SIGNAL_COOLING
        ? 'text-amber-400'
        : 'text-gray-500';
  
  const arrowClass = direction === 'up' 
    ? 'text-emerald-400' 
    : direction === 'down' 
      ? 'text-red-400' 
      : 'text-gray-600';
  
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '▬';
  
  return (
    <span className="font-mono text-sm">
      <span className={colorClass}>{value.toFixed(1)}</span>
      <span className={`ml-1 text-xs ${arrowClass}`}>{arrow}</span>
    </span>
  );
}

function YCPlusCell({ value }: { value: number }) {
  const colorClass = value >= RADAR_THRESHOLDS.YC_EXCELLENT
    ? 'text-emerald-400'
    : value >= RADAR_THRESHOLDS.YC_GOOD
      ? 'text-gray-300'
      : 'text-gray-500';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{value}</span>;
}

function DeltaCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-mono text-sm text-gray-600">—</span>;
  }
  
  const colorClass = value > 0 
    ? 'text-emerald-400' 
    : value < 0 
      ? 'text-red-400' 
      : 'text-gray-500';
  
  const prefix = value > 0 ? '+' : '';
  
  return (
    <span className={`font-mono text-sm ${colorClass}`}>
      {prefix}{value.toFixed(1)}
    </span>
  );
}

function FitBars({ bars }: { bars: number }) {
  const colorClass = bars >= RADAR_THRESHOLDS.FIT_HIGH
    ? 'bg-emerald-400'
    : bars >= RADAR_THRESHOLDS.FIT_MEDIUM
      ? 'bg-gray-300'
      : 'bg-gray-500';
  
  return (
    <div className="flex items-center gap-0.5" title={`Fit: ${bars}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-3 rounded-sm ${i < bars ? colorClass : 'bg-gray-700'}`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: 'LOCKED' | 'READY' | 'LIVE' }) {
  if (status === 'LOCKED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        Locked
      </span>
    );
  }
  
  if (status === 'LIVE') {
    return (
      <span className="text-xs text-cyan-400 animate-pulse">
        LIVE
      </span>
    );
  }
  
  return <span className="text-xs text-emerald-400">Ready</span>;
}
