import React, { useMemo, useState } from 'react';

/**
 * Hot Money / Pythh flame marks — loads from `public/images`:
 * - Primary: `fire_icon_01.png` … `fire_icon_09.png` (variant 1 → `01`, … 9 → `09`)
 * - Also tries `.jpg` / `.jpeg` for older copies
 * - PNG bytes saved as `.jpg` break decoding (wrong MIME) — use `.png` for PNG art
 */

export type FlameVariant = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Resolve `/images/...` against Vite `base` (e.g. `/` or `/app/`) */
function publicImageUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${base}${normalized}`;
}

interface FlameIconProps {
  variant?: FlameVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
  animate?: boolean;
  onClick?: () => void;
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
  '2xl': 'w-12 h-12',
  '3xl': 'w-16 h-16',
  '4xl': 'w-24 h-24',
};

function flameSourcesForVariant(variant: FlameVariant): string[] {
  const v = variant.toString();
  const padded = variant.toString().padStart(2, '0');
  return [
    publicImageUrl(`images/fire_icon_${padded}.png`),
    publicImageUrl(`images/fire_icon_${padded}.jpg`),
    publicImageUrl(`images/fire_icon_${padded}.jpeg`),
    publicImageUrl(`images/flames/flame-${v}.png`),
    publicImageUrl(`images/flames/flame-${v}.jpg`),
    publicImageUrl('images/fire-icon-new.svg'),
    publicImageUrl('images/fire-icon.svg'),
  ];
}

const FallbackFlame: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M12 2C12 2 6 8 6 14C6 17.3137 8.68629 20 12 20C15.3137 20 18 17.3137 18 14C18 8 12 2 12 2Z"
      fill="url(#flame-gradient)"
    />
    <path
      d="M12 8C12 8 9 11 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14C15 11 12 8 12 8Z"
      fill="#FCD34D"
    />
    <defs>
      <linearGradient id="flame-gradient" x1="12" y1="2" x2="12" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F97316" />
        <stop offset="1" stopColor="#DC2626" />
      </linearGradient>
    </defs>
  </svg>
);

function useFlameUrl(variant: FlameVariant): {
  url: string | null;
  onError: () => void;
} {
  const sources = useMemo(() => flameSourcesForVariant(variant), [variant]);
  const [idx, setIdx] = useState(0);
  const url = idx < sources.length ? sources[idx] : null;
  const onError = () => setIdx((i) => i + 1);
  return { url, onError };
}

const FlameIcon: React.FC<FlameIconProps> = ({
  variant = 5,
  size = 'md',
  className = '',
  animate = false,
  onClick,
}) => {
  const { url, onError } = useFlameUrl(variant);
  const animationClass = animate ? 'animate-pulse hover:animate-bounce' : '';
  const baseClass = `${sizeClasses[size]} ${animationClass} ${className} object-contain`;

  if (!url) {
    return <FallbackFlame className={baseClass} />;
  }

  return (
    <img
      key={url}
      src={url}
      alt=""
      className={baseClass}
      onClick={onClick}
      onError={onError}
      style={{ cursor: onClick ? 'pointer' : 'inherit' }}
    />
  );
};

/** Dense tables / badges — same resolution chain, default `xs` */
export const HotMoneyFlameMark: React.FC<{
  variant?: FlameVariant;
  className?: string;
}> = ({ variant = 5, className = '' }) => (
  <FlameIcon variant={variant} size="xs" className={`object-contain ${className}`} />
);

export const AnimatedFlame: React.FC<Omit<FlameIconProps, 'variant' | 'animate'>> = (props) => {
  const [variant, setVariant] = useState<FlameVariant>(5);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setVariant((prev) => (((prev % 9) + 1) as FlameVariant));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return <FlameIcon {...props} variant={variant} animate />;
};

export const HotMatchLogo: React.FC<{ size?: FlameIconProps['size']; className?: string }> = ({
  size = 'lg',
  className,
}) => <FlameIcon variant={5} size={size} className={className} />;

export const StartupFlame: React.FC<{ size?: FlameIconProps['size']; className?: string }> = ({
  size = 'md',
  className,
}) => <FlameIcon variant={8} size={size} className={className} />;

export const TrendingFlame: React.FC<{ size?: FlameIconProps['size']; className?: string }> = ({
  size = 'md',
  className,
}) => <FlameIcon variant={9} size={size} className={className} animate />;

export const MatchFlame: React.FC<{ size?: FlameIconProps['size']; className?: string }> = ({
  size = 'md',
  className,
}) => <FlameIcon variant={7} size={size} className={className} />;

export default FlameIcon;
