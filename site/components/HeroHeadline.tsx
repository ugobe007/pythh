import { G } from "@/lib/designTokens";
import { HERO_HEADLINE_ACCENT } from "@/lib/heroHeadlineExperiment";

export default function HeroHeadline({
  headline,
  className,
  style,
}: {
  headline: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const idx = headline.lastIndexOf(HERO_HEADLINE_ACCENT);
  if (idx < 0) {
    return (
      <h1 className={className} style={style}>
        {headline}
      </h1>
    );
  }
  return (
    <h1 className={className} style={style}>
      {headline.slice(0, idx)}
      <span style={{ color: G }}>{HERO_HEADLINE_ACCENT}</span>
    </h1>
  );
}
