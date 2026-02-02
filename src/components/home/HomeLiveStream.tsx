// ============================================================================
// HomeLiveStream - Pure Render Component for Home "Live Tape"
// ============================================================================
// Consumes LiveStreamRowViewModel[] - NO INLINE COMPUTATIONS
// 
// Contract rules (LOCKED):
//   1. All values pre-computed in view model
//   2. Row height is 56px
//   3. Maximum 5 columns: ENTITY | CONTEXT | SIGNAL | FIT | STATUS
//   4. Chronological order ONLY - no sorting by score
//   5. Click → Navigate to relevant detail page
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { Activity, Zap, Clock } from 'lucide-react';
import type { LiveStreamRowViewModel } from '@/lib/live-stream-view-model';
import { LIVE_STREAM_THRESHOLDS } from '@/lib/live-stream-view-model';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

interface HomeLiveStreamProps {
  rows: LiveStreamRowViewModel[];
  loading?: boolean;
  isLive?: boolean;
  className?: string;
}

// -----------------------------------------------------------------------------
// GLOW COLORS (LOCKED per spec)
// -----------------------------------------------------------------------------

const GLOW_COLORS = {
  cyan: 'rgba(34, 211, 238, 0.2)',
  cyanHover: 'rgba(34, 211, 238, 0.35)',
  cyanGreen: 'rgba(34, 211, 238, 0.15), rgba(34, 197, 94, 0.15)',
  cyanGreenHover: 'rgba(34, 211, 238, 0.25), rgba(34, 197, 94, 0.25)',
} as const;

// -----------------------------------------------------------------------------
// STATUS ICONS
// -----------------------------------------------------------------------------

const STATUS_ICONS = {
  LIVE: Zap,
  NEW: Activity,
  COOLING: Clock,
} as const;

const STATUS_COLORS = {
  LIVE: 'text-emerald-400',
  NEW: 'text-cyan-400',
  COOLING: 'text-gray-500',
} as const;

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export function HomeLiveStream({
  rows,
  loading,
  className = '',
}: HomeLiveStreamProps) {
  const navigate = useNavigate();

  if (loading && rows.length === 0) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Animated placeholder rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i}
            className="h-14 w-full bg-zinc-900/40 rounded animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
        <div className="text-center text-xs text-zinc-500 py-2">
          Loading live stream...
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-16 ${className}`}>
        <div className="text-center text-gray-400">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No activity yet</p>
          <p className="text-xs mt-1 text-gray-500">Live matches will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500">
        <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span className="uppercase tracking-wider font-medium">Live Tape</span>
        <span className="text-zinc-600">•</span>
        <span>{rows.length} events</span>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <LiveStreamRow
          key={row.eventId}
          row={row}
          onNavigate={(type, id) => {
            if (type === 'startup') {
              navigate(`/app/radar?startup=${id}`);
            } else {
              navigate(`/app/radar?investor=${id}`);
            }
          }}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Row Component
// -----------------------------------------------------------------------------

interface LiveStreamRowProps {
  row: LiveStreamRowViewModel;
  onNavigate: (entityType: 'startup' | 'investor', entityId: string | null) => void;
}

function LiveStreamRow({ row, onNavigate }: LiveStreamRowProps) {
  const StatusIcon = STATUS_ICONS[row.status];
  
  const glowBase = row.glow.hover === 'cyan-green' 
    ? `0 0 16px 2px ${GLOW_COLORS.cyanGreen}`
    : 'none';
  
  const glowHover = row.glow.hover === 'cyan-green'
    ? `0 0 20px 4px ${GLOW_COLORS.cyanGreenHover}`
    : `0 0 20px 4px ${GLOW_COLORS.cyanHover}`;

  return (
    <div
      className="relative h-14 w-full flex items-center gap-4 px-4 bg-zinc-900/50 rounded-none border-0 transition-all duration-150 ease-out cursor-pointer"
      style={{ boxShadow: glowBase }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = glowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = glowBase;
      }}
      onClick={() => onNavigate(row.entity.type, row.linkedStartupId)}
    >
      {/* ENTITY */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm truncate">{row.entity.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase">
            {row.entity.type}
          </span>
        </div>
      </div>

      {/* CONTEXT */}
      <div className="w-48 text-right">
        <span className="text-xs text-zinc-400 truncate">{row.context}</span>
      </div>

      {/* SIGNAL */}
      <div className="w-16 text-center">
        <SignalCell value={row.signal.value} />
      </div>

      {/* FIT */}
      <div className="w-16 text-center">
        <FitCell value={row.fit.tier} />
      </div>

      {/* STATUS */}
      <div className="w-20 flex items-center justify-end gap-1.5">
        <StatusIcon className={`w-3.5 h-3.5 ${STATUS_COLORS[row.status]}`} />
        <span className={`text-xs font-medium ${STATUS_COLORS[row.status]}`}>
          {row.status}
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cell Components
// -----------------------------------------------------------------------------

// Local thresholds to avoid missing exports
const SIGNAL_ACTIVE = 5.0;
const FIT_STRONG = 4;
const FIT_GOOD = 3;

function SignalCell({ value }: { value: number }) {
  const colorClass = value >= LIVE_STREAM_THRESHOLDS.SIGNAL_HIGH
    ? 'text-cyan-400'
    : value >= SIGNAL_ACTIVE
      ? 'text-gray-300'
      : 'text-gray-500';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{value.toFixed(1)}</span>;
}

function FitCell({ value }: { value: number }) {
  const colorClass = value >= FIT_STRONG
    ? 'text-emerald-400'
    : value >= FIT_GOOD
      ? 'text-gray-300'
      : 'text-gray-500';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{value}</span>;
}

// -----------------------------------------------------------------------------
// Export subcomponents for flexibility
// -----------------------------------------------------------------------------

export { LiveStreamRow, SignalCell, FitCell };
