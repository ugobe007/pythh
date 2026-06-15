/**
 * HeroResultsPreview — right-column live preview panel (saved for future use).
 * Removed from home hero v3 redesign; re-import when needed.
 */

import { useState, useEffect } from "react";
import HeroScoringDots from "@/components/HeroScoringDots";
import { G, CYAN, PURPLE } from "@/lib/designTokens";

interface HeroPreviewSignal {
  label: string;
  value: number;
  raw: number;
  color: string;
}

interface HeroPreviewDimension {
  label: string;
  score: number;
  max: number;
  color: string;
}

interface HeroPreviewMatch {
  investor: string;
  firm: string | null;
  score: number;
  why: string | null;
}

interface HeroPreviewEntry {
  startup: {
    id: string;
    name: string;
    domain: string | null;
    godScore: number;
    godLabel: string;
    matchCount: number;
    matches?: HeroPreviewMatch[];
    dimensions: HeroPreviewDimension[];
  };
  signals: HeroPreviewSignal[];
}

interface HeroPreviewResponse extends HeroPreviewEntry {
  startups?: HeroPreviewEntry[];
}

const DIM_COLORS = [PURPLE, CYAN, G, CYAN, PURPLE];
const HERO_STEP_MS = 2800;
const HERO_TRANSITION_MS = 1400;

export default function HeroResultsPreview() {
  const [pool, setPool] = useState<HeroPreviewEntry[]>([]);
  const [startupIndex, setStartupIndex] = useState(0);
  const [phase, setPhase] = useState(0);
  const [holdComplete, setHoldComplete] = useState(false);

  useEffect(() => {
    fetch("/api/hero-preview")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("preview failed"))))
      .then((data: HeroPreviewResponse) => {
        const entries = data.startups?.length ? data.startups : [data];
        setPool(entries);
        setStartupIndex(0);
        setHoldComplete(false);
        setPhase(0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pool.length === 0) return;
    const ms = phase === 0 ? HERO_TRANSITION_MS : HERO_STEP_MS;
    const id = setTimeout(() => {
      if (phase === 3) {
        setHoldComplete(true);
        setPhase(0);
      } else if (phase === 0) {
        if (holdComplete) {
          setStartupIndex((i) => (i + 1) % pool.length);
          setHoldComplete(false);
        }
        setPhase(1);
      } else {
        setPhase((p) => p + 1);
      }
    }, ms);
    return () => clearTimeout(id);
  }, [phase, pool.length, holdComplete]);

  const preview = pool[startupIndex] ?? null;
  const showTransition = phase === 0;
  const showMatches = phase >= 1 || (showTransition && holdComplete);
  const showComposite = phase >= 2 || (showTransition && holdComplete);
  const showEvidence = phase >= 3 || (showTransition && holdComplete);

  const startup = preview?.startup;
  const signals = preview?.signals ?? [];
  const dims = startup?.dimensions ?? [];
  const matches = startup?.matches ?? [];
  const displayDomain = startup?.domain ?? startup?.name ?? "startup";
  const statusLabel = showTransition
    ? holdComplete
      ? "verified"
      : "scanning…"
    : showEvidence
    ? "scored"
    : showComposite
    ? "ranked"
    : "matched";

  return (
    <div className="w-full" style={{ maxWidth: 520 }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "oklch(0.45 0.01 264)" }}>
        {startup
          ? `Live preview${pool.length > 1 ? ` · ${startupIndex + 1}/${pool.length}` : ""}`
          : "What you get in ~20 seconds"}
      </p>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ border: "1px solid oklch(0.696 0.17 162.48 / 0.22)", backgroundColor: "oklch(0.1 0.01 264)", boxShadow: "0 0 48px oklch(0.696 0.17 162.48 / 0.06)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "oklch(0.14 0.01 264)", backgroundColor: "oklch(0.085 0.01 264)" }}>
          {startup && (
            <p className="font-display font-bold truncate leading-tight mb-2.5" style={{ fontSize: "1.4rem", color: "oklch(0.75 0.01 264)", letterSpacing: "-0.02em" }}>
              {displayDomain}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: G }} />
              <span className="text-xs font-mono font-semibold truncate" style={{ color: G }}>
                PYTHIA · {statusLabel}
              </span>
            </div>
            <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "oklch(0.38 0.01 264)" }}>live</span>
          </div>
        </div>

        <div key={startup?.id ?? `slot-${startupIndex}`}>
          <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: "oklch(0.12 0.01 264)", backgroundColor: "oklch(0.696 0.17 162.48 / 0.04)" }}>
            <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: G }}>
              Your top investor matches
            </span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: showComposite && startup ? G : "oklch(0.35 0.01 264)" }}>
              {showComposite && startup ? `+${startup.matchCount} more` : ""}
            </span>
          </div>
          {(matches.length > 0 ? matches : [null, null, null]).map((m, i) => (
            <div
              key={m ? `${m.investor}-${i}` : `match-skel-${i}`}
              className="flex items-center gap-3 px-5 py-3 border-b"
              style={{
                borderColor: "oklch(0.11 0.01 264)",
                opacity: showMatches ? 1 : 0,
                transform: showMatches ? "translateY(0)" : "translateY(8px)",
                transition: `opacity 0.55s ease-out ${0.12 * i}s, transform 0.55s ease-out ${0.12 * i}s`,
              }}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate" style={{ color: showMatches && m ? "oklch(0.95 0.005 264)" : "oklch(0.35 0.01 264)" }}>
                  {showMatches && m ? m.investor : "—"}
                </span>
                <span className="block text-[10px] font-mono truncate" style={{ color: "oklch(0.45 0.01 264)" }}>
                  {showMatches && m ? `${m.firm || ""}${m.why ? ` · ${m.why}` : ""}` : "matching thesis…"}
                </span>
              </span>
              <span
                className="text-xs font-mono font-bold tabular-nums flex-shrink-0 px-2 py-0.5 rounded"
                style={{ color: showMatches && m ? G : "oklch(0.35 0.01 264)", backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)" }}
              >
                {showMatches && m ? m.score : "—"}
              </span>
            </div>
          ))}
        </div>

        {showTransition && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 pointer-events-none" style={{ backgroundColor: "transparent" }}>
            <HeroScoringDots active={showTransition} durationMs={HERO_TRANSITION_MS} tone={holdComplete ? "purple" : "emerald"} />
            <p className="text-[11px] font-mono tracking-widest uppercase" style={{ color: holdComplete ? "oklch(0.55 0.01 264)" : G }}>
              PYTHIA · {holdComplete ? "next startup" : "reading signals"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
