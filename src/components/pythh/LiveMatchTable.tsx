// ============================================================================
// LiveMatchTable - Radar Table per Wired v2 Spec (TableCard System)
// ============================================================================
// Columns: Investor | Signal | GOD | YC++ | Fit | Status | Action
// 
// Key behaviors:
// - GOD is constant per startup (anchors reality)
// - Signal + YC++ vary per investor
// - Fit bar encodes surface tension (no number)
// - Locked vs Ready preserves prize psychology
// - Glow: cyan for high signal, orange on locked action, green for high fit
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye } from 'lucide-react';
import { MatchRow } from '@/lib/pythh-types';
import { UnlockButton } from './UnlockButton';

interface LiveMatchTableProps {
  rows: MatchRow[];
  loading: boolean;
  isPending: (investorId: string) => boolean;
  onUnlock: (investorId: string) => Promise<void>;
  unlocksRemaining: number;
  godScore?: number; // Startup's constant GOD score (shown on every row)
  className?: string;
}

// THRESHOLDS (LOCKED per spec)
const SIGNAL_THRESHOLDS = {
  WINDOW_OPENING: 7.5,
  ACTIVE: 5.5,
  COOLING: 4.0,
} as const;

// Glow colors
const GLOW_COLORS = {
  signal: 'rgba(34, 211, 238, 0.25)',    // Cyan - high signal
  signalHover: 'rgba(34, 211, 238, 0.4)',
  good: 'rgba(34, 197, 94, 0.2)',        // Green - high fit
  goodHover: 'rgba(34, 197, 94, 0.35)',
  locked: 'rgba(251, 146, 60, 0.3)',     // Orange - locked action area
  neutral: 'transparent',
} as const;

