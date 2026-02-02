// ============================================================================
// SystemLine - Single authoritative status line
// ============================================================================
// The one place we "talk" to the user about system state.
// Specs: 12-13px, muted, no container box.
// ============================================================================

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type SystemLineState = 'idle' | 'loading' | 'live' | 'stale';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

export interface SystemLineProps {
  state: SystemLineState;
  lastUpdatedAt: number | null;
}

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export default function SystemLine({ state, lastUpdatedAt }: SystemLineProps) {
  const age =
    lastUpdatedAt == null
      ? null
      : Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));

  switch (state) {
    case 'idle':
      return (
        <div className="text-[12.5px] text-white/45">
          Waiting for a startup URL to analyze investor signals…
        </div>
      );

    case 'loading':
      return (
        <div className="text-[12.5px] text-white/55">
          Analyzing market signals, investor language, and fund activity…
        </div>
      );

    case 'stale':
      return (
        <div className="text-[12.5px] text-white/45">
          Showing last known signals • Live feed will resume shortly
        </div>
      );

    case 'live':
    default:
      return (
        <div className="text-[12.5px] text-white/45">
          Live feed active •{' '}
          {age == null
            ? 'Updated recently'
            : age < 10
            ? 'Updated moments ago'
            : `Updated ${age}s ago`}
        </div>
      );
  }
}
