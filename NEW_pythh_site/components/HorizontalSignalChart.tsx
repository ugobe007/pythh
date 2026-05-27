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
}: {
  accent?: string;
  className?: string;
}) {
  const [entry, setEntry] = useState<PreviewEntry | null>(null);
  const [animated, setAnimated] = useState(false);

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
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, [entry?.startup?.name]);

  const startup = entry?.startup;
  const signals = entry?.signals?.length ? entry.signals.slice(0, 5) : FALLBACK_SIGNALS;
  const dims = startup?.dimensions?.length ? startup.dimensions : FALLBACK_DIMS;
  const godScore = startup?.godScore ?? 84;
  const displayName = startup?.domain ?? startup?.name ?? "market leader";

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
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: accent }} />
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>
            Observable signals · 0–10
          </span>
        </div>
        <div className="flex items-baseline gap-2 text-right">
          <span className="text-xs font-medium text-white truncate max-w-[180px]">{displayName}</span>
          <span className="text-[10px] font-mono" style={{ color: DIM }}>·</span>
          <span className="text-sm font-display font-bold tabular-nums" style={{ color: godScoreColor(godScore) }}>
            GOD {animated ? godScore : "—"}
          </span>
        </div>
      </div>

      <div className="px-4 py-5 border-b" style={{ borderColor: BORDER }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
          {signals.map((s) => (
            <SignalColumn key={s.label} {...s} animated={animated} />
          ))}
        </div>
      </div>

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
