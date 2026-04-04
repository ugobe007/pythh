/**
 * Text-only pythh mark — no glyph, just the word (home / editorial use).
 */

type Props = {
  className?: string;
  /** Slightly smaller for subheads */
  size?: 'sm' | 'md' | 'lg';
};

const sizeClass = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export default function PythhWordmark({ className = '', size = 'md' }: Props) {
  return (
    <span
      className={`inline font-bold tracking-tight text-white ${sizeClass[size]} ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      pythh
    </span>
  );
}
