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
import { User, Lock, Eye } from 'lucide-react';
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
    navigate(`/app/investors/${investorId}`);
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
      className={`space-y-2 ${className}`}
    >
      {/* Column Headers - minimal, uppercase, quiet */}
      <div className="h-10 flex items-center gap-4 px-5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
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
      {unlockedRows.map((row) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
          isPending={isPending(row.investorId)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={false}
        />
      ))}

      {/* Separator if we have both locked and unlocked */}
      {unlockedRows.length > 0 && lockedRows.length > 0 && (
        <div className="border-t border-dashed border-zinc-800 my-3" />
      )}

      {/* Locked rows */}
      {lockedRows.map((row) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
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
}

function RadarTableRow({ row, isPending, onUnlock, onView, unlocksDisabled }: RadarTableRowProps) {
  // Glow colors from view model
  const baseGlow = row.glow.row === 'signal' 
    ? GLOW_COLORS.signal 
    : row.glow.row === 'good' 
      ? GLOW_COLORS.good 
      : GLOW_COLORS.none;
  
  const hoverGlow = row.glow.row === 'signal'
    ? GLOW_COLORS.signalHover
    : row.glow.row === 'good'
      ? GLOW_COLORS.goodHover
      : GLOW_COLORS.noneHover;

  return (
    <div
      className="relative h-16 w-full flex items-center gap-4 px-5 bg-zinc-900/60 rounded-none border-0 transition-all duration-200 ease-out"
      style={{
        boxShadow: `0 0 20px 2px ${baseGlow}, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 24px 4px ${hoverGlow}, inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 20px 2px ${baseGlow}, inset 0 1px 0 rgba(255,255,255,0.03)`;
      }}
    >
      {/* ENTITY: Investor name + context */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            row.entity.isLocked 
              ? 'bg-zinc-800 border border-zinc-700' 
              : 'bg-gradient-to-br from-blue-600 to-indigo-600'
          }`}
        >
          <User className={`w-4 h-4 ${row.entity.isLocked ? 'text-zinc-500' : 'text-white'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <span className={`font-medium text-sm ${row.entity.isLocked ? 'text-zinc-500' : 'text-white'}`}>
            {row.entity.name}
          </span>
          {row.entity.context && (
            <div className="text-xs text-zinc-600 truncate">{row.entity.context}</div>
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

      {/* ACTION: with orange glow for locked */}
      <div 
        className="w-28 text-right"
        style={{
          boxShadow: row.glow.action === 'locked' 
            ? `0 0 12px 2px ${GLOW_COLORS.locked}` 
            : 'none',
          borderRadius: '4px',
          padding: '4px',
          margin: '-4px',
        }}
      >
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
