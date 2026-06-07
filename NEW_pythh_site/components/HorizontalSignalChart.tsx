import { useEffect, useState } from "react";
import {
  G, CYAN, PURPLE, GOLD, MUTED, DIM, BORDER, G_BORDER, godScoreColor,
} from "@/lib/designTokens";

interface PreviewSignal {
  label: string;
  value: number;
  raw: number;
  color: string;
}

interface PreviewDimension {
  label: string;
  score: number;
  max: number;
  color: string;
}

export interface ChartStartup {
  name: string;
  subtitle?: string | null;
  godScore: number;
  signals: PreviewSignal[];
  dimensions: PreviewDimension[];
}

interface PreviewEntry {
  startup: {
    name: string;
    domain: string | null;
    godScore: number;
    dimensions: PreviewDimension[];
  };
  signals: PreviewSignal[];
}

const FALLBACK_SIGNALS: PreviewSignal[] = [
  { label: "Execution", value: 0.82, raw: 8.2, color: G },
  { label: "Investor recv", value: 0.71, raw: 7.1, color: CYAN },
  { label: "News momentum", value: 0.88, raw: 8.8, color: GOLD },
  { label: "Capital conv", value: 0.65, raw: 6.5, color: PURPLE },
  { label: "Founder lang", value: 0.74, raw: 7.4, color: CYAN },
];

const FALLBACK_DIMS = ["TEAM", "TRACTION", "MARKET", "PRODUCT", "VISION"].map((label, i) => ({
  label,
  score: [17, 14, 18, 15, 16][i],
  max: 20,
  color: [PURPLE, CYAN, G, CYAN, PURPLE][i],
}));

function SignalColumn({
  label,
  value,
  raw,
  color,
  animated,
}: {
  label: string;
  value: number;
  raw: number;
  color: string;
  animated: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="text-[10px] font-mono truncate" style={{ color: MUTED }} title={label}>
        {label}
      </span>
      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.14 0.01 264)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: animated ? `${Math.min(100, value * 100)}%` : "0%",
            backgroundColor: color,
            transition: "width 0.9s ease-out",
          }}
        />
      </div>
      <span className="text-sm font-mono font-bold tabular-nums" style={{ color: animated ? color : DIM }}>
        {animated ? raw.toFixed(1) : "—"}
      </span>
    </div>
  );
}

export default function HorizontalSignalChart({
  accent = CYAN,
  className = "",
  startup: controlled,
}: {
  accent?: string;
  className?: string;
  /** When provided, the chart is controlled and reflects this startup. */
  startup?: ChartStartup | null;
}) {
  const [entry, setEntry] = useState<PreviewEntry | null>(null);
  const [animated, setAnimated] = useState(false);

  const isControlled = controlled !== undefined;

  // Uncontrolled fallback: fetch the featured startup (homepage hero preview).
  useEffect(() => {
    if (isControlled) return;
    fetch("/api/hero-preview")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const e = data.startups?.[0] ?? data;
        if (e?.startup) setEntry(e);
      })
      .catch(() => {});
  }, [isControlled]);

  // Resolve the active startup from either the controlled prop or the fetched entry.
  const active: ChartStartup | null = isControlled
    ? controlled
    : entry?.startup
    ? {
        name: entry.startup.name,
        subtitle: entry.startup.domain,
        godScore: entry.startup.godScore,
        signals: entry.signals ?? [],
        dimensions: entry.startup.dimensions ?? [],
      }
    : null;

  // Re-trigger the width animation whenever the displayed startup changes.
  useEffect(() => {
    setAnimated(false);
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, [active?.name]);

  const signals = active?.signals?.length ? active.signals.slice(0, 5) : (isControlled ? [] : FALLBACK_SIGNALS);
  const dims = active?.dimensions?.length ? active.dimensions : FALLBACK_DIMS;
  const godScore = active?.godScore ?? 84;
  const displayName = active?.name ?? "market leader";
  const godColor = godScoreColor(godScore);
  const hasSignals = signals.length > 0;

  return (
    <div
      className={`rounded-xl overflow-hidden mb-8 ${className}`}
      style={{
        border: `1px solid ${G_BORDER}`,
        backgroundColor: "oklch(0.1 0.01 264)",
      }}
    >
      <div
        className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b"
        style={{ borderColor: BORDER, backgroundColor: "oklch(0.085 0.01 264)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: accent }} />
          <span
            className="font-display font-bold text-white truncate"
            style={{ fontSize: "clamp(1.05rem, 2.2vw, 1.5rem)", maxWidth: "min(60vw, 360px)", letterSpacing: "-0.01em" }}
            title={displayName}
          >
            {displayName}
          </span>
        </div>
        <div
          className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl shrink-0"
          style={{
            border: `1px solid ${godColor}55`,
            backgroundColor: `${godColor}1f`,
            boxShadow: animated ? `0 0 22px ${godColor}40` : "none",
            transition: "box-shadow 0.5s ease-out",
          }}
        >
          <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: godColor }}>
            GOD
          </span>
          <span
            className="font-display font-extrabold tabular-nums leading-none"
            style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", color: godColor, textShadow: `0 0 16px ${godColor}88` }}
          >
            {animated ? godScore : "—"}
          </span>
        </div>
      </div>

      {hasSignals ? (
        <div className="px-4 py-5 border-b" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
            {signals.map((s) => (
              <SignalColumn key={s.label} {...s} animated={animated} />
            ))}
          </div>
        </div>
      ) : isControlled ? (
        <div className="px-4 py-3 border-b" style={{ borderColor: BORDER }}>
          <span className="text-[10px] font-mono" style={{ color: DIM }}>
            No observable signal events yet — GOD dimensions shown below.
          </span>
        </div>
      ) : null}

      <div className="px-4 py-3 border-b" style={{ borderColor: BORDER }}>
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
          GOD dimensions · 0–20 each
        </span>
      </div>
      <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {dims.map(({ label, score, max, color }) => (
          <div key={label} className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono w-14 shrink-0" style={{ color: DIM }}>{label}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.14 0.01 264)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: animated ? `${(score / max) * 100}%` : "0%",
                  backgroundColor: color,
                  transition: "width 0.85s ease-out 0.1s",
                }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold w-5 text-right shrink-0 tabular-nums" style={{ color }}>
              {animated ? score : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
