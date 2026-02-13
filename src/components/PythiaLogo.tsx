// ============================================================================
// PythiaLogo — The Oracle of Delphi mark for pythh.ai
// ============================================================================
// Renders the Pythia image at the specified size, suitable for nav headers,
// favicons, loading states, etc.
//
// Uses the square-cropped Pythia illustration from /pythia-square.png
// with a dark circular frame that fits the dark UI theme.
// ============================================================================

interface PythiaLogoProps {
  size?: number;        // px, default 28
  className?: string;
  showRing?: boolean;   // Show subtle cyan ring, default false
}

export default function PythiaLogo({ size = 28, className = '', showRing = false }: PythiaLogoProps) {
  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Dark background circle */}
      <div className="absolute inset-0 bg-white rounded-full" />
      {/* Pythia image */}
      <img
        src="/pythia-square.png"
        alt="Pythia — pythh.ai"
        width={size}
        height={size}
        className="relative w-full h-full object-cover rounded-full"
        loading="eager"
      />
      {/* Optional glow ring */}
      {showRing && (
        <div
          className="absolute inset-0 rounded-full border border-cyan-500/30"
          style={{ boxShadow: '0 0 8px rgba(6, 182, 212, 0.15)' }}
        />
      )}
    </div>
  );
}
