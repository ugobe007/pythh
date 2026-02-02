// ============================================================================
// FitBars - Visual tier indicator (1-5 bars)
// ============================================================================

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

export interface FitBarsProps {
  tier: number; // 1-5
}

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export default function FitBars({ tier }: FitBarsProps) {
  // Clamp to 1-5
  const t = Math.max(1, Math.min(5, Math.round(tier || 3)));

  return (
    <div className="flex gap-[3px]">
      {[1, 2, 3, 4, 5].map((i) => {
        const isActive = i <= t;
        return (
          <div
            key={i}
            className="h-[10px] w-[6px]"
            style={{
              background: isActive
                ? 'rgba(34,197,94,0.75)'   // green
                : 'rgba(255,255,255,0.12)', // muted
            }}
          />
        );
      })}
    </div>
  );
}
