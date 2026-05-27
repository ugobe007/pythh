import { useEffect, useState } from "react";
import HorizontalSignalTicker from "@/components/HorizontalSignalTicker";
import HeroScoringDots from "@/components/HeroScoringDots";
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

interface PreviewEntry {
  startup: {
    id: string;
    name: string;
    domain: string | null;
    godScore: number;
    godLabel: string;
    dimensions: PreviewDimension[];
  };
  signals: PreviewSignal[];
}

const DIM_COLORS = [PURPLE, CYAN, G, CYAN, PURPLE];
const FALLBACK_SIGNALS: PreviewSignal[] = [
  { label: "Execution velocity", value: 0.82, raw: 8.2, color: G },
  { label: "Investor receptivity", value: 0.71, raw: 7.1, color: CYAN },
  { label: "News momentum", value: 0.88, raw: 8.8, color: GOLD },
  { label: "Capital convergence", value: 0.65, raw: 6.5, color: PURPLE },
  { label: "Founder language", value: 0.74, raw: 7.4, color: CYAN },
];

const FALLBACK_DIMS = ["TEAM", "TRACTION", "MARKET", "PRODUCT", "VISION"].map((label, i) => ({
  label,
  score: [17, 14, 18, 15, 16][i],
  max: 20,
  color: DIM_COLORS[i],
}));

const FALLBACK_GOD = { score: 84, label: "Elite · Investment-grade", name: "oracle-pick" };

export default function PythhEngineVisual({ className = "" }: { className?: string }) {
  const [entry, setEntry] = useState<PreviewEntry | null>(null);
  const [animated, setAnimated] = useState(false);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    fetch("/api/hero-preview")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const e = data.startups?.[0] ?? data;
        if (e?.startup) setEntry(e);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const scan = setTimeout(() => setScanning(false), 1200);
    const anim = setTimeout(() => setAnimated(true), 1400);
    return () => {
      clearTimeout(scan);
      clearTimeout(anim);
    };
  }, [entry?.startup?.id]);

  const startup = entry?.startup;
  const signals = entry?.signals?.length ? entry.signals : FALLBACK_SIGNALS;
  const dims = startup?.dimensions?.length
    ? startup.dimensions
    : FALLBACK_DIMS;
  const godScore = startup?.godScore ?? FALLBACK_GOD.score;
  const godLabel = startup?.godLabel ?? FALLBACK_GOD.label;
  const displayName = startup?.domain ?? startup?.name ?? "live startup";

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        border: `1px solid ${G_BORDER}`,
        backgroundColor: "oklch(0.08 0.01 264)",
        boxShadow: "0 0 48px oklch(0.696 0.17 162.48 / 0.06)",
      }}
    >
      <HorizontalSignalTicker />

      <div
        className="px-4 py-3 flex items-center justify-between border-b gap-3"
        style={{ borderColor: BORDER, backgroundColor: "oklch(0.085 0.01 264)" }}
      >
        <div className="min-w-0">
          <p
            className="font-display font-bold truncate text-lg leading-tight mb-1"
            style={{ color: PURPLE, letterSpacing: "-0.02em" }}
          >
            {displayName}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: G }} />
            <span className="text-[11px] font-mono font-semibold truncate" style={{ color: G }}>
              PYTHH · {scanning ? "scanning signals…" : "scored in real time"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-mono uppercase tracking-widest mb-0.5" style={{ color: DIM }}>
            24 algorithms
          </p>
          <p className="text-[10px] font-mono" style={{ color: MUTED }}>tier-1 VC criteria</p>
        </div>
      </div>

      {scanning ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2">
          <HeroScoringDots active durationMs={1200} tone="emerald" />
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: G }}>
            reading signal array
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 py-2 border-b" style={{ borderColor: BORDER }}>
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
              Observable signals · 0–10 scale
            </span>
          </div>
          <div className="px-4 py-3 space-y-2.5 border-b" style={{ borderColor: BORDER }}>
            {signals.slice(0, 5).map(({ label, value, raw, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-mono w-[96px] shrink-0 truncate" style={{ color: MUTED }}>
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.14 0.01 264)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: animated ? `${Math.min(100, value * 100)}%` : "0%",
                      backgroundColor: color,
                      transition: "width 0.85s ease-out",
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold w-7 text-right tabular-nums shrink-0" style={{ color }}>
                  {animated ? raw.toFixed(1) : "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-b" style={{ borderColor: BORDER }}>
            <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
              GOD score · 5-dimension composite
            </span>
          </div>
          {dims.map(({ label, score, max, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 border-b"
              style={{ borderColor: "oklch(0.11 0.01 264)" }}
            >
              <span className="text-[10px] font-mono w-14 shrink-0" style={{ color: DIM }}>{label}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.14 0.01 264)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: animated ? `${(score / max) * 100}%` : "0%",
                    backgroundColor: color,
                    transition: "width 0.85s ease-out 0.15s",
                  }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold w-5 text-right shrink-0" style={{ color }}>
                {animated ? score : "—"}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-2">
            <div className="px-4 py-4 border-r" style={{ borderColor: BORDER }}>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>GOD Score</p>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-4xl font-display font-bold tabular-nums"
                  style={{ color: animated ? godScoreColor(godScore) : DIM, lineHeight: 1 }}
                >
                  {animated ? godScore : "—"}
                </span>
                <span className="text-xs font-mono" style={{ color: DIM }}>/100</span>
              </div>
              {animated && (
                <p className="text-[10px] font-mono mt-1" style={{ color: MUTED }}>{godLabel}</p>
              )}
            </div>
            <div className="px-4 py-4 flex flex-col justify-center">
              <p className="text-[9px] font-mono uppercase tracking-widest mb-2" style={{ color: DIM }}>
                Engine
              </p>
              {[
                { n: "24", label: "scoring algorithms" },
                { n: "40+", label: "signal types" },
                { n: "RT", label: "continuous refresh" },
              ].map(({ n, label }) => (
                <div key={label} className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-mono font-bold tabular-nums" style={{ color: G }}>{n}</span>
                  <span className="text-[10px] font-mono" style={{ color: MUTED }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
