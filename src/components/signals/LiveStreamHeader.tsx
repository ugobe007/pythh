// ============================================================================
// LiveStreamHeader - Header row for live signal stream
// ============================================================================
// Specs:
//   - Title: 13px uppercase, letter-spacing slight
//   - Subtitle: 12px muted
//   - LivePill on right: LIVE=cyan, BUSY=amber, STALE=gray
// ============================================================================

import { RefreshCw } from 'lucide-react';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type LiveStreamState = 'LIVE' | 'BUSY' | 'STALE';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

export interface LiveStreamHeaderProps {
  state: LiveStreamState;
  lastUpdatedAt: number | null;
  onRefetch: () => void;
}

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export default function LiveStreamHeader({
  state,
  lastUpdatedAt,
  onRefetch,
}: LiveStreamHeaderProps) {
  // Dot color based on state
  const dotColor =
    state === 'LIVE'
      ? 'rgba(34,211,238,0.9)'  // cyan
      : state === 'BUSY'
      ? 'rgba(251,191,36,0.9)'  // amber
      : 'rgba(156,163,175,0.9)'; // gray

  const glowColor =
    state === 'LIVE'
      ? 'rgba(34,211,238,0.15)'
      : state === 'BUSY'
      ? 'rgba(251,191,36,0.15)'
      : 'rgba(156,163,175,0.10)';

  return (
    <div className="flex items-start justify-between">
      {/* Left block */}
      <div>
        <div className="text-[12.5px] tracking-widest text-white/60 uppercase">
          LIVE INVESTOR SIGNALS
        </div>
        <div className="text-[12.5px] text-white/40 mt-1">
          {lastUpdatedAt ? 'Updated moments ago' : 'Awaiting update'}
        </div>
      </div>

      {/* Right block */}
      <div className="flex items-center gap-3">
        {/* LivePill */}
        <div
          className="text-[12px] px-2 py-1 flex items-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 14px ${glowColor}`,
          }}
        >
          <span
            className="inline-block w-2 h-2 mr-2"
            style={{ background: dotColor }}
          />
          <span className="text-white/70">{state}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefetch}
          className="p-2 text-white/50 hover:text-white/80 transition-colors"
          title="Refresh signals"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
