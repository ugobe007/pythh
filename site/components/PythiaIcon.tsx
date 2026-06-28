/**
 * Cropped PYTHIA portrait — face/torso only, no laurel branch or bowl.
 * Used as the small brand mark in nav strips, CTAs, and MCP badges.
 */
const PYTHIA_PORTRAIT_URL = '/images/pythh_oracle.png';

type PythiaIconProps = {
  /** Outer box size in px */
  size?: number;
  /** Subtle purple ring (Connect / MCP contexts) */
  ring?: boolean;
  className?: string;
  alt?: string;
};

export default function PythiaIcon({
  size = 32,
  ring = false,
  className = '',
  alt = 'PYTHIA',
}: PythiaIconProps) {
  const inner = Math.round(size * 0.88);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent ${className}`}
      style={{
        width: size,
        height: size,
        ...(ring ? { boxShadow: '0 0 0 1px rgba(168,85,247,0.35)' } : undefined),
      }}
      aria-hidden={alt === ''}
    >
      <img
        src={PYTHIA_PORTRAIT_URL}
        alt={alt}
        draggable={false}
        className="pointer-events-none select-none"
        style={{
          width: inner * 1.75,
          height: inner * 1.75,
          maxWidth: 'none',
          objectFit: 'cover',
          // Center crop on face — trims branch (right) and bowl (bottom)
          objectPosition: '38% 14%',
          filter: 'grayscale(1) contrast(1.08) brightness(1.02)',
        }}
      />
    </span>
  );
}
