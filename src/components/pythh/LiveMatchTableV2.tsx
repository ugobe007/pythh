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

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, ExternalLink, Copy, Check } from 'lucide-react';
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
  /** Render mode: 'unlocked' = only unlocked rows, 'locked' = only locked rows, 'all' = both */
  mode?: 'unlocked' | 'locked' | 'all';
  /** For "Copy intro" — founder-facing get-the-meeting */
  startupName?: string;
  startupTagline?: string;
  startupSectors?: string[];
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
// SKELETON ROW
// -----------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="h-14 w-full flex items-center gap-4 px-4 border-b border-zinc-800/30 animate-pulse">
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-zinc-700/60 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 w-32 bg-zinc-700/60 rounded" />
          <div className="h-3 w-24 bg-zinc-800/50 rounded" />
        </div>
      </div>
      <div className="w-20 flex justify-center"><div className="h-4 w-12 bg-zinc-700/60 rounded" /></div>
      <div className="w-16 flex justify-center"><div className="h-4 w-8 bg-zinc-700/60 rounded" /></div>
      <div className="w-16 flex justify-center"><div className="h-4 w-8 bg-zinc-700/60 rounded" /></div>
      <div className="w-12 flex justify-center"><div className="h-4 w-6 bg-zinc-700/60 rounded" /></div>
      <div className="w-20 flex justify-center gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-1.5 h-3 bg-zinc-700/60 rounded-sm" />
        ))}
      </div>
      <div className="w-20 flex justify-center"><div className="h-4 w-14 bg-zinc-700/60 rounded" /></div>
      <div className="w-36 flex justify-end"><div className="h-8 w-24 bg-zinc-700/60 rounded" /></div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

function buildIntroLine(
  investorName: string,
  startupName: string,
  tagline?: string | null,
  sectors?: string[]
): string {
  const firstLine = `Hi ${investorName}, I'm reaching out from ${startupName}.`;
  const second = tagline?.trim()
    ? tagline.replace(/\.$/, '')
    : sectors?.length
      ? `We're building in ${sectors.slice(0, 2).join(' and ')}.`
      : 'We’re building something we think fits your thesis.';
  const close = 'Would love 15 minutes to share our progress and get your take.';
  return `${firstLine}\n\n${second}\n\n${close}`;
}

