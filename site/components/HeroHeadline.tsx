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
  const afterAccent = headline.slice(idx + HERO_HEADLINE_ACCENT.length);
  const periodBreak = afterAccent.startsWith('.');
  return (
    <h1 className={className} style={style}>
      {headline.slice(0, idx)}
      {periodBreak ? (
        <>
          <span
            style={{
              color: G,
              whiteSpace: "nowrap",
              fontSize: "clamp(2.85rem, 5.6vw, 4.35rem)",
            }}
          >
            {HERO_HEADLINE_ACCENT}.
          </span>
          <br />
          {afterAccent.slice(1).trimStart()}
        </>
      ) : (
        <>
          <span style={{ color: G }}>{HERO_HEADLINE_ACCENT}</span>
          {afterAccent}
        </>
      )}
    </h1>
  );
}
