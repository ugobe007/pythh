import { useEffect, useRef, useState } from "react";
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

interface PreviewEntry {
  startup: {
    id: string;
    name: string;
    domain: string | null;
    godScore: number;
    godLabel: string;
  };
  signals: PreviewSignal[];
}

const FALLBACK_SIGNALS: PreviewSignal[] = [
  { label: "Execution velocity", value: 0.82, raw: 8.2, color: G },
  { label: "Investor receptivity", value: 0.71, raw: 7.1, color: CYAN },
  { label: "News momentum", value: 0.88, raw: 8.8, color: GOLD },
  { label: "Capital convergence", value: 0.65, raw: 6.5, color: PURPLE },
  { label: "Founder language", value: 0.74, raw: 7.4, color: CYAN },
];

const FALLBACK_ENTRIES: PreviewEntry[] = [
  {
    startup: {
      id: "fallback-1",
      name: "oracle-pick",
      domain: "oracle-pick.ai",
      godScore: 84,
      godLabel: "Elite · Investment-grade",
    },
    signals: FALLBACK_SIGNALS,
  },
];

/** Dwell time per startup before rotating (ms) */
const ROTATE_MS = 6500;
/** Brief scan state when switching entries (ms) */
const SCAN_MS = 900;
const ANIM_DELAY_MS = 1100;

function normalizePool(data: unknown): PreviewEntry[] {
  if (!data || typeof data !== "object") return [];
  const d = data as { startups?: PreviewEntry[]; startup?: PreviewEntry["startup"]; signals?: PreviewSignal[] };
  if (Array.isArray(d.startups) && d.startups.length > 0) {
    return d.startups.filter((e) => e?.startup?.id);
  }
  if (d.startup?.id) {
    return [{ startup: d.startup, signals: d.signals ?? FALLBACK_SIGNALS }];
  }
  return [];
}

export default function PythhEngineVisual({ className = "" }: { className?: string }) {
  const [pool, setPool] = useState<PreviewEntry[]>(FALLBACK_ENTRIES);
  const [index, setIndex] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [scanning, setScanning] = useState(true);
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hero-preview")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const next = normalizePool(data);
        if (next.length > 0) {
          setPool(next);
          setIndex(0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Pause rotation when the tab is hidden
  useEffect(() => {
    const onVis = () => {
      pausedRef.current = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Advance through the pool
  useEffect(() => {
    if (pool.length < 2) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((i) => (i + 1) % pool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pool.length]);

  // Replay scan + bar animation whenever the active startup changes
  useEffect(() => {
    setScanning(true);
    setAnimated(false);
    const scan = window.setTimeout(() => setScanning(false), SCAN_MS);
    const anim = window.setTimeout(() => setAnimated(true), ANIM_DELAY_MS);
    return () => {
      window.clearTimeout(scan);
      window.clearTimeout(anim);
    };
  }, [index, pool]);

  const entry = pool[index] ?? pool[0] ?? FALLBACK_ENTRIES[0];
  const startup = entry.startup;
  const signals = entry.signals?.length ? entry.signals : FALLBACK_SIGNALS;
  const godScore = startup.godScore;
  const godLabel = startup.godLabel;
  const displayName = startup.domain ?? startup.name ?? "live startup";
  const showDots = pool.length > 1;

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        border: `1px solid ${G_BORDER}`,
        backgroundColor: "oklch(0.08 0.01 264)",
        boxShadow: "0 0 48px oklch(0.696 0.17 162.48 / 0.06)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between border-b gap-3"
        style={{ borderColor: BORDER, backgroundColor: "oklch(0.085 0.01 264)" }}
      >
        <div className="min-w-0">
          <p
            key={startup.id}
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
          <HeroScoringDots active durationMs={SCAN_MS} tone="emerald" />
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
          <div key={startup.id} className="px-4 py-3 space-y-2.5 border-b" style={{ borderColor: BORDER }}>
            {signals.slice(0, 5).map(({ label, value, raw, color }) => (
              <div key={`${startup.id}-${label}`} className="flex items-center gap-2">
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

      {showDots && (
        <div
          className="flex items-center justify-center gap-1.5 py-2.5 border-t"
          style={{ borderColor: BORDER }}
          aria-label={`Startup ${index + 1} of ${pool.length}`}
        >
          {pool.map((e, i) => (
            <button
              key={e.startup.id}
              type="button"
              aria-label={`Show ${e.startup.domain ?? e.startup.name}`}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all p-0 border-0 cursor-pointer"
              style={{
                width: i === index ? 14 : 6,
                height: 6,
                backgroundColor: i === index ? G : "oklch(0.28 0.01 264)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
