import { useEffect, useState } from "react";

const DOT_COUNT = 5;

type HeroScoringDotsProps = {
  active: boolean;
  /** ms for full dot cycle — should match parent transition timing */
  durationMs?: number;
  /** emerald = scanning, purple = handoff to next startup */
  tone?: "emerald" | "purple";
};

export default function HeroScoringDots({
  active,
  durationMs = 1400,
  tone = "emerald",
}: HeroScoringDotsProps) {
  const [visible, setVisible] = useState(0);
  const activeColor = tone === "purple" ? "#a78bfa" : "#22c55e";
  const idleColor = "oklch(0.28 0.01 264)";

  useEffect(() => {
    if (!active) {
      setVisible(0);
      return;
    }
    setVisible(0);
    const stepMs = Math.max(180, Math.round(durationMs / DOT_COUNT));
    const id = setInterval(() => {
      setVisible((n) => (n >= DOT_COUNT ? DOT_COUNT : n + 1));
    }, stepMs);
    return () => clearInterval(id);
  }, [active, durationMs, tone]);

  return (
    <div className="flex flex-col items-center gap-3 select-none pointer-events-none">
      <div
        className="font-mono font-bold leading-none"
        style={{ fontSize: "2rem", letterSpacing: "0.45em" }}
        aria-hidden
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <span
            key={i}
            style={{
              color: i < visible ? activeColor : idleColor,
              opacity: i < visible ? 1 : 0.35,
              transition: "color 0.2s ease, opacity 0.2s ease",
              textShadow: i < visible && tone === "purple"
                ? "0 0 12px rgba(167,139,250,0.45)"
                : i < visible
                ? "0 0 10px rgba(34,197,94,0.35)"
                : undefined,
            }}
          >
            .
          </span>
        ))}
      </div>
    </div>
  );
}