export function LiveMatchTable({
  unlockedRows,
  lockedRows,
  loading,
  isPending,
  onUnlock,
  unlocksRemaining,
  className = '',
  mode = 'all',
  startupName,
  startupTagline,
  startupSectors,
}: LiveMatchTableProps) {
  const navigate = useNavigate();

  const handleView = (investorId: string) => {
    navigate(`/investor/${investorId}`);
  };

  const showUnlocked = mode === 'unlocked' || mode === 'all';
  const showLocked = mode === 'locked' || mode === 'all';

  const relevantUnlocked = showUnlocked ? unlockedRows : [];
  const relevantLocked = showLocked ? lockedRows : [];

  // Loading: show skeleton rows instead of spinner
  if (loading && relevantUnlocked.length === 0 && relevantLocked.length === 0) {
    return (
      <div
        data-testid={mode === 'all' ? 'match-table' : `match-table-${mode}`}
        className={`space-y-0 ${className}`}
      >
        <div className="h-10 flex items-center gap-4 px-4 text-xs font-medium text-zinc-500 border-b border-zinc-800/50">
          <div className="flex-1">Investor</div>
          <div className="w-20 text-center">Signal</div>
          <div className="w-16 text-center">Match</div>
          <div className="w-16 text-center">YC++</div>
          <div className="w-12 text-center">Δ</div>
          <div className="w-20 text-center">Fit</div>
          <div className="w-20 text-center">Status</div>
          <div className="w-36 text-right">Action</div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (relevantUnlocked.length === 0 && relevantLocked.length === 0) {
    if (mode === 'locked') return null; // Don't show empty state for locked-only
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
      data-testid={mode === 'all' ? 'match-table' : `match-table-${mode}`}
      className={`space-y-0 ${className}`}
    >
      {/* Column Headers */}
      <div className="h-10 flex items-center gap-4 px-4 text-xs font-medium text-zinc-500 border-b border-zinc-800/50">
        <div className="flex-1">Investor</div>
        <div className="w-20 text-center" title="Market signal strength (0-100)">Signal</div>
        <div className="w-16 text-center" title="Match score with this investor (0-100)">Match</div>
        <div className="w-16 text-center" title="How this investor perceives startups like yours (0-100)">YC++</div>
        <div className="w-12 text-center" title="Weekly change">Δ</div>
        <div className="w-20 text-center" title="Investor-startup fit alignment">Fit</div>
        <div className="w-20 text-center">Status</div>
        <div className="w-36 text-right">Action</div>
      </div>

      {/* Unlocked rows - show top 5 only */}
      {showUnlocked && unlockedRows.slice(0, 5).map((row, index) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
          rowIndex={index}
          isPending={isPending(row.investorId)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={false}
          startupName={startupName}
          startupTagline={startupTagline}
          startupSectors={startupSectors}
        />
      ))}

      {/* Locked rows - show max 5 */}
      {showLocked && lockedRows.slice(0, 5).map((row, index) => (
        <RadarTableRow
          key={row.investorId}
          row={row}
          rowIndex={(showUnlocked ? unlockedRows.length : 0) + index}
          isPending={isPending(row.investorId)}
          onUnlock={onUnlock}
          onView={handleView}
          unlocksDisabled={unlocksRemaining === 0}
          startupName={startupName}
          startupTagline={startupTagline}
          startupSectors={startupSectors}
        />
      ))}

      {/* More locked indicator */}
      {showLocked && lockedRows.length > 5 && (
        <div className="h-12 flex items-center justify-center text-xs text-zinc-500 border-t border-zinc-800/30">
          <Lock className="w-3.5 h-3.5 mr-1.5" />
          +{lockedRows.length - 5} more investors available — unlock to reveal
        </div>
      )}
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
  rowIndex: number;
  startupName?: string;
  startupTagline?: string | null;
  startupSectors?: string[];
}

function RadarTableRow({ row, isPending, onUnlock, onView, unlocksDisabled, rowIndex, startupName, startupTagline, startupSectors }: RadarTableRowProps) {
  const [copied, setCopied] = useState(false);
  const handleCopyIntro = useCallback(() => {
    const name = startupName || 'Our startup';
    const investor = row.entity.name || 'there';
    const line = buildIntroLine(investor, name, startupTagline, startupSectors);
    void navigator.clipboard.writeText(line).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [row.entity.name, startupName, startupTagline, startupSectors]);
  // Supabase style: no glows, just clean borders and hover states
  const isHighSignal = row.signal.value >= RADAR_THRESHOLDS.SIGNAL_WINDOW_OPENING;
  
  return (
    <div
      className="relative h-14 w-full flex items-center gap-4 px-4 border-b border-zinc-800/30 hover:bg-zinc-900/40 transition-colors"
      data-testid={`match-row-${row.investorId}`}
    >
      {/* ENTITY: Investor name + context - ALWAYS UNLOCKED */}
      <div className="relative group flex-1 flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Clickable investor name with link */}
            <button
              onClick={() => onView(row.investorId)}
              className="font-medium text-sm text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 transition-colors"
            >
              {row.entity.name}
              <ExternalLink className="w-3 h-3" />
            </button>
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

        {/* WHY hover tooltip — only for unlocked rows with reasoning */}
        {row.whySummary && (
          <div className="pointer-events-none absolute left-0 bottom-full mb-2 z-40
                          opacity-0 group-hover:opacity-100 transition-opacity duration-150
                          w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Why this match</p>
            <ul className="space-y-1">
              {row.whySummary.split(/\.\s+/).filter(s => s.trim().length > 4).slice(0, 4).map((sentence, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">›</span>
                  <span className="text-xs text-zinc-300 leading-snug">{sentence.replace(/\.$/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* SIGNAL: value + direction arrow - normalized to 0-100 for display */}
      <div className="w-20 text-center">
        <SignalCell 
          value={row.signal.value} 
          direction={row.signal.direction} 
        />
      </div>

      {/* MATCH: investor-specific match score (0-100) */}
      <div className="w-16 text-center">
        <span className="font-mono text-sm text-zinc-200">{row.matchScore}</span>
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

      {/* ACTION - Copy intro (get the meeting) + Unlock/View */}
      <div className="w-36 text-right flex items-center justify-end gap-2">
        {!row.entity.isLocked && startupName && (
          <button
            type="button"
            onClick={handleCopyIntro}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-cyan-400 border border-zinc-700 hover:border-cyan-500/50 rounded transition-colors"
            title="Copy intro line for this investor"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy intro'}</span>
          </button>
        )}
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

function StatusBadge({ status }: { status: 'LOCKED' | 'READY' | 'LIVE' | 'WARMING' }) {
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
  
  if (status === 'WARMING') {
    return (
      <span className="text-xs text-amber-400">
        Warming
      </span>
    );
  }
  
  return <span className="text-xs text-emerald-400">Ready</span>;
}