export function LiveMatchTable({
  rows,
  loading,
  isPending,
  onUnlock,
  unlocksRemaining,
  godScore,
  className = '',
}: LiveMatchTableProps) {
  const navigate = useNavigate();

  const handleView = (investorId: string) => {
    navigate(`/app/investors/${investorId}`);
  };

  if (loading && rows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading matches...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
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

  // Separate locked and unlocked rows
  const unlockedRows = rows.filter(r => !r.is_locked);
  const lockedRows = rows.filter(r => r.is_locked);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Column Headers - minimal, uppercase, subtle */}
      <div className="h-10 flex items-center gap-4 px-5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <div className="flex-1">Investor</div>
        <div className="w-20 text-center">Signal</div>
        <div className="w-16 text-center">GOD</div>
        <div className="w-16 text-center">YC++</div>
        <div className="w-20 text-center">Fit</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-28 text-right">Action</div>
      </div>

      {/* Unlocked rows first (Ready) */}
      {unlockedRows.map((row) => (
        <RadarTableRow
          key={row.investor_id}
          row={row}
          godScore={godScore}
          isPending={isPending(row.investor_id)}
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
          key={row.investor_id}
          row={row}
          godScore={godScore}
          isPending={isPending(row.investor_id)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={unlocksRemaining === 0}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Radar Row (TableCard System - glow-based)
// -----------------------------------------------------------------------------

interface RadarTableRowProps {
  row: MatchRow;
  godScore?: number;
  isPending: boolean;
  onUnlock: (investorId: string) => Promise<void>;
  onView: (investorId: string) => void;
  unlocksDisabled: boolean;
}

function RadarTableRow({ row, godScore, isPending, onUnlock, onView, unlocksDisabled }: RadarTableRowProps) {
  // Derive per-investor Signal score (0-10)
  const investorSignal = deriveInvestorSignal(row);
  
  // Derive per-investor YC++ score
  const ycPlusScore = deriveYCPlusScore(row);
  
  // Derive Fit (0-1) for bar display
  const fitValue = deriveFitScore(row);
  
  // Signal direction (from momentum bucket)
  const signalDirection = row.momentum_bucket === 'strong' || row.momentum_bucket === 'emerging' 
    ? 'up' 
    : row.momentum_bucket === 'cooling' || row.momentum_bucket === 'cold'
      ? 'down'
      : 'flat';

  // Determine glow based on state
  const hasHighSignal = investorSignal >= SIGNAL_THRESHOLDS.WINDOW_OPENING;
  const hasHighFit = fitValue >= 0.8;
  
  // Base glow (idle state)
  const getBaseGlow = () => {
    if (hasHighSignal) return GLOW_COLORS.signal;
    if (hasHighFit && !row.is_locked) return GLOW_COLORS.good;
    return GLOW_COLORS.neutral;
  };
  
  // Hover glow
  const getHoverGlow = () => {
    if (hasHighSignal) return GLOW_COLORS.signalHover;
    if (hasHighFit && !row.is_locked) return GLOW_COLORS.goodHover;
    return 'rgba(255, 255, 255, 0.05)';
  };

  return (
    <div
      className={`
        relative h-16 w-full flex items-center gap-4 px-5
        bg-zinc-900/60 rounded-none border-0
        transition-all duration-200 ease-out
      `}
      style={{
        boxShadow: `0 0 20px 2px ${getBaseGlow()}, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 24px 4px ${getHoverGlow()}, inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 20px 2px ${getBaseGlow()}, inset 0 1px 0 rgba(255,255,255,0.03)`;
      }}
    >
      {/* Investor - name + context */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
            ${row.is_locked 
              ? 'bg-zinc-800 border border-zinc-700' 
              : 'bg-gradient-to-br from-blue-600 to-indigo-600'
            }
          `}
        >
          <User className={`w-4 h-4 ${row.is_locked ? 'text-zinc-500' : 'text-white'}`} />
        </div>

        {/* Name + optional context */}
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onView(row.investor_id)}
            className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium text-sm flex items-center gap-1.5 transition-colors"
          >
            {row.investor_name}
            <Eye className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Signal (investor-specific) */}
      <div className="w-20 text-center">
        <SignalCell score={investorSignal} direction={signalDirection} />
      </div>

      {/* GOD (constant per startup) */}
      <div className="w-16 text-center">
        <span className="font-mono text-sm text-zinc-200">
          {godScore ?? '—'}
        </span>
      </div>

      {/* YC++ (per-investor perception) */}
      <div className="w-16 text-center">
        <span className="font-mono text-sm text-zinc-200">
          {ycPlusScore}
        </span>
      </div>

      {/* Fit (bars only) */}
      <div className="w-20 flex justify-center">
        <FitBar value={fitValue} />
      </div>

      {/* Status */}
      <div className="w-20 flex justify-center">
        <StatusBadge isLocked={row.is_locked} />
      </div>

      {/* Action - with orange glow for locked */}
      <div 
        className="w-28 text-right"
        style={{
          boxShadow: row.is_locked ? `0 0 12px 2px ${GLOW_COLORS.locked}` : 'none',
          borderRadius: '4px',
          padding: '4px',
          margin: '-4px',
        }}
      >
        <UnlockButton
          investorId={row.investor_id}
          isLocked={row.is_locked}
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
// Derived Score Helpers
// -----------------------------------------------------------------------------

function deriveInvestorSignal(row: MatchRow): number {
  // Use signal_score directly from row (0-10)
  // signal_score comes from the live_match_table RPC
  const base = row.signal_score ?? 5;
  
  // Adjust based on momentum for minor variance
  const momentumMod = {
    strong: 0.5,
    emerging: 0.2,
    neutral: 0,
    cooling: -0.2,
    cold: -0.5,
  }[row.momentum_bucket] || 0;
  
  return Math.max(0, Math.min(10, base + momentumMod));
}

function deriveYCPlusScore(row: MatchRow): number {
  // Derive from signal_score (0-10) scaled to 0-100 + fit_bucket
  // This represents how well this investor's patterns match this startup
  const base = (row.signal_score ?? 5) * 10;
  
  // Adjust based on fit (elite pattern recognition)
  const fitMod = {
    high: 15,
    good: 5,
    early: -10,
  }[row.fit_bucket] || 0;
  
  return Math.max(40, Math.min(95, base + fitMod));
}

function deriveFitScore(row: MatchRow): number {
  // Map fit_bucket to 0-1 for bar display
  const fitMap = {
    high: 0.9,
    good: 0.7,
    early: 0.4,
  };
  return fitMap[row.fit_bucket as keyof typeof fitMap] || 0.5;
}

// -----------------------------------------------------------------------------
// Cell Components
// -----------------------------------------------------------------------------

function SignalCell({ score, direction }: { score: number; direction: 'up' | 'down' | 'flat' }) {
  // Color based on thresholds
  const colorClass = score >= SIGNAL_THRESHOLDS.WINDOW_OPENING
    ? 'text-emerald-400'
    : score >= SIGNAL_THRESHOLDS.ACTIVE
      ? 'text-gray-300'
      : score >= SIGNAL_THRESHOLDS.COOLING
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
      <span className={colorClass}>{score.toFixed(1)}</span>
      <span className={`ml-1 text-xs ${arrowClass}`}>{arrow}</span>
    </span>
  );
}

function FitBar({ value }: { value: number }) {
  const bars = Math.round(value * 5);
  return (
    <div className="flex items-center gap-0.5" title="Surface tension - probability of conversion">
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i < bars ? 'bg-gray-300' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ isLocked }: { isLocked: boolean }) {
  if (isLocked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        Locked
      </span>
    );
  }
  return (
    <span className="text-xs text-emerald-400">
      Ready
    </span>
  );
}
