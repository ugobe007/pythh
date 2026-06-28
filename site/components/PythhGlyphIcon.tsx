/** Spinning / static PYTHIA glyph — black JPEG knocked out via blend mode on dark UI. */
const PYTHH_GLYPH_URL = '/images/delphi-pythia-icon-glyph-dark.jpg';

type PythhGlyphIconProps = {
  size?: number;
  spin?: boolean;
  className?: string;
  alt?: string;
};

export default function PythhGlyphIcon({
  size = 56,
  spin = false,
  className = '',
  alt = '',
}: PythhGlyphIconProps) {
  return (
    <img
      src={PYTHH_GLYPH_URL}
      alt={alt}
      draggable={false}
      aria-hidden={alt === ''}
      className={`pointer-events-none select-none object-contain ${spin ? 'animate-spin' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: 'transparent',
        mixBlendMode: 'screen',
        animationDuration: spin ? '1.1s' : undefined,
      }}
    />
  );
}
