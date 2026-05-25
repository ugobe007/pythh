/**
 * Navbar Pythia glyph — crops to the top half of the icon and shifts horizontally
 * so the face/wreath reads at small sizes (full glyph is too tall for h-14 nav).
 */

type Props = {
  /** Visible crop box (square). */
  size?: number;
  /** Horizontal slide as fraction of size (negative = left). */
  offsetX?: number;
  /** Scale width vs crop box ( >1 zooms in ). */
  scale?: number;
  className?: string;
};

export default function PythhNavIcon({
  size = 30,
  offsetX = -0.18,
  scale = 1.55,
  className = "",
}: Props) {
  // Full icon height = 2× crop box → container shows top half only.
  const imgH = size * 2;
  const imgW = size * 2 * scale;

  return (
    <span
      className={`inline-block shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img
        src="/images/delphi-pythia-icon-glyph-dark.jpg"
        alt=""
        draggable={false}
        className="block max-w-none select-none pointer-events-none"
        style={{
          width: imgW,
          height: imgH,
          marginLeft: offsetX * size,
        }}
      />
    </span>
  );
}
